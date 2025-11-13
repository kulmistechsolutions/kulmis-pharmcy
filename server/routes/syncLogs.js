import express from 'express';
import mongoose from 'mongoose';
import SyncLog from '../models/SyncLog.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const toObjectId = (value) => {
  if (!value) return undefined;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return undefined;
};

router.post('/', protect, async (req, res) => {
  try {
    const { logs } = req.body || {};
    if (!Array.isArray(logs) || logs.length === 0) {
      return res.status(400).json({ message: 'Logs array is required.' });
    }

    const tenantId =
      req.isSuperAdminRequest && logs[0]?.tenant_id
        ? toObjectId(logs[0].tenant_id)
        : toObjectId(req.accountId || req.user._id);

    if (!tenantId) {
      return res.status(400).json({ message: 'Unable to resolve tenant id for log entry.' });
    }

    const documents = logs.map((log) => {
      const payloadTenant =
        req.isSuperAdminRequest && log.tenant_id ? toObjectId(log.tenant_id) : tenantId;

      return {
        tenant_id: payloadTenant,
        user_id: toObjectId(log.user_id) || toObjectId(req.user._id),
        user_email: log.user_email || req.user.email,
        target: log.target || 'unknown',
        status: log.status || 'queued',
        local_id: log.localId || log.local_id,
        message: log.message,
        metadata: log.metadata || {},
        retried_count: typeof log.retriedCount === 'number' ? log.retriedCount : 0,
        conflict_resolved_at: log.conflictResolvedAt ? new Date(log.conflictResolvedAt) : undefined,
        created_at: log.timestamp ? new Date(log.timestamp) : undefined,
      };
    });

    await SyncLog.insertMany(documents, { ordered: false });
    return res.status(201).json({ inserted: documents.length });
  } catch (error) {
    console.error('Failed to store sync logs:', error);
    return res.status(500).json({ message: 'Failed to store sync logs.' });
  }
});

router.get('/', protect, async (req, res) => {
  try {
    const {
      status,
      target,
      staffId,
      startDate,
      endDate,
      tenantId: tenantIdQuery,
      limit = 200,
      skip = 0,
    } = req.query;

    const query = {};

    if (req.isSuperAdminRequest && tenantIdQuery) {
      query.tenant_id = toObjectId(tenantIdQuery);
    } else if (req.user.role === 'staff') {
      query.user_id = toObjectId(req.user._id);
      query.tenant_id = toObjectId(req.accountId || req.user._id);
    } else {
      const scopeIds = req.tenantScopeIds || [req.accountId || req.user._id];
      query.tenant_id = { $in: scopeIds.filter(Boolean).map((id) => toObjectId(id)) };
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (target && target !== 'all') {
      query.target = target;
    }

    if (staffId && staffId !== 'all') {
      query.user_id = toObjectId(staffId);
    }

    if (startDate || endDate) {
      query.created_at = {};
      if (startDate) {
        query.created_at.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.created_at.$lte = end;
      }
    }

    const parsedLimit = Math.min(Number(limit) || 200, 1000);
    const parsedSkip = Number(skip) || 0;

    const logs = await SyncLog.find(query)
      .sort({ created_at: -1 })
      .skip(parsedSkip)
      .limit(parsedLimit)
      .lean();

    const summaryAgg = await SyncLog.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const summary = summaryAgg.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const lastSynced = await SyncLog.findOne({ ...query, status: 'synced' })
      .sort({ created_at: -1 })
      .select('created_at')
      .lean();

    return res.json({
      data: logs,
      summary,
      lastSyncedAt: lastSynced?.created_at || null,
    });
  } catch (error) {
    console.error('Failed to load sync logs:', error);
    return res.status(500).json({ message: 'Failed to load sync logs.' });
  }
});

export default router;




