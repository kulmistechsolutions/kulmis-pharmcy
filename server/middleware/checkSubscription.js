import User from '../models/User.js';
import { getTrialSettings } from '../services/trialConfigService.js';

// @desc    Check if user has active subscription
// @access  Private
export const checkSubscription = async (req, res, next) => {
  try {
    const user = req.user;

    // Super admins don't need subscription
    if (user.role === 'super_admin') {
      req.subscriptionStatus = {
        hasActiveSubscription: true,
        isExpired: false,
        daysRemaining: null,
        daysUntilExpiry: null,
        isTrial: false,
        isTrialExpired: false,
        planType: user.planType || null,
        subscriptionStatus: user.subscriptionStatus || 'active',
      };
      return next();
    }

    const now = new Date();

    const trialEnd = user.trialEnd ? new Date(user.trialEnd) : null;
    const trialDaysRemaining = trialEnd ? Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)) : null;
    const trialActive =
      user.planType === 'trial' &&
      !user.isTrialExpired &&
      trialEnd &&
      trialDaysRemaining !== null &&
      trialDaysRemaining > 0;

    const subscriptionEnd = user.subscription?.endDate ? new Date(user.subscription.endDate) : null;
    const subscriptionDaysRemaining = subscriptionEnd
      ? Math.ceil((subscriptionEnd - now) / (1000 * 60 * 60 * 24))
      : null;
    const paidActive =
      user.planType === 'paid' &&
      user.subscriptionStatus === 'active' &&
      subscriptionEnd &&
      subscriptionDaysRemaining !== null &&
      subscriptionDaysRemaining > 0;

    let hasActiveSubscription = trialActive || paidActive;
    let isExpired = !hasActiveSubscription;
    let daysRemaining = trialActive
      ? trialDaysRemaining
      : paidActive
      ? subscriptionDaysRemaining
      : 0;

    if (paidActive && subscriptionDaysRemaining !== null && subscriptionDaysRemaining <= 0) {
      hasActiveSubscription = false;
      isExpired = true;
    }

    if (trialEnd && trialDaysRemaining !== null && trialDaysRemaining <= 0 && !user.isTrialExpired) {
      hasActiveSubscription = false;
      isExpired = true;
    }

    let autoLockBehavior = 'lock';
    if (user.planType === 'trial') {
      try {
        const settings = await getTrialSettings();
        autoLockBehavior = settings?.freeTrial?.autoLockBehavior || 'lock';
      } catch (settingsError) {
        console.error('Failed to load trial settings for subscription check:', settingsError);
      }
    }

    req.subscriptionStatus = {
      hasActiveSubscription,
      isExpired: isExpired,
      daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
      daysUntilExpiry: daysRemaining,
      isExpiringSoon: daysRemaining > 0 && daysRemaining <= 3,
      endDate: trialActive ? trialEnd : subscriptionEnd,
      plan: user.subscription?.plan || (trialActive ? 'trial' : null),
      isTrial: user.planType === 'trial',
      isTrialExpired: !!user.isTrialExpired,
      planType: user.planType || null,
      subscriptionStatus: user.subscriptionStatus || (trialActive ? 'trial' : 'expired'),
      trialDaysRemaining: trialDaysRemaining !== null ? Math.max(trialDaysRemaining, 0) : null,
      subscriptionDaysRemaining:
        subscriptionDaysRemaining !== null ? Math.max(subscriptionDaysRemaining, 0) : null,
      autoLockBehavior,
    };

    next();
  } catch (error) {
    console.error('Error checking subscription:', error);
    req.subscriptionStatus = {
      hasActiveSubscription: false,
      isExpired: true,
      daysRemaining: 0,
      daysUntilExpiry: 0,
    };
    next();
  }
};

// @desc    Block access if subscription is expired (use after checkSubscription)
// @access  Private
export const requireActiveSubscription = (req, res, next) => {
  const status = req.subscriptionStatus;

  if (!status.hasActiveSubscription || status.isExpired) {
    if (status.isTrial && status.autoLockBehavior === 'notice') {
      req.subscriptionStatus = {
        ...status,
        requiresUpgrade: true,
        showUpgradeNotice: true,
      };
      return next();
    }

    return res.status(403).json({
      message: status.isTrial
        ? 'Your free trial has expired. Please upgrade your plan to continue.'
        : 'Your subscription has expired. Please upgrade to continue.',
      subscriptionStatus: status,
      requiresUpgrade: true,
    });
  }

  next();
};




