import express from 'express';
import { body, validationResult } from 'express-validator';
import LabCashierRecord, { DEFAULT_DISEASES } from '../models/LabCashierRecord.js';
import LabInvoice from '../models/LabInvoice.js';
import { protect, authorize, requirePermission, requireAnyPermission } from '../middleware/auth.js';
import { createActivityLog, emitTenantEvent, emitUserEvent } from '../services/realtimeService.js';
import { recordTransaction } from '../services/transactionLedgerService.js';

const router = express.Router();

const SAMPLE_TYPES = ['Blood', 'Urine', 'Stool', 'Swab', 'Other'];
const STATUS_OPTIONS = ['process', 'pending', 'complete'];

const generateInvoiceNumber = async (userId) => {
  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const count = await LabInvoice.countDocuments({
    user_id: userId,
    created_at: { $gte: startOfYear },
  });

  return `INV-${year}-${String(count + 1).padStart(5, '0')}`;
};

const createInvoiceForRecord = async (record, performer = {}) => {
  if (!record || record.status !== 'complete') {
    return null;
  }

  let invoice = await LabInvoice.findOne({ record_id: record._id });
  if (invoice) {
    const performerId = performer.id || record.processed_by_id;
    const performerName =
      performer.name ||
      record.processed_by_name ||
      record.cashier_name ||
      invoice.user_name ||
      'Team Member';
    const performerRole =
      performer.role ||
      record.processed_by_role ||
      invoice.user_role ||
      'staff';

    const needsUpdate =
      invoice.user_name !== performerName ||
      invoice.user_role !== performerRole ||
      (performerId && String(invoice.processed_by_id) !== String(performerId));

    if (needsUpdate) {
      invoice.user_name = performerName;
      invoice.user_role = performerRole;
      if (performerId) {
        invoice.processed_by_id = performerId;
      }
      await invoice.save();
    }

    return invoice;
  }

  const performerId = performer.id || record.processed_by_id;
  const performerName =
    performer.name ||
    record.processed_by_name ||
    record.cashier_name ||
    'Team Member';
  const performerRole =
    performer.role ||
    record.processed_by_role ||
    'staff';

  const invoiceNumber = await generateInvoiceNumber(record.user_id);
  invoice = await LabInvoice.create({
    record_id: record._id,
    invoice_number: invoiceNumber,
    user_id: record.user_id,
    patient_name: record.patient_name,
    price: record.price,
    diseases: record.diseases,
    sample_type: record.sample_type,
    user_name: performerName,
    user_role: performerRole,
    processed_by_id: performerId,
  });

  return invoice;
};

const createValidators = [
  body('patient_name').trim().notEmpty().withMessage('Patient name is required'),
  body('phone').optional().trim(),
  body('age').optional().isInt({ min: 0, max: 130 }).withMessage('Age must be between 0 and 130').toInt(),
  body('diseases')
    .isArray({ min: 1 })
    .withMessage('Select at least one disease or symptom'),
  body('diseases.*').isString().trim().notEmpty().withMessage('Disease name must be a string'),
  body('sample_type').isString().isIn(SAMPLE_TYPES).withMessage('Invalid sample type'),
  body('sample_notes').optional().trim(),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number').toFloat(),
  body('status').optional().isIn(STATUS_OPTIONS).withMessage('Invalid status'),
  body('date').optional().isISO8601().toDate(),
];

const updateValidators = [
  body('patient_name').optional().trim().notEmpty().withMessage('Patient name is required'),
  body('phone').optional().trim(),
  body('age').optional().isInt({ min: 0, max: 130 }).withMessage('Age must be between 0 and 130').toInt(),
  body('diseases').optional().isArray({ min: 1 }).withMessage('Select at least one disease or symptom'),
  body('diseases.*').optional().isString().trim().notEmpty().withMessage('Disease name must be a string'),
  body('sample_type').optional().isString().isIn(SAMPLE_TYPES).withMessage('Invalid sample type'),
  body('sample_notes').optional().trim(),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number').toFloat(),
  body('status').optional().isIn(STATUS_OPTIONS).withMessage('Invalid status'),
  body('date').optional().isISO8601().toDate(),
];

router.use(protect);

