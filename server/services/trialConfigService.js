import SubscriptionSetting from '../models/SubscriptionSetting.js';
import Plan from '../models/Plan.js';

const TRIAL_SETTINGS_CACHE = {
  data: null,
  fetchedAt: null,
};

const CACHE_TTL_MS = 60 * 1000; // 1 minute

const getCachedSettings = () => {
  if (!TRIAL_SETTINGS_CACHE.data) return null;
  if (!TRIAL_SETTINGS_CACHE.fetchedAt) return null;
  if (Date.now() - TRIAL_SETTINGS_CACHE.fetchedAt > CACHE_TTL_MS) {
    TRIAL_SETTINGS_CACHE.data = null;
    TRIAL_SETTINGS_CACHE.fetchedAt = null;
    return null;
  }
  return TRIAL_SETTINGS_CACHE.data;
};

const setCachedSettings = (settings) => {
  TRIAL_SETTINGS_CACHE.data = settings;
  TRIAL_SETTINGS_CACHE.fetchedAt = Date.now();
};

export const getTrialSettings = async () => {
  const cached = getCachedSettings();
  if (cached) return cached;

  const settings = await SubscriptionSetting.getSettings();
  setCachedSettings(settings);
  return settings;
};

export const updateTrialSettings = async ({ enabled, durationDays, autoLockBehavior, limitations, defaultPlanId }, updatedBy) => {
  const payload = {};

  if (typeof enabled === 'boolean') {
    payload['freeTrial.enabled'] = enabled;
  }

  if (typeof durationDays === 'number' && !Number.isNaN(durationDays)) {
    payload['freeTrial.defaultDurationDays'] = Math.max(durationDays, 1);
  }

  if (autoLockBehavior && ['lock', 'notice'].includes(autoLockBehavior)) {
    payload['freeTrial.autoLockBehavior'] = autoLockBehavior;
  }

  if (defaultPlanId) {
    const plan = await Plan.findById(defaultPlanId);
    if (!plan) {
      throw new Error('Default trial plan not found');
    }
    if (plan.planType !== 'trial') {
      throw new Error('Selected plan is not marked as a trial plan');
    }
    payload['freeTrial.defaultPlan'] = plan._id;
  } else if (defaultPlanId === null) {
    payload['freeTrial.defaultPlan'] = null;
  }

  if (limitations) {
    const limitsPayload = {};
    if ('maxInvoices' in limitations) {
      limitsPayload['freeTrial.limitations.maxInvoices'] =
        limitations.maxInvoices === null ? null : Math.max(Number(limitations.maxInvoices), 0);
    }
    if ('maxMedicines' in limitations) {
      limitsPayload['freeTrial.limitations.maxMedicines'] =
        limitations.maxMedicines === null ? null : Math.max(Number(limitations.maxMedicines), 0);
    }
    if ('maxLabRecords' in limitations) {
      limitsPayload['freeTrial.limitations.maxLabRecords'] =
        limitations.maxLabRecords === null ? null : Math.max(Number(limitations.maxLabRecords), 0);
    }
    Object.assign(payload, limitsPayload);
  }

  payload.updatedBy = updatedBy || null;

  const updated = await SubscriptionSetting.findOneAndUpdate({}, { $set: payload }, { new: true, upsert: true })
    .populate({ path: 'freeTrial.defaultPlan', select: 'name duration_days planType status' })
    .lean();

  setCachedSettings(updated);

  if (defaultPlanId) {
    await Plan.updateMany(
      { planType: 'trial' },
      { $set: { isDefaultTrial: false } }
    );
    await Plan.findByIdAndUpdate(defaultPlanId, { $set: { isDefaultTrial: true } });
  }

  return updated;
};

export const ensureTrialPlanDefaults = async () => {
  const settings = await getTrialSettings();

  if (!settings.freeTrial.defaultPlan) {
    const defaultPlan = await Plan.findOne({ planType: 'trial', isDefaultTrial: true });
    if (defaultPlan) {
      await updateTrialSettings({ defaultPlanId: defaultPlan._id }, null);
      return;
    }

    const fallbackPlan =
      (await Plan.findOne({ planType: 'trial' })) ||
      (await Plan.create({
        name: 'Free Trial',
        duration_days: settings.freeTrial.defaultDurationDays || 30,
        price: 0,
        discount: 0,
        status: 'active',
        description: 'Default Kulmis free trial plan',
        planType: 'trial',
        autoLockBehavior: 'lock',
        isDefaultTrial: true,
      }));

    await updateTrialSettings({ defaultPlanId: fallbackPlan._id }, null);
  }
};


