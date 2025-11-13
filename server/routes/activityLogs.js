import express from 'express';
import ActivityLog from '../models/ActivityLog.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const {
      module,
      action,
      staffId,
      limit = 50,
      since,
    } = req.query;

    const maxLimit = 200;
    const requestedLimit = Number(limit) || 50;
    const pageSize = requestedLimit > maxLimit ? maxLimit : requestedLimit;

    const isSuperAdmin = req.user.role === 'super_admin';
    const isOwner = req.user.role === 'pharmacy_owner';
    const tenantScope = req.tenantScopeIds || [];

    const query = {};

    if (!isSuperAdmin && tenantScope.length > 0) {
      query.tenant_id = { $in: tenantScope };
    }

    if (module && typeof module === 'string') {
      query.module = module;
    }

    if (action && typeof action === 'string') {
      query.action = action;
    }

    if (since) {
      const sinceDate = new Date(since);
      if (!Number.isNaN(sinceDate.getTime())) {
        query.createdAt = { $gte: sinceDate };
      }
    }

    if (staffId) {
      if (isSuperAdmin || isOwner) {
        query.user_id = staffId;
      } else if (req.user._id?.toString() === staffId.toString()) {
        query.user_id = staffId;
      } else {
        return res.status(403).json({
          message: 'You are not allowed to view other staff activity logs.',
        });
      }
    } else if (!isSuperAdmin && req.user.role === 'staff') {
      query.user_id = req.user._id;
    }

    const logs = await ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .limit(pageSize)
      .lean();

    res.json({
      logs,
      count: logs.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;