// GET diseases suggestions
router.get('/diseases', requirePermission('lab:view'), async (req, res) => {
  try {
    const scopeIds = req.tenantScopeIds;
    const query = scopeIds ? { user_id: { $in: scopeIds } } : {};
    const latestRecords = await LabCashierRecord.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const customDiseases = new Set(DEFAULT_DISEASES);
    latestRecords.forEach((record) => {
      if (Array.isArray(record.diseases)) {
        record.diseases.forEach((dis) => {
          if (typeof dis === 'string' && dis.trim()) {
            customDiseases.add(dis.trim());
          }
        });
      }
    });

    res.json(Array.from(customDiseases));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Analytics summary
router.get('/analytics/summary', requirePermission('lab:analytics'), async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const scopeIds = req.tenantScopeIds;
    const baseQuery = scopeIds ? { user_id: { $in: scopeIds } } : {};

    const { staffId } = req.query;
    const isSuperAdmin = req.user.role === 'super_admin';
    const isOwner = req.user.role === 'pharmacy_owner';
    const isStaff = req.user.role === 'staff';

    let effectiveStaffId = typeof staffId === 'string' && staffId.trim().length ? staffId.trim() : null;
    if (isStaff) {
      effectiveStaffId = req.user._id.toString();
    }

    if (effectiveStaffId) {
      if (
        isSuperAdmin ||
        isOwner ||
        (isStaff && effectiveStaffId === req.user._id.toString())
      ) {
        baseQuery.processed_by_id = effectiveStaffId;
      } else {
        return res.status(403).json({
          message: 'You are not allowed to view analytics for the selected staff member.',
        });
      }
    }

    const [todayRecords, allRecords] = await Promise.all([
      LabCashierRecord.find({
        ...baseQuery,
        date: { $gte: todayStart, $lte: todayEnd },
      }).lean(),
      LabCashierRecord.find(baseQuery).lean(),
    ]);

    const totalCashToday = todayRecords
      .filter((record) => record.status === 'complete')
      .reduce((sum, record) => sum + (record.price || 0), 0);

    const patientsToday = todayRecords.length;

    const diseaseCounts = {};
    allRecords.forEach((record) => {
      (record.diseases || []).forEach((disease) => {
        const key = (disease || '').trim();
        if (!key) return;
        diseaseCounts[key] = (diseaseCounts[key] || 0) + 1;
      });
    });

    const topDiseases = Object.entries(diseaseCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const daysBack = parseInt(req.query.days || '7', 10);
    const startRange = new Date();
    startRange.setDate(startRange.getDate() - (isNaN(daysBack) ? 7 : daysBack));
    startRange.setHours(0, 0, 0, 0);

    const trendRecords = await LabCashierRecord.find({
      ...baseQuery,
      date: { $gte: startRange },
      status: 'complete',
    })
      .select('date price')
      .lean();

    const trendMap = new Map();
    trendRecords.forEach((record) => {
      const key = new Date(record.date).toISOString().split('T')[0];
      trendMap.set(key, (trendMap.get(key) || 0) + (record.price || 0));
    });

    const trend = Array.from(trendMap.entries())
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      totalCashToday,
      patientsToday,
      topDiseases,
      trend,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET records
router.get('/', requirePermission('lab:view'), async (req, res) => {
  try {
    const { status, startDate, endDate, search, staffId } = req.query;
    const scopeIds = req.tenantScopeIds;
    const query = scopeIds ? { user_id: { $in: scopeIds } } : {};

    const isSuperAdmin = req.user.role === 'super_admin';
    const isOwner = req.user.role === 'pharmacy_owner';
    const isStaff = req.user.role === 'staff';

    let effectiveStaffId = typeof staffId === 'string' && staffId.trim().length ? staffId.trim() : null;
    if (isStaff) {
      effectiveStaffId = req.user._id.toString();
    }

    if (effectiveStaffId) {
      if (
        isSuperAdmin ||
        isOwner ||
        (isStaff && effectiveStaffId === req.user._id.toString())
      ) {
        query.processed_by_id = effectiveStaffId;
      } else {
        return res.status(403).json({
          message: 'You are not allowed to view lab records for the selected staff member.',
        });
      }
    }

    if (status && STATUS_OPTIONS.includes(status)) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    if (search && typeof search === 'string') {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ patient_name: regex }, { phone: regex }, { diseases: regex }];
    }

    const records = await LabCashierRecord.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const withInvoice = await Promise.all(
      records.map(async (record) => {
        const invoice = record.status === 'complete'
          ? await LabInvoice.findOne({ record_id: record._id }).lean()
          : null;
        return {
          ...record,
          invoice,
        };
      })
    );

    res.json(withInvoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/admin/all/records', authorize('super_admin'), async (_req, res) => {
  try {
    const records = await LabCashierRecord.find().sort({ createdAt: -1 }).lean();
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST create record
router.post('/', requireAnyPermission('lab:records', 'lab:create'), createValidators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      patient_name,
      phone,
      age,
      diseases,
      sample_type,
      sample_notes,
      price,
      status = 'process',
      date,
    } = req.body;

    const ownerId = req.accountId || req.user._id;
    const performerId = req.user?._id;
    const performerName =
      req.user?.pharmacyName ||
      req.user?.name ||
      req.user?.fullName ||
      req.user?.email ||
      'Team Member';
    const performerRole = req.user?.role || 'staff';
    const record = await LabCashierRecord.create({
      user_id: ownerId,
      patient_name,
      phone,
      age,
      diseases,
      sample_type,
      sample_notes,
      price,
      status,
      date: date ? new Date(date) : new Date(),
      cashier_name: performerName,
      processed_by_id: performerId,
      processed_by_name: performerName,
      processed_by_role: performerRole,
      user_name: performerName,
    });

    const tenantId = ownerId ? ownerId.toString() : null;

    let invoice = null;
    if (record.status === 'complete') {
      invoice = await createInvoiceForRecord(record, {
        id: performerId,
        name: performerName,
        role: performerRole,
      });

      if (invoice) {
        try {
          await recordTransaction({
            tenantId: ownerId,
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoice_number,
            transactionType: 'lab_cash',
            amount: record.price || 0,
            profit: 0,
            loss: 0,
            customerName: patient_name,
            handledBy: {
              id: performerId,
              name: performerName,
              role: performerRole,
            },
            status: 'success',
            paymentMethod: 'Cash',
            meta: {
              record_id: record._id.toString(),
              diseases,
              sample_type,
            },
            app: req.app,
          });
        } catch (ledgerError) {
          console.error('Failed to record lab transaction ledger entry:', ledgerError);
        }
      }
    }

    const activityMessage =
      record.status === 'complete'
        ? `${performerName} completed lab payment for ${patient_name}`
        : `${performerName} recorded lab service for ${patient_name}`;

    await createActivityLog({
      tenantId,
      userId: performerId,
      userName: performerName,
      userRole: performerRole,
      module: 'lab',
      action: record.status === 'complete' ? 'lab_record_completed' : 'lab_record_created',
      message: activityMessage,
      amount: record.price || 0,
      metadata: {
        record_id: record._id.toString(),
        invoice_id: invoice?._id?.toString(),
        diseases: record.diseases,
        status: record.status,
      },
    });

    const eventPayload = {
      type: record.status === 'complete' ? 'lab.completed' : 'lab.created',
      amount: record.price || 0,
      status: record.status,
      user: {
        id: performerId?.toString(),
        name: performerName,
        role: performerRole,
      },
      record: {
        id: record._id.toString(),
        patient: patient_name,
        diseases,
        sample_type,
        invoice_number: invoice?.invoice_number,
      },
    };

    if (tenantId) {
      emitTenantEvent(req.app, tenantId, 'lab:updated', eventPayload);
      emitTenantEvent(req.app, tenantId, 'dashboard:metrics', eventPayload);
    }

    if (performerId) {
      emitUserEvent(req.app, performerId, 'activity:ack', eventPayload);
    }

    res.status(201).json({ record, invoice });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET record by id
router.get('/:id', requirePermission('lab:view'), async (req, res) => {
  try {
    const scopeIds = req.tenantScopeIds;
    const recordQuery = scopeIds
      ? { _id: req.params.id, user_id: { $in: scopeIds } }
      : { _id: req.params.id };
    const record = await LabCashierRecord.findOne(recordQuery).lean();

    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
    }

    const invoice = record.status === 'complete'
      ? await LabInvoice.findOne({ record_id: record._id }).lean()
      : null;

    res.json({ ...record, invoice });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH update record
router.patch('/:id', requireAnyPermission('lab:records', 'lab:edit'), updateValidators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const allowedFields = [
      'patient_name',
      'phone',
      'age',
      'diseases',
      'sample_type',
      'sample_notes',
      'price',
      'status',
      'date',
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    });

    if (updates.date) {
      updates.date = new Date(updates.date);
    }

    const scopeIds = req.tenantScopeIds;
    const match = scopeIds
      ? { _id: req.params.id, user_id: { $in: scopeIds } }
      : { _id: req.params.id };
    const performerId = req.user?._id;
    const performerName =
      req.user?.pharmacyName ||
      req.user?.name ||
      req.user?.fullName ||
      req.user?.email ||
      'Team Member';
    const performerRole = req.user?.role || 'staff';

    const record = await LabCashierRecord.findOneAndUpdate(
      match,
      {
        ...updates,
        ...(updates.status === 'complete'
          ? {
              processed_by_id: performerId,
              processed_by_name: performerName,
              processed_by_role: performerRole,
              user_name: performerName,
              cashier_name: performerName,
            }
          : {}),
      },
      { new: true, runValidators: true }
    );

    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
    }

    const tenantId = record.user_id ? record.user_id.toString() : null;

    let invoice = null;
    if (record.status === 'complete') {
      invoice = await createInvoiceForRecord(record, {
        id: performerId,
        name: performerName,
        role: performerRole,
      });

      if (invoice) {
        try {
          await recordTransaction({
            tenantId: record.user_id,
            invoiceId: invoice._id,
            invoiceNumber: invoice.invoice_number,
            transactionType: 'lab_cash',
            amount: record.price || 0,
            profit: 0,
            loss: 0,
            customerName: record.patient_name,
            handledBy: {
              id: performerId,
              name: performerName,
              role: performerRole,
            },
            status: 'success',
            paymentMethod: 'Cash',
            meta: {
              record_id: record._id.toString(),
              diseases: record.diseases,
              sample_type: record.sample_type,
            },
            app: req.app,
          });
        } catch (ledgerError) {
          console.error('Failed to update lab transaction ledger entry:', ledgerError);
        }
      }
    } else {
      await LabInvoice.deleteOne({ record_id: record._id });
    }

    await createActivityLog({
      tenantId,
      userId: performerId,
      userName: performerName,
      userRole: performerRole,
      module: 'lab',
      action: 'lab_record_updated',
      message: `${performerName} updated lab record for ${record.patient_name}`,
      amount: record.price || 0,
      metadata: {
        record_id: record._id.toString(),
        invoice_id: invoice?._id?.toString(),
        status: record.status,
      },
    });

    const eventPayload = {
      type: 'lab.updated',
      amount: record.price || 0,
      status: record.status,
      user: {
        id: performerId?.toString(),
        name: performerName,
        role: performerRole,
      },
      record: {
        id: record._id.toString(),
        patient: record.patient_name,
        diseases: record.diseases,
        sample_type: record.sample_type,
        invoice_number: invoice?.invoice_number,
      },
    };

    if (tenantId) {
      emitTenantEvent(req.app, tenantId, 'lab:updated', eventPayload);
      emitTenantEvent(req.app, tenantId, 'dashboard:metrics', eventPayload);
    }

    if (performerId) {
      emitUserEvent(req.app, performerId, 'activity:ack', eventPayload);
    }

    res.json({ record, invoice });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE record
router.delete('/:id', requireAnyPermission('lab:records', 'lab:delete'), async (req, res) => {
  try {
    const scopeIds = req.tenantScopeIds;
    const match = scopeIds
      ? { _id: req.params.id, user_id: { $in: scopeIds } }
      : { _id: req.params.id };
    const record = await LabCashierRecord.findOneAndDelete(match);

    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
    }

    await LabInvoice.deleteOne({ record_id: record._id });

    res.json({ message: 'Record deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
