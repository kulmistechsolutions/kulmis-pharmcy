import express from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import { getTrialSettings } from '../services/trialConfigService.js';
import { startTrialForUser } from '../services/subscriptionTrialService.js';

const router = express.Router();

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post(
  '/register',
  [
    body('pharmacyName').trim().notEmpty().withMessage('Pharmacy name is required'),
    body('email').isEmail().withMessage('Please include a valid email'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { pharmacyName, email, phone, password } = req.body;

      // Check if user exists
      const userExists = await User.findOne({ $or: [{ email }, { phone }] });
      if (userExists) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Create user
      const user = await User.create({
        pharmacyName,
        email,
        phone,
        password,
      });

      let hydratedUser = user;
      let trialBehavior = 'lock';

      // Automatically create configurable free trial for new pharmacy owners if enabled
      if (user.role === 'pharmacy_owner') {
        try {
          const settings = await getTrialSettings();
          if (settings?.freeTrial?.autoLockBehavior) {
            trialBehavior = settings.freeTrial.autoLockBehavior;
          }
          if (settings?.freeTrial?.enabled) {
            hydratedUser = await startTrialForUser(user._id, { app: req.app });
          } else {
            hydratedUser = await User.findByIdAndUpdate(
              user._id,
              {
                planType: 'trial',
                isTrialExpired: true,
                subscriptionStatus: 'expired',
                subscription: {
                  plan: null,
                  startDate: null,
                  endDate: null,
                  status: 'expired',
                },
              },
              { new: true }
            );
          }
        } catch (trialError) {
          console.error('Failed to initialize trial during registration:', trialError);
        }
      }

      const token = generateToken(hydratedUser._id);

      res.status(201).json({
        _id: hydratedUser._id,
        pharmacyName: hydratedUser.pharmacyName,
        email: hydratedUser.email,
        phone: hydratedUser.phone,
        role: hydratedUser.role,
        permissions: hydratedUser.permissions || [],
        planType: hydratedUser.planType,
        trialStart: hydratedUser.trialStart,
        trialEnd: hydratedUser.trialEnd,
        trialDaysGranted: hydratedUser.trialDaysGranted,
        isTrialExpired: hydratedUser.isTrialExpired,
        subscriptionStatus: hydratedUser.subscriptionStatus,
        subscription: hydratedUser.subscription,
        trialAutoLockBehavior: trialBehavior,
        token,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post(
  '/login',
  [
    body('email').optional().isEmail().withMessage('Please include a valid email'),
    body('phone').optional().trim().notEmpty(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, phone, password } = req.body;

      if (!email && !phone) {
        return res.status(400).json({ message: 'Please provide email or phone' });
      }

      // Find user by email or phone
      const user = await User.findOne(email ? { email } : { phone });
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Check password
      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      let hydratedUser = user;
      let trialBehavior = 'lock';

      if (
        user.planType === 'trial' &&
        user.trialEnd &&
        new Date(user.trialEnd).getTime() <= Date.now() &&
        !user.isTrialExpired
      ) {
        hydratedUser = await User.findByIdAndUpdate(
          user._id,
          {
            $set: {
              isTrialExpired: true,
              subscriptionStatus: 'expired',
              'subscription.status': 'expired',
            },
          },
          { new: true }
        );
      }

      if (hydratedUser.planType === 'trial') {
        try {
          const settings = await getTrialSettings();
          if (settings?.freeTrial?.autoLockBehavior) {
            trialBehavior = settings.freeTrial.autoLockBehavior;
          }
        } catch (configError) {
          console.error('Failed to load trial settings during login:', configError);
        }
      }

      const token = generateToken(user._id);

      res.json({
        _id: hydratedUser._id,
        pharmacyName: hydratedUser.pharmacyName,
        email: hydratedUser.email,
        phone: hydratedUser.phone,
        role: hydratedUser.role,
        permissions: hydratedUser.permissions || [],
        planType: hydratedUser.planType,
        trialStart: hydratedUser.trialStart,
        trialEnd: hydratedUser.trialEnd,
        trialDaysGranted: hydratedUser.trialDaysGranted,
        isTrialExpired: hydratedUser.isTrialExpired,
        subscriptionStatus: hydratedUser.subscriptionStatus,
        subscriptionPlanId: hydratedUser.subscriptionPlanId,
        subscription: hydratedUser.subscription,
        trialAutoLockBehavior: trialBehavior,
        token,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    let trialBehavior;
    if (user.planType === 'trial') {
      try {
        const settings = await getTrialSettings();
        trialBehavior = settings?.freeTrial?.autoLockBehavior || 'lock';
      } catch (settingsError) {
        console.error('Failed to load trial settings for /auth/me:', settingsError);
        trialBehavior = 'lock';
      }
    }

    res.json({
      _id: user._id,
      pharmacyName: user.pharmacyName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      permissions: user.permissions || [],
      subscription: user.subscription,
      isActive: user.isActive,
      createdAt: user.createdAt,
      planType: user.planType,
      trialStart: user.trialStart,
      trialEnd: user.trialEnd,
      trialDaysGranted: user.trialDaysGranted,
      isTrialExpired: user.isTrialExpired,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionPlanId: user.subscriptionPlanId,
      trialReminderSentAt: user.trialReminderSentAt,
      trialExpiredNotifiedAt: user.trialExpiredNotifiedAt,
      trialAutoLockBehavior: trialBehavior,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;

