import express from 'express';
import { protect, authorize } from '../../middleware/auth.js';
import User from '../../models/User.js';
import { getTrialSettings, updateTrialSettings } from '../../services/trialConfigService.js';

const router = express.Router();

router.use(protect);
router.use(authorize('super_admin'));

router.get('/settings', async (req, res) => {
  try {
    const settings = await getTrialSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const { enabled, durationDays, autoLockBehavior, limitations, defaultPlanId } = req.body;
    const updated = await updateTrialSettings(
      {
        enabled,
        durationDays,
        autoLockBehavior,
        limitations,
        defaultPlanId,
      },
      req.user?._id
    );

    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/overview', async (req, res) => {
  try {
    const settings = await getTrialSettings();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const activeTrials = await User.countDocuments({
      role: 'pharmacy_owner',
      planType: 'trial',
      isTrialExpired: { $ne: true },
      trialEnd: { $gt: now },
    });

    const expiringSoon = await User.countDocuments({
      role: 'pharmacy_owner',
      planType: 'trial',
      isTrialExpired: { $ne: true },
      trialEnd: { $gt: now },
      $expr: {
        $lte: [
          {
            $divide: [{ $subtract: ['$trialEnd', now] }, 1000 * 60 * 60 * 24],
          },
          5,
        ],
      },
    });

    const expiredToday = await User.countDocuments({
      role: 'pharmacy_owner',
      planType: 'trial',
      isTrialExpired: true,
      trialEnd: { $gte: todayStart, $lte: todayEnd },
    });

    res.json({
      settings,
      summary: {
        activeTrials,
        expiringSoon,
        expiredToday,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const now = new Date();
    const query = {
      role: 'pharmacy_owner',
      planType: 'trial',
    };

    if (status === 'expired') {
      query.isTrialExpired = true;
    }

    const users = await User.find(query)
      .select('pharmacyName email phone trialStart trialEnd trialDaysGranted isTrialExpired subscriptionStatus')
      .sort({ trialEnd: 1 });

    const results = [];
    for (const user of users) {
      const trialEnd = user.trialEnd ? new Date(user.trialEnd) : null;
      const daysRemaining = trialEnd ? Math.max(Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)), 0) : null;
      let trialStatus = 'unknown';

      if (user.isTrialExpired) {
        trialStatus = 'expired';
      } else if (daysRemaining !== null && daysRemaining <= 5) {
        trialStatus = 'expiring';
      } else {
        trialStatus = 'active';
      }

      if (status && status !== 'all' && trialStatus !== status) {
        continue;
      }

      results.push({
        id: user._id,
        pharmacyName: user.pharmacyName,
        email: user.email,
        phone: user.phone,
        trialStart: user.trialStart,
        trialEnd: user.trialEnd,
        trialDaysGranted: user.trialDaysGranted,
        daysRemaining,
        isTrialExpired: user.isTrialExpired,
        trialStatus,
        subscriptionStatus: user.subscriptionStatus,
      });
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;

