import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { emitUserEvent, emitTenantEvent } from './realtimeService.js';

const sanitize = (doc) => {
  if (!doc) return null;
  const source = doc.toObject ? doc.toObject({ versionKey: false }) : doc;
  return {
    ...source,
    id: source._id?.toString?.(),
  };
};

const buildRecipientFilter = ({ userId, tenantIds = [], includeGlobal = false }) => {
  const or = [];

  if (userId) {
    or.push({ user_id: userId });
  }

  if (Array.isArray(tenantIds) && tenantIds.length > 0) {
    or.push({ tenant_id: { $in: tenantIds } });
  }

  if (includeGlobal) {
    or.push({ user_id: null, tenant_id: null });
  }

  if (or.length === 0) {
    return null;
  }

  return { $or: or };
};

export const createNotification = async ({
  tenantId,
  userId,
  type,
  title,
  message,
  link,
  metadata = {},
  expiresAt,
  sentBy = null,
  status = 'unread',
  app = null,
}) => {
  if (!type || !title || !message) {
    throw new Error('Notification type, title, and message are required');
  }

  const payload = {
    tenant_id: tenantId || null,
    user_id: userId || null,
    type,
    title,
    message,
    link: link || null,
    metadata,
    status,
    sent_by: sentBy,
  };

  if (expiresAt instanceof Date) {
    payload.expires_at = expiresAt;
  }

  const notification = await Notification.create(payload);
  const sanitized = sanitize(notification);

  if (app) {
    if (userId) {
      emitUserEvent(app, userId, 'notifications:new', { notification: sanitized });
    } else if (tenantId) {
      emitTenantEvent(app, tenantId, 'notifications:new', { notification: sanitized });
    } else {
      // Broadcast to all connected clients
      const io = app.get('io');
      if (io) {
        io.emit('notifications:new', { notification: sanitized });
      }
    }
  }

  return sanitized;
};

export const fetchNotifications = async ({
  userId,
  tenantIds = [],
  includeGlobal = false,
  status,
  type,
  page = 1,
  limit = 20,
}) => {
  const filter = buildRecipientFilter({ userId, tenantIds, includeGlobal });
  if (!filter) {
    return { results: [], total: 0, page, pages: 1 };
  }

  const query = { ...filter };

  if (status && ['unread', 'read'].includes(status)) {
    query.status = status;
  }

  if (type) {
    query.type = type;
  }

  const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const currentPage = Math.max(Number(page) || 1, 1);

  const [total, results] = await Promise.all([
    Notification.countDocuments(query),
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize),
  ]);

  return {
    results: results.map(sanitize),
    total,
    page: currentPage,
    pages: Math.max(Math.ceil(total / pageSize), 1),
  };
};

export const markNotificationAsRead = async ({ notificationId, userId, tenantIds = [], includeGlobal = false }) => {
  const filter = buildRecipientFilter({ userId, tenantIds, includeGlobal });
  if (!filter) {
    return null;
  }

  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, ...filter },
    { $set: { status: 'read' } },
    { new: true }
  );

  return sanitize(notification);
};

export const markNotificationsAsRead = async ({ userId, tenantIds = [], includeGlobal = false }) => {
  const filter = buildRecipientFilter({ userId, tenantIds, includeGlobal });
  if (!filter) {
    return { modifiedCount: 0 };
  }

  const result = await Notification.updateMany(
    { ...filter, status: 'unread' },
    { $set: { status: 'read' } }
  );

  return { modifiedCount: result.modifiedCount || 0 };
};

export const deleteNotification = async ({ notificationId, userId, tenantIds = [], includeGlobal = false }) => {
  const filter = buildRecipientFilter({ userId, tenantIds, includeGlobal });
  if (!filter) {
    return { deletedCount: 0 };
  }

  const result = await Notification.deleteOne({ _id: notificationId, ...filter });
  return { deletedCount: result.deletedCount || 0 };
};

const toISO = (value) => (value instanceof Date ? value.toISOString() : value || null);

export const notifyTrialStarted = async (
  app,
  { userId, tenantId = null, trialEnd, daysRemaining }
) => {
  return createNotification({
    app,
    userId,
    tenantId: tenantId || userId,
    type: 'trial_started',
    title: 'Free Trial Activated',
    message: `Welcome! Your 30-day free trial is now active. Enjoy full access to Kulmis Pharmacy.`,
    link: '/dashboard/subscription',
    metadata: {
      trialEnd: toISO(trialEnd),
      daysRemaining,
    },
  });
};

export const notifyTrialExpiringSoon = async (
  app,
  { userId, tenantId = null, daysRemaining, trialEnd }
) => {
  return createNotification({
    app,
    userId,
    tenantId: tenantId || userId,
    type: 'trial_expiring_soon',
    title: 'Free Trial Ending Soon',
    message: `Your free trial ends in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}. Upgrade now to avoid interruption.`,
    link: '/dashboard/subscription',
    metadata: {
      daysRemaining,
      trialEnd: toISO(trialEnd),
    },
  });
};

export const notifyTrialExpired = async (
  app,
  { userId, tenantId = null, trialEnd }
) => {
  return createNotification({
    app,
    userId,
    tenantId: tenantId || userId,
    type: 'trial_expired',
    title: 'Free Trial Expired',
    message: 'Your free trial has ended. Please upgrade your plan to continue using Kulmis Pharmacy.',
    link: '/dashboard/subscription',
    metadata: {
      trialEnd: toISO(trialEnd),
    },
  });
};

const getSuperAdminIds = async () => {
  const admins = await User.find({ role: 'super_admin', isActive: true }).select('_id');
  return admins.map((admin) => admin._id.toString());
};

export const notifySubscriptionRequestPending = async (
  app,
  { requestId, pharmacyName, planName }
) => {
  const superAdmins = await getSuperAdminIds();
  return Promise.all(
    superAdmins.map((adminId) =>
      createNotification({
        app,
        userId: adminId,
        type: 'subscription_pending',
        title: 'New Subscription Request',
        message: `${pharmacyName} submitted an upgrade request for the ${planName} plan.`,
        link: `/dashboard/super-admin/subscriptions?request=${requestId}`,
        metadata: {
          requestId,
          pharmacyName,
          planName,
        },
      })
    )
  );
};

export const notifySubscriptionApproved = async (
  app,
  { userId, planName, endDate }
) => {
  return createNotification({
    app,
    userId,
    type: 'subscription_approved',
    title: 'Subscription Activated',
    message: `Your ${planName} subscription has been approved and is now active.`,
    link: '/dashboard',
    metadata: {
      planName,
      endDate: toISO(endDate),
    },
  });
};

export const notifySubscriptionRejected = async (
  app,
  { userId, planName, reason }
) => {
  return createNotification({
    app,
    userId,
    type: 'subscription_rejected',
    title: 'Subscription Request Declined',
    message: `Your ${planName} subscription request was declined${reason ? `: ${reason}` : '.'}`,
    link: '/dashboard/subscription',
    metadata: {
      planName,
      reason: reason || null,
    },
  });
};


