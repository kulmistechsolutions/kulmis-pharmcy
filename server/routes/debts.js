import express from 'express';
import { body, validationResult } from 'express-validator';
import Debt from '../models/Debt.js';
import { protect, requirePermission, requireOwner } from '../middleware/auth.js';
import { recordTransaction } from '../services/transactionLedgerService.js';
import { sendSMS } from '../services/smsService.js';

const router = express.Router();

// @route   GET /api/debts
// @desc    Get all debts
// @access  Private
router.get('/', protect, requirePermission('debts:view'), async (req, res) => {
  try {
    const { status } = req.query;
    const scopeIds = req.tenantScopeIds;
    const query = scopeIds ? { user_id: { $in: scopeIds } } : {};

    if (status) {
      query.status = status;
    }

    const debts = await Debt.find(query).sort({ createdAt: -1 });

    // Update overdue status
    const now = new Date();
    for (const debt of debts) {
      if (debt.status !== 'Paid' && new Date(debt.due_date) < now) {
        debt.status = 'Overdue';
        await debt.save();
      }
    }

    const updatedDebts = await Debt.find(query).sort({ createdAt: -1 });
    res.json(updatedDebts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/debts
// @desc    Create a new debt
// @access  Private
router.post(
  '/',
  protect,
  requireOwner(),
  requirePermission('debts:create'),
  [
    body('debtor_name').trim().notEmpty().withMessage('Debtor name is required'),
    body('phone').trim().notEmpty().withMessage('Phone is required'),
    body('due_date').notEmpty().withMessage('Due date is required'),
    body('balance').isFloat({ min: 0 }).withMessage('Balance must be positive'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const ownerId = req.accountId || req.user._id;
      const debt = await Debt.create({
        ...req.body,
        user_id: ownerId,
        paid: 0,
      });

      try {
        await recordTransaction({
          tenantId: ownerId,
          invoiceId: debt._id,
          invoiceNumber: `DEBT-${debt._id.toString().slice(-6).toUpperCase()}`,
          transactionType: 'debt_recovery',
          amount: debt.balance || 0,
          profit: 0,
          loss: 0,
          customerName: debt.debtor_name,
          handledBy: {
            id: req.user?._id,
            name: req.user?.pharmacyName || req.user?.name || req.user?.email,
            role: req.user?.role,
          },
          status: 'pending',
          paymentMethod: 'Credit',
          notes: `Debt created for ${debt.debtor_name}`,
          meta: {
            debt_id: debt._id.toString(),
            phone: debt.phone,
            due_date: debt.due_date,
            medicines: debt.medicines,
          },
          app: req.app,
        });
      } catch (ledgerError) {
        console.error('Failed to record debt transaction ledger entry:', ledgerError);
      }

      res.status(201).json(debt);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// @route   PATCH /api/debts/:id/payment
// @desc    Record a payment
// @access  Private
router.patch('/:id/payment', protect, requirePermission('debts:payment'), async (req, res) => {
  try {
    const { amount } = req.body;
    const scopeIds = req.tenantScopeIds;
    const debt = await Debt.findOne({
      _id: req.params.id,
      ...(scopeIds ? { user_id: { $in: scopeIds } } : {}),
    });

    if (!debt) {
      return res.status(404).json({ message: 'Debt not found' });
    }

    debt.paid += amount;
    const remaining = debt.balance - debt.paid;

    if (remaining <= 0) {
      debt.status = 'Paid';
      debt.paid = debt.balance;
    } else if (debt.paid > 0) {
      debt.status = 'Partial';
    }

    await debt.save();

    try {
      await recordTransaction({
        tenantId: debt.user_id,
        invoiceId: debt._id,
        invoiceNumber: `DEBT-${debt._id.toString().slice(-6).toUpperCase()}`,
        transactionType: 'debt_recovery',
        amount,
        profit: 0,
        loss: 0,
        customerName: debt.debtor_name,
        handledBy: {
          id: req.user?._id,
          name: req.user?.pharmacyName || req.user?.name || req.user?.email,
          role: req.user?.role,
        },
        status: debt.status === 'Paid' ? 'success' : 'pending',
        paymentMethod: 'Cash',
        notes: `Debt payment recorded`,
        meta: {
          debt_id: debt._id.toString(),
          remaining,
        },
        app: req.app,
      });
    } catch (ledgerError) {
      console.error('Failed to record debt payment transaction ledger entry:', ledgerError);
    }

    res.json(debt);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/debts/:id
// @desc    Update debt
// @access  Private
router.put('/:id', protect, requireOwner(), requirePermission('debts:edit'), async (req, res) => {
  try {
    const scopeIds = req.tenantScopeIds;
    const debt = await Debt.findOneAndUpdate(
      { _id: req.params.id, ...(scopeIds ? { user_id: { $in: scopeIds } } : {}) },
      req.body,
      { new: true, runValidators: true }
    );

    if (!debt) {
      return res.status(404).json({ message: 'Debt not found' });
    }

    res.json(debt);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/reminder', protect, requirePermission('debts:edit'), async (req, res) => {
  try {
    const { method, message, phone } = req.body;
    const validMethods = ['whatsapp', 'sms'];

    if (!method || !validMethods.includes(method)) {
      return res.status(400).json({ message: 'Reminder method must be whatsapp or sms.' });
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ message: 'Reminder message is required.' });
    }

    const scopeIds = req.tenantScopeIds;
    const debt = await Debt.findOne({
      _id: req.params.id,
      ...(scopeIds ? { user_id: { $in: scopeIds } } : {}),
    });

    if (!debt) {
      return res.status(404).json({ message: 'Debt not found' });
    }

    if (method === 'sms') {
      const destination = phone || debt.phone;
      try {
        await sendSMS({ to: destination, message });
      } catch (error) {
        return res.status(502).json({ message: error.message || 'Failed to send SMS reminder.' });
      }
    }

    debt.reminder_sent = true;
    debt.last_reminder_method = method === 'sms' ? 'SMS' : 'WhatsApp';
    debt.last_reminder_date = new Date();
    await debt.save();

    res.json(debt);
  } catch (error) {
    console.error('Error sending debt reminder:', error);
    res.status(500).json({ message: error.message || 'Failed to send reminder.' });
  }
});

export default router;

