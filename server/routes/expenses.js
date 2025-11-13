import express from 'express';
import { body, validationResult } from 'express-validator';
import Expense from '../models/Expense.js';
import { protect, requirePermission, requireOwner } from '../middleware/auth.js';
import { recordTransaction } from '../services/transactionLedgerService.js';

const router = express.Router();

// @route   GET /api/expenses
// @desc    Get all expenses
// @access  Private
router.get('/', protect, requirePermission('expenses:view'), async (req, res) => {
  try {
    const { category, startDate, endDate } = req.query;
    const scopeIds = req.tenantScopeIds;
    const query = scopeIds ? { user_id: { $in: scopeIds } } : {};

    if (category) {
      query.category = category;
    }

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const expenses = await Expense.find(query).sort({ date: -1 });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/expenses
// @desc    Create a new expense
// @access  Private
router.post(
  '/',
  protect,
  requireOwner(),
  requirePermission('expenses:create'),
  [
    body('category').notEmpty().withMessage('Category is required'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be positive'),
    body('date').optional().isISO8601(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const ownerId = req.accountId || req.user._id;
      const expense = await Expense.create({
        ...req.body,
        user_id: ownerId,
      });

      try {
        await recordTransaction({
          tenantId: ownerId,
          invoiceId: expense._id,
          invoiceNumber: `EXP-${expense._id.toString().slice(-6).toUpperCase()}`,
          transactionType: 'expense',
          amount: expense.amount || 0,
          profit: 0,
          loss: expense.amount || 0,
          customerName: expense.category || 'Expense',
          handledBy: {
            id: req.user?._id,
            name: req.user?.pharmacyName || req.user?.name || req.user?.email,
            role: req.user?.role,
          },
          status: 'success',
          paymentMethod: expense.payment_method || 'Cash',
          notes: expense.description,
          meta: {
            expense_id: expense._id.toString(),
            category: expense.category,
            date: expense.date,
          },
          app: req.app,
        });
      } catch (ledgerError) {
        console.error('Failed to record expense transaction ledger entry:', ledgerError);
      }

      res.status(201).json(expense);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// @route   PUT /api/expenses/:id
// @desc    Update expense
// @access  Private
router.put('/:id', protect, requireOwner(), requirePermission('expenses:edit'), async (req, res) => {
  try {
    const scopeIds = req.tenantScopeIds;
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, ...(scopeIds ? { user_id: { $in: scopeIds } } : {}) },
      req.body,
      { new: true, runValidators: true }
    );

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/expenses/:id
// @desc    Delete expense
// @access  Private
router.delete('/:id', protect, requireOwner(), requirePermission('expenses:delete'), async (req, res) => {
  try {
    const scopeIds = req.tenantScopeIds;
    const expense = await Expense.findOneAndDelete({
      _id: req.params.id,
      ...(scopeIds ? { user_id: { $in: scopeIds } } : {}),
    });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;

