import User from '../models/User.js';
import {
  notifyTrialExpiringSoon,
  notifyTrialExpired,
  notifyTrialStarted,
} from './notificationService.js';
import { ensureTrialPlanDefaults, getTrialSettings } from './trialConfigService.js';

const ENV_FALLBACK_TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 30);
const REMINDER_THRESHOLD_DAYS = Number(process.env.TRIAL_REMINDER_DAYS || 3);

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const resolveTrialDays = async (fallback) => {
  if (typeof fallback === 'number' && !Number.isNaN(fallback) && fallback > 0) {
    return fallback;
  }
  const settings = await getTrialSettings();
  return settings?.freeTrial?.defaultDurationDays || ENV_FALLBACK_TRIAL_DAYS;
};

const calculateDaysRemaining = (endDate) => {
  if (!endDate) return 0;
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const normalizeTrialFields = (user, { startDate, endDate, days, statusOverride }) => {
  return {
    planType: 'trial',
    trialStart: startDate,
    trialEnd: endDate,
    trialDaysGranted: days,
    isTrialExpired: statusOverride === 'expired' ? true : false,
    subscriptionStatus: statusOverride || 'trial',
    subscriptionPlanId: null,
    trialReminderSentAt: statusOverride === 'expired' ? user.trialReminderSentAt : null,
    trialExpiredNotifiedAt: statusOverride === 'expired' ? new Date() : null,
    subscription: {
      plan: 'trial',
      startDate,
      endDate,
      status: statusOverride || 'trial',
    },
  };
};

export const startTrialForUser = async (userId, { days, app } = {}) => {
  const trialDays = await resolveTrialDays(days);
  await ensureTrialPlanDefaults();
  const settings = await getTrialSettings();

  const startDate = new Date();
  const endDate = addDays(startDate, trialDays);

  const update = normalizeTrialFields(
    {},
    { startDate, endDate, days: trialDays, statusOverride: 'trial' }
  );

  if (settings?.freeTrial?.defaultPlan) {
    update.subscriptionPlanId = settings.freeTrial.defaultPlan._id || settings.freeTrial.defaultPlan;
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: update },
    { new: true, runValidators: true }
  );

  if (user && app) {
    await notifyTrialStarted(app, {
      userId: user._id,
      tenantId: user._id,
      trialEnd: endDate,
      daysRemaining: trialDays,
    });
  }

  return user;
};

export const extendTrialForUser = async (userId, { days, app }) => {
  if (!days || Number.isNaN(days) || Number(days) === 0) {
    throw new Error('Days must be a non-zero number');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const baseStart = user.trialStart || new Date();
  const defaultDuration = await resolveTrialDays(user.trialDaysGranted || ENV_FALLBACK_TRIAL_DAYS);
  const baseEnd = user.trialEnd || addDays(baseStart, defaultDuration);
  const updatedEnd = addDays(baseEnd, Number(days));

  const update = normalizeTrialFields(user, {
    startDate: baseStart,
    endDate: updatedEnd,
    days: (user.trialDaysGranted || defaultDuration) + Number(days),
    statusOverride: updatedEnd > new Date() ? 'trial' : 'expired',
  });

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $set: update },
    { new: true, runValidators: true }
  );

  if (updatedUser && app && updatedEnd > new Date()) {
    const daysRemaining = calculateDaysRemaining(updatedEnd);
    if (daysRemaining <= REMINDER_THRESHOLD_DAYS) {
      await notifyTrialExpiringSoon(app, {
        userId: updatedUser._id,
        tenantId: updatedUser._id,
        daysRemaining,
        trialEnd: updatedEnd,
      });
    }
  }

  return updatedUser;
};

export const endTrialImmediately = async (userId, { app } = {}) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const endDate = user.trialEnd ? new Date(user.trialEnd) : new Date();

  const update = normalizeTrialFields(user, {
    startDate: user.trialStart || addDays(endDate, -ENV_FALLBACK_TRIAL_DAYS),
    endDate,
    days: user.trialDaysGranted || (await resolveTrialDays()),
    statusOverride: 'expired',
  });

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $set: update },
    { new: true, runValidators: true }
  );

  if (updatedUser && app) {
    await notifyTrialExpired(app, {
      userId: updatedUser._id,
      tenantId: updatedUser._id,
      trialEnd: endDate,
    });
  }

  return updatedUser;
};

export const resetTrialForUser = async (userId, { days = DEFAULT_TRIAL_DAYS, app } = {}) => {
  return startTrialForUser(userId, { days, app });
};

export const runTrialSweep = async (app) => {
  const now = new Date();

  const activeTrials = await User.find({
    role: 'pharmacy_owner',
    planType: 'trial',
    isTrialExpired: { $ne: true },
    trialEnd: { $exists: true },
  }).select([
    '_id',
    'trialStart',
    'trialEnd',
    'trialReminderSentAt',
    'trialExpiredNotifiedAt',
    'trialDaysGranted',
  ]);

  for (const user of activeTrials) {
    const trialEnd = user.trialEnd ? new Date(user.trialEnd) : null;
    if (!trialEnd) continue;

    const daysRemaining = calculateDaysRemaining(trialEnd);

    if (daysRemaining <= 0) {
      const update = normalizeTrialFields(user, {
        startDate: user.trialStart || addDays(trialEnd, -ENV_FALLBACK_TRIAL_DAYS),
        endDate: trialEnd,
        days: user.trialDaysGranted || (await resolveTrialDays()),
        statusOverride: 'expired',
      });

      await User.findByIdAndUpdate(
        user._id,
        { $set: update },
        { runValidators: false }
      );

      if (!user.trialExpiredNotifiedAt && app) {
        await notifyTrialExpired(app, {
          userId: user._id,
          tenantId: user._id,
          trialEnd,
        });
      }
      continue;
    }

    if (
      daysRemaining <= REMINDER_THRESHOLD_DAYS &&
      (!user.trialReminderSentAt ||
        new Date(user.trialReminderSentAt).getTime() < trialEnd.getTime())
    ) {
      await User.findByIdAndUpdate(
        user._id,
        { $set: { trialReminderSentAt: now } },
        { runValidators: false }
      );

      if (app) {
        await notifyTrialExpiringSoon(app, {
          userId: user._id,
          tenantId: user._id,
          daysRemaining,
          trialEnd,
        });
      }
    }
  }
};


