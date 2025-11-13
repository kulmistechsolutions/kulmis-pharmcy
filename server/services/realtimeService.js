import ActivityLog from '../models/ActivityLog.js';

const toMap = (metadata = {}) => {
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }
  return metadata;
};

export const emitTenantEvent = (app, tenantId, event, payload) => {
  const io = app.get('io');
  const rooms = app.get('socketRooms');
  if (!io || !rooms || !tenantId) return;

  io.to(rooms.tenantRoom(tenantId.toString())).emit(event, payload);
};

export const emitUserEvent = (app, userId, event, payload) => {
  const io = app.get('io');
  const rooms = app.get('socketRooms');
  if (!io || !rooms || !userId) return;

  io.to(rooms.userRoom(userId.toString())).emit(event, payload);
};

export const createActivityLog = async ({
  tenantId,
  userId,
  userName,
  userRole,
  module,
  action,
  message,
  amount = 0,
  metadata = {},
}) => {
  if (!tenantId || !userId || !module || !action || !message) {
    return null;
  }

  const log = await ActivityLog.create({
    tenant_id: tenantId,
    user_id: userId,
    user_name: userName || 'Team Member',
    user_role: userRole || 'staff',
    module,
    action,
    message,
    amount,
    metadata: toMap(metadata),
  });

  return log;
};




