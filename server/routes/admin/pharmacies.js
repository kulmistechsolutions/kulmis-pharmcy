import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../../models/User.js';
import Medicine from '../../models/Medicine.js';
import Subscription from '../../models/Subscription.js';
import Transaction from '../../models/Transaction.js';
import Debt from '../../models/Debt.js';
import Invoice from '../../models/Invoice.js';
import PharmacySetting from '../../models/PharmacySetting.js';
import { protect, authorize } from '../../middleware/auth.js';
import mongoose from 'mongoose';
import {
  extendTrialForUser,
  resetTrialForUser,
  endTrialImmediately,
} from '../../services/subscriptionTrialService.js';

const router = express.Router();

// All routes require super_admin
router.use(protect);
router.use(authorize('super_admin'));

// @route   GET /api/admin/pharmacies
// @desc    Get all pharmacies with subscription info
// @access  Private (Super Admin)
router.get('/', async (req, res) => {
  try {
    const owners = await User.find({ role: 'pharmacy_owner' })
      .select('-password')
      .sort({ createdAt: -1 });

    if (!owners.length) {
      return res.json([]);
    }

    const pharmacyIds = owners.map((owner) => owner._id);
    const now = new Date();

    const [subscriptions, transactionMetrics, debtMetrics, medicineMetrics, invoiceMetrics, settings] =
      await Promise.all([
        Subscription.find({
          user_id: { $in: pharmacyIds },
          status: { $in: ['active', 'pending', 'expired'] },
        })
          .populate('plan_id', 'name duration_days')
          .lean(),
        Transaction.aggregate([
          {
            $match: {
              $or: [
                { tenant_id: { $in: pharmacyIds } },
                { user_id: { $in: pharmacyIds } },
              ],
            },
          },
          {
            $addFields: {
              pharmacy: {
                $cond: [
                  { $ifNull: ['$tenant_id', false] },
                  '$tenant_id',
                  '$user_id',
                ],
              },
              saleAmount: { $ifNull: ['$amount', '$total_sale'] },
              profitAmount: { $ifNull: ['$profit_total', '$profit'] },
            },
          },
          {
            $match: {
              pharmacy: { $in: pharmacyIds },
              status: { $ne: 'cancelled' },
            },
          },
          {
            $group: {
              _id: '$pharmacy',
              totalSales: { $sum: { $ifNull: ['$saleAmount', 0] } },
              totalTransactions: { $sum: 1 },
              totalProfit: { $sum: { $ifNull: ['$profitAmount', 0] } },
              lastTransactionAt: { $max: '$createdAt' },
            },
          },
        ]),
        Debt.aggregate([
          {
            $match: {
              user_id: { $in: pharmacyIds },
            },
          },
          {
            $group: {
              _id: '$user_id',
              outstanding: {
                $sum: {
                  $max: [
                    { $subtract: ['$balance', '$paid'] },
                    0,
                  ],
                },
              },
              totalDebts: { $sum: '$balance' },
            },
          },
        ]),
        Medicine.aggregate([
          {
            $match: {
              user_id: { $in: pharmacyIds },
            },
          },
          {
            $group: {
              _id: '$user_id',
              totalMedicines: { $sum: '$quantity' },
              skuCount: { $sum: 1 },
            },
          },
        ]),
        Invoice.aggregate([
          {
            $match: {
              user_id: { $in: pharmacyIds },
            },
          },
          {
            $group: {
              _id: '$user_id',
              totalInvoices: { $sum: 1 },
              customers: { $addToSet: { $ifNull: ['$customer_name', '$phone'] } },
            },
          },
          {
            $project: {
              totalInvoices: 1,
              customerCount: {
                $size: {
                  $filter: {
                    input: '$customers',
                    cond: { $ne: ['$$this', null] },
                  },
                },
              },
            },
          },
        ]),
        PharmacySetting.find({
          pharmacy: { $in: pharmacyIds },
        })
          .select('pharmacy owner_name logo_url address phone email')
          .lean(),
      ]);

    const subscriptionMap = new Map();
    subscriptions.forEach((sub) => {
      const key = sub.user_id.toString();
      const existing = subscriptionMap.get(key);
      if (!existing || existing.status !== 'active') {
        subscriptionMap.set(key, sub);
      }
    });

    const toMap = (docs) =>
      docs.reduce((map, doc) => {
        map.set(doc._id.toString(), doc);
        return map;
      }, new Map());

    const transactionMap = toMap(transactionMetrics);
    const debtMap = toMap(debtMetrics);
    const medicineMap = toMap(medicineMetrics);
    const invoiceMap = toMap(invoiceMetrics);
    const settingsMap = settings.reduce((map, setting) => {
      map.set(setting.pharmacy.toString(), setting);
      return map;
    }, new Map());

    const pharmaciesWithDetails = owners.map((user) => {
      const key = user._id.toString();
      const subscription = subscriptionMap.get(key);
      const transactionStat = transactionMap.get(key) || {
        totalSales: 0,
        totalTransactions: 0,
        totalProfit: 0,
        lastTransactionAt: null,
      };
      const debtStat = debtMap.get(key) || {
        outstanding: 0,
        totalDebts: 0,
      };
      const medicineStat = medicineMap.get(key) || {
        totalMedicines: 0,
        skuCount: 0,
      };
      const invoiceStat = invoiceMap.get(key) || {
        totalInvoices: 0,
        customerCount: 0,
      };
      const setting = settingsMap.get(key);

      let daysRemaining = null;
      let planName = 'Free Trial';
      let statusLabel = 'Expired';
      let statusColor = 'bg-red-100 text-red-700';

      if (subscription && subscription.end_at) {
        const endDate = new Date(subscription.end_at);
        const diff = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
        daysRemaining = diff > 0 ? diff : 0;

        planName = subscription.plan_id?.name || subscription.plan || 'Paid Plan';
        if (subscription.status === 'active') {
          statusLabel = 'Active';
          statusColor = 'bg-green-100 text-green-700';
        } else if (subscription.status === 'pending') {
          statusLabel = 'Pending Approval';
          statusColor = 'bg-amber-100 text-amber-700';
        } else if (subscription.status === 'expired') {
          statusLabel = 'Expired';
          statusColor = 'bg-red-100 text-red-700';
        }
      } else if (user.planType === 'trial' && !user.isTrialExpired) {
        planName = 'Free Trial';
        const trialEnd = user.trialEnd ? new Date(user.trialEnd) : null;
        if (trialEnd) {
          const diff = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
          daysRemaining = diff > 0 ? diff : 0;
        }
        statusLabel = 'Trial';
        statusColor = 'bg-yellow-100 text-yellow-700';
      }

      if (!user.isActive) {
        statusLabel = 'Suspended';
        statusColor = 'bg-gray-200 text-gray-700';
      }

      const trialDaysRemaining =
        user.trialEnd && !user.isTrialExpired
          ? Math.max(Math.ceil((new Date(user.trialEnd) - now) / (1000 * 60 * 60 * 24)), 0)
          : null;

      return {
        _id: user._id,
        pharmacyName: user.pharmacyName,
        ownerName: setting?.owner_name || user.pharmacyName,
        phone: user.phone,
        email: user.email,
        joinDate: user.createdAt,
        isActive: user.isActive,
        planName,
        daysRemaining,
        statusLabel,
        statusColor,
        logoUrl: setting?.logo_url || null,
        address: setting?.address || null,
        subscription: subscription
          ? {
              ...subscription,
              daysRemaining,
            }
          : null,
        trial: {
          start: user.trialStart,
          end: user.trialEnd,
          daysRemaining: trialDaysRemaining,
          isExpired: !!user.isTrialExpired,
          status: user.subscriptionStatus,
        },
        metrics: {
          totalSales: transactionStat.totalSales || 0,
          totalTransactions: transactionStat.totalTransactions || 0,
          totalProfit: transactionStat.totalProfit || 0,
          totalDebts: debtStat.outstanding || 0,
          totalDebtsRecorded: debtStat.totalDebts || 0,
          totalMedicines: medicineStat.totalMedicines || 0,
          skuCount: medicineStat.skuCount || 0,
          totalInvoices: invoiceStat.totalInvoices || 0,
          customerCount: invoiceStat.customerCount || 0,
          lastTransactionAt: transactionStat.lastTransactionAt || null,
        },
      };
    });

    res.json(pharmaciesWithDetails);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/admin/pharmacies/:id/profile
// @desc    Get pharmacy profile with performance metrics
// @access  Private (Super Admin)
router.get('/:id/profile', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid pharmacy id' });
    }

    const pharmacyId = new mongoose.Types.ObjectId(req.params.id);
    const user = await User.findById(pharmacyId).select('-password');
    if (!user || user.role !== 'pharmacy_owner') {
      return res.status(404).json({ message: 'Pharmacy not found' });
    }

    const now = new Date();

    const [subscription, transactionStat, monthlyPerformance, debtStat, medicineStat, invoiceStat, setting, staffUsers] =
      await Promise.all([
        Subscription.findOne({
          user_id: pharmacyId,
          status: { $in: ['active', 'pending', 'expired'] },
        })
          .populate('plan_id', 'name duration_days price')
          .lean(),
        Transaction.aggregate([
          {
            $match: {
              $or: [{ tenant_id: pharmacyId }, { user_id: pharmacyId }],
              status: { $ne: 'cancelled' },
            },
          },
          {
            $addFields: {
              saleAmount: { $ifNull: ['$amount', '$total_sale'] },
              profitAmount: { $ifNull: ['$profit_total', '$profit'] },
            },
          },
          {
            $group: {
              _id: null,
              totalSales: { $sum: { $ifNull: ['$saleAmount', 0] } },
              totalTransactions: { $sum: 1 },
              totalProfit: { $sum: { $ifNull: ['$profitAmount', 0] } },
              lastTransactionAt: { $max: '$createdAt' },
            },
          },
        ]),
        Transaction.aggregate([
          {
            $match: {
              $or: [{ tenant_id: pharmacyId }, { user_id: pharmacyId }],
              status: { $ne: 'cancelled' },
            },
          },
          {
            $addFields: {
              saleAmount: { $ifNull: ['$amount', '$total_sale'] },
              profitAmount: { $ifNull: ['$profit_total', '$profit'] },
            },
          },
          {
            $group: {
              _id: {
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
              },
              totalSales: { $sum: { $ifNull: ['$saleAmount', 0] } },
              totalProfit: { $sum: { $ifNull: ['$profitAmount', 0] } },
              transactions: { $sum: 1 },
            },
          },
          { $sort: { '_id.year': -1, '_id.month': -1 } },
          { $limit: 6 },
          { $sort: { '_id.year': 1, '_id.month': 1 } },
          {
            $project: {
              _id: 0,
              year: '$_id.year',
              month: '$_id.month',
              totalSales: 1,
              totalProfit: 1,
              transactions: 1,
            },
          },
        ]),
        Debt.aggregate([
          {
            $match: { user_id: pharmacyId },
          },
          {
            $group: {
              _id: null,
              outstanding: {
                $sum: {
                  $max: [
                    { $subtract: ['$balance', '$paid'] },
                    0,
                  ],
                },
              },
              totalDebts: { $sum: '$balance' },
            },
          },
        ]),
        Medicine.aggregate([
          {
            $match: { user_id: pharmacyId },
          },
          {
            $group: {
              _id: null,
              totalMedicines: { $sum: '$quantity' },
              skuCount: { $sum: 1 },
            },
          },
        ]),
        Invoice.aggregate([
          {
            $match: { user_id: pharmacyId },
          },
          {
            $group: {
              _id: null,
              totalInvoices: { $sum: 1 },
              customerSet: { $addToSet: { $ifNull: ['$customer_name', '$phone'] } },
            },
          },
          {
            $project: {
              _id: 0,
              totalInvoices: 1,
              customerCount: {
                $size: {
                  $filter: {
                    input: '$customerSet',
                    cond: { $ne: ['$$this', null] },
                  },
                },
              },
            },
          },
        ]),
        PharmacySetting.findOne({ pharmacy: pharmacyId })
          .select('owner_name logo_url address phone email')
          .lean(),
        User.find({
          created_by: pharmacyId,
          role: 'staff',
        })
          .select('pharmacyName email phone role isActive createdAt')
          .lean(),
      ]);

    const transactionSummary = transactionStat[0] || {
      totalSales: 0,
      totalTransactions: 0,
      totalProfit: 0,
      lastTransactionAt: null,
    };
    const debtSummary = debtStat[0] || { outstanding: 0, totalDebts: 0 };
    const medicineSummary = medicineStat[0] || { totalMedicines: 0, skuCount: 0 };
    const invoiceSummary = invoiceStat[0] || { totalInvoices: 0, customerCount: 0 };

    let daysRemaining = null;
    let planName = 'Free Trial';
    if (subscription && subscription.end_at) {
      const endDate = new Date(subscription.end_at);
      const diff = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
      daysRemaining = diff > 0 ? diff : 0;
      planName = subscription.plan_id?.name || subscription.plan || 'Paid Plan';
    } else if (user.planType === 'trial' && !user.isTrialExpired && user.trialEnd) {
      const diff = Math.ceil((new Date(user.trialEnd) - now) / (1000 * 60 * 60 * 24));
      daysRemaining = diff > 0 ? diff : 0;
    }

    res.json({
      profile: {
        id: user._id,
        pharmacyName: user.pharmacyName,
        ownerName: setting?.owner_name || user.pharmacyName,
        logoUrl: setting?.logo_url || null,
        contact: {
          phone: setting?.phone || user.phone,
          email: setting?.email || user.email,
          address: setting?.address || null,
        },
        registrationDate: user.createdAt,
        planName,
        planType: user.planType,
        daysRemaining,
        isActive: user.isActive,
        status: user.subscriptionStatus,
      },
      subscription: subscription || null,
      trial: {
        start: user.trialStart,
        end: user.trialEnd,
        isExpired: !!user.isTrialExpired,
        daysRemaining:
          user.trialEnd && !user.isTrialExpired
            ? Math.max(Math.ceil((new Date(user.trialEnd) - now) / (1000 * 60 * 60 * 24)), 0)
            : null,
      },
      metrics: {
        totalSales: transactionSummary.totalSales || 0,
        totalTransactions: transactionSummary.totalTransactions || 0,
        totalProfit: transactionSummary.totalProfit || 0,
        totalDebts: debtSummary.outstanding || 0,
        totalDebtsRecorded: debtSummary.totalDebts || 0,
        totalMedicines: medicineSummary.totalMedicines || 0,
        skuCount: medicineSummary.skuCount || 0,
        totalInvoices: invoiceSummary.totalInvoices || 0,
        customerCount: invoiceSummary.customerCount || 0,
        lastTransactionAt: transactionSummary.lastTransactionAt || null,
      },
      monthlyPerformance: monthlyPerformance.map((item) => ({
        month: item.month,
        year: item.year,
        label: `${new Date(item.year, item.month - 1).toLocaleString('default', { month: 'short' })} ${item.year}`,
        totalSales: item.totalSales,
        totalProfit: item.totalProfit,
        transactions: item.transactions,
      })),
      staffUsers,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PATCH /api/admin/pharmacies/:id/reset-password
// @desc    Reset pharmacy user password
// @access  Private (Super Admin)
router.patch(
  '/:id/reset-password',
  [
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { newPassword } = req.body;
      const user = await User.findById(req.params.id);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Update password (will be hashed by pre-save hook)
      user.password = newPassword;
      await user.save();

      res.json({
        message: 'Password reset successfully',
        email: user.email,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// @route   PATCH /api/admin/pharmacies/:id/extend-subscription
// @desc    Extend pharmacy subscription
// @access  Private (Super Admin)
router.patch('/:id/extend-subscription', async (req, res) => {
  try {
    const { days } = req.body;

    if (!days || days <= 0) {
      return res.status(400).json({ message: 'Valid number of days is required' });
    }

    const subscription = await Subscription.findOne({
      user_id: req.params.id,
      status: 'active',
    });

    if (!subscription) {
      return res.status(404).json({ message: 'Active subscription not found' });
    }

    const newEndDate = new Date(subscription.end_at);
    newEndDate.setDate(newEndDate.getDate() + parseInt(days));

    subscription.end_at = newEndDate;
    await subscription.save();

    // Update user subscription end date
    await User.findByIdAndUpdate(req.params.id, {
      'subscription.endDate': newEndDate,
    });

    res.json({
      message: 'Subscription extended successfully',
      subscription,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PATCH /api/admin/pharmacies/:id/trial/extend
// @desc    Extend a pharmacy's trial period
router.patch('/:id/trial/extend', async (req, res) => {
  const { days } = req.body;
  const parsedDays = Number(days);

  if (!parsedDays || Number.isNaN(parsedDays)) {
    return res.status(400).json({ message: 'Days must be a valid number' });
  }

  try {
    const updatedUser = await extendTrialForUser(req.params.id, { days: parsedDays, app: req.app });
    res.json({
      message: 'Trial extended successfully',
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PATCH /api/admin/pharmacies/:id/trial/reset
// @desc    Reset a pharmacy's trial period
router.patch('/:id/trial/reset', async (req, res) => {
  const { days } = req.body;
  const parsedDays = days ? Number(days) : undefined;

  if (parsedDays && Number.isNaN(parsedDays)) {
    return res.status(400).json({ message: 'Days must be a valid number when provided' });
  }

  try {
    const updatedUser = await resetTrialForUser(req.params.id, {
      days: parsedDays,
      app: req.app,
    });
    res.json({
      message: 'Trial reset successfully',
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PATCH /api/admin/pharmacies/:id/trial/expire
// @desc    End a pharmacy's trial immediately
router.patch('/:id/trial/expire', async (req, res) => {
  try {
    const updatedUser = await endTrialImmediately(req.params.id, { app: req.app });
    res.json({
      message: 'Trial ended successfully',
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PATCH /api/admin/pharmacies/:id/status
// @desc    Update pharmacy active status
router.patch('/:id/status', async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive boolean is required' });
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive } },
      { new: true }
    ).select('-password');

    if (!updated) {
      return res.status(404).json({ message: 'Pharmacy not found' });
    }

    res.json({
      message: isActive ? 'Pharmacy activated successfully' : 'Pharmacy suspended successfully',
      pharmacy: updated,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;





