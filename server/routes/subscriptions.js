import express from 'express';
import { body, validationResult } from 'express-validator';
import PaymentRequest from '../models/PaymentRequest.js';
import Plan from '../models/Plan.js';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import { notifySubscriptionRequestPending } from '../services/notificationService.js';

const router = express.Router();

// @route   POST /api/subscriptions/request
// @desc    Request a subscription plan change/upgrade
// @access  Private (Pharmacy Owner)
router.post(
  '/request',
  protect,
  [
    body('plan_id').notEmpty().withMessage('Plan ID is required'),
    body('method').trim().notEmpty().withMessage('Payment method is required'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be positive'),
    body('sender_number').optional().trim(),
    body('proof_url').optional().trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { plan_id, method, sender_number, amount, proof_url } = req.body;
      const user = req.user;

      // Verify plan exists and is active
      const plan = await Plan.findById(plan_id);
      if (!plan) {
        return res.status(404).json({ message: 'Plan not found' });
      }

      if (plan.status !== 'active') {
        return res.status(400).json({ message: 'This plan is not currently available' });
      }

      // Calculate expected price (with discount)
      const finalPrice = plan.price * (1 - (plan.discount || 0) / 100);
      
      // Verify amount matches (allow small variance)
      if (Math.abs(amount - finalPrice) > 0.01) {
        return res.status(400).json({ 
          message: `Amount mismatch. Expected: $${finalPrice.toFixed(2)}, Received: $${amount.toFixed(2)}` 
        });
      }

      // Normalize payment method name to match enum values (case-insensitive matching)
      const methodLower = method.trim().toLowerCase();
      let normalizedMethod;
      
      if (methodLower === 'evc plus' || methodLower === 'evcplus') {
        normalizedMethod = 'EVC PLUS';
      } else if (methodLower === 'edahab') {
        normalizedMethod = 'EDAHAB';
      } else if (methodLower === 'mobile money' || methodLower === 'mobilemoney') {
        normalizedMethod = 'Mobile Money';
      } else if (methodLower === 'bank transfer' || methodLower === 'banktransfer') {
        normalizedMethod = 'Bank Transfer';
      } else if (methodLower === 'cash') {
        normalizedMethod = 'Cash';
      } else {
        normalizedMethod = 'Other';
      }

      // Create payment request
      const paymentRequest = await PaymentRequest.create({
        user_id: user._id,
        plan_id: plan._id,
        method: normalizedMethod,
        sender_number,
        amount,
        proof_url,
        status: 'pending',
      });

      // Populate plan details in response
      await paymentRequest.populate('plan_id', 'name duration_days price discount');

      await User.findByIdAndUpdate(user._id, {
        $set: {
          subscriptionStatus: 'pending',
          subscriptionPlanId: plan._id,
        },
      });

      try {
        await notifySubscriptionRequestPending(req.app, {
          requestId: paymentRequest._id.toString(),
          pharmacyName: user.pharmacyName,
          planName: plan.name,
        });
      } catch (notifyError) {
        console.error('Failed to send subscription pending notification:', notifyError);
      }

      res.status(201).json({
        message: 'Subscription request submitted successfully. Waiting for admin approval.',
        paymentRequest,
      });
    } catch (error) {
      console.error('❌ Error in POST /api/subscriptions/request:', error);
      res.status(500).json({ message: error.message });
    }
  }
);

// @route   GET /api/subscriptions/my-requests
// @desc    Get current user's subscription requests
// @access  Private
router.get('/my-requests', protect, async (req, res) => {
  try {
    const requests = await PaymentRequest.find({ user_id: req.user._id })
      .populate('plan_id', 'name duration_days price discount')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('❌ Error in GET /api/subscriptions/my-requests:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
