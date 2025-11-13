import express from 'express';
import PaymentRequest from '../../models/PaymentRequest.js';
import Subscription from '../../models/Subscription.js';
import Plan from '../../models/Plan.js';
import User from '../../models/User.js';
import { protect, authorize } from '../../middleware/auth.js';
import {
  notifySubscriptionApproved,
  notifySubscriptionRejected,
} from '../../services/notificationService.js';

const router = express.Router();

// All routes require super_admin
router.use(protect);
router.use(authorize('super_admin'));

// @route   GET /api/admin/subscriptions/requests
// @desc    Get all payment requests (with optional status filter)
// @access  Private (Super Admin)
router.get('/requests', async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};

    const requests = await PaymentRequest.find(query)
      .populate('user_id', 'pharmacyName email phone')
      .populate('plan_id', 'name duration_days price')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/admin/subscriptions/active
// @desc    Get all active subscriptions
// @access  Private (Super Admin)
router.get('/active', async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ status: 'active' })
      .populate('user_id', 'pharmacyName email phone')
      .populate('plan_id', 'name duration_days price')
      .sort({ end_at: 1 });

    // Calculate days remaining for each subscription
    const subscriptionsWithDays = subscriptions.map((sub) => {
      const now = new Date();
      const endDate = new Date(sub.end_at);
      const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

      return {
        ...sub.toObject(),
        daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
      };
    });

    res.json(subscriptionsWithDays);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PATCH /api/admin/subscriptions/:id/approve
// @desc    Approve subscription request
// @access  Private (Super Admin)
router.patch('/:id/approve', async (req, res) => {
  try {
    const paymentRequest = await PaymentRequest.findById(req.params.id)
      .populate('plan_id');

    if (!paymentRequest) {
      return res.status(404).json({ message: 'Payment request not found' });
    }

    if (paymentRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Request is not pending' });
    }

    const plan = paymentRequest.plan_id;
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.duration_days);

    // Create subscription
    const subscription = await Subscription.create({
      user_id: paymentRequest.user_id,
      plan_id: paymentRequest.plan_id,
      price_paid: paymentRequest.amount,
      start_at: startDate,
      end_at: endDate,
      status: 'active',
      payment_request_id: paymentRequest._id,
    });

    // Map plan name to user subscription enum
    const planNameMap = {
      'Monthly': 'monthly',
      '3-Month': 'quarterly',
      'Quarterly': 'quarterly',
      '6-Month': 'semiannual',
      'Semi-Annual': 'semiannual',
      'Semiannual': 'semiannual',
      'Yearly': 'yearly',
      'Annual': 'yearly',
      'Lifetime': 'lifetime',
    };
    const mappedPlan = planNameMap[plan.name] || plan.name.toLowerCase().replace(/\s+/g, '_');

    await User.findByIdAndUpdate(paymentRequest.user_id, {
      $set: {
        'subscription.plan': mappedPlan,
        'subscription.startDate': startDate,
        'subscription.endDate': endDate,
        'subscription.status': 'active',
        planType: 'paid',
        subscriptionStatus: 'active',
        subscriptionPlanId: plan._id,
        isTrialExpired: true,
      },
    });

    // Update payment request
    paymentRequest.status = 'approved';
    paymentRequest.approved_by = req.user._id;
    paymentRequest.approved_at = new Date();
    await paymentRequest.save();

    try {
      await notifySubscriptionApproved(req.app, {
        userId: paymentRequest.user_id.toString(),
        planName: plan.name,
        endDate,
      });
    } catch (notifyError) {
      console.error('Failed to send subscription approval notification:', notifyError);
    }

    res.json({
      message: 'Subscription approved successfully',
      subscription,
      paymentRequest,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PATCH /api/admin/subscriptions/:id/reject
// @desc    Reject subscription request
// @access  Private (Super Admin)
router.patch('/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const paymentRequest = await PaymentRequest.findById(req.params.id).populate('plan_id', 'name');

    if (!paymentRequest) {
      return res.status(404).json({ message: 'Payment request not found' });
    }

    if (paymentRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Request is not pending' });
    }

    paymentRequest.status = 'rejected';
    paymentRequest.rejection_reason = reason || 'No reason provided';
    paymentRequest.approved_by = req.user._id;
    paymentRequest.approved_at = new Date();
    await paymentRequest.save();

    const rejectionUser = await User.findById(paymentRequest.user_id);
    const fallbackStatus =
      rejectionUser && rejectionUser.planType === 'trial' && !rejectionUser.isTrialExpired
        ? 'trial'
        : 'expired';

    await User.findByIdAndUpdate(paymentRequest.user_id, {
      $set: {
        subscriptionStatus: fallbackStatus,
        subscriptionPlanId: null,
      },
    });

    try {
      await notifySubscriptionRejected(req.app, {
        userId: paymentRequest.user_id.toString(),
        planName: paymentRequest.plan_id?.name || 'selected plan',
        reason: paymentRequest.rejection_reason,
      });
    } catch (notifyError) {
      console.error('Failed to send subscription rejection notification:', notifyError);
    }

    res.json({ message: 'Subscription request rejected', paymentRequest });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PATCH /api/admin/subscriptions/:id/extend
// @desc    Extend subscription expiry date
// @access  Private (Super Admin)
router.patch('/:id/extend', async (req, res) => {
  try {
    const { days } = req.body;

    if (!days || days <= 0) {
      return res.status(400).json({ message: 'Valid number of days is required' });
    }

    const subscription = await Subscription.findById(req.params.id)
      .populate('user_id');

    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    const newEndDate = new Date(subscription.end_at);
    newEndDate.setDate(newEndDate.getDate() + parseInt(days));

    subscription.end_at = newEndDate;
    await subscription.save();

    // Update user subscription end date
    await User.findByIdAndUpdate(subscription.user_id._id, {
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

export default router;

