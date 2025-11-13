import express from 'express';
import {
  createNotification,
  deleteNotification,
  fetchNotifications,
  markNotificationAsRead,
  markNotificationsAsRead,
} from '../services/notificationService.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const userId = req.user?._id?.toString?.() || req.user?.id?.toString?.();
    const tenantIds = req.tenantScopeIds || [];
    const includeGlobal = req.user?.role === 'super_admin';

    const { status, type, page, limit } = req.query;

    const data = await fetchNotifications({
      userId,
      tenantIds,
      includeGlobal,
      status,
      type,
      page,
      limit,
    });

    res.json(data);
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    res.status(500).json({ message: error.message || 'Failed to load notifications.' });
  }
});

router.patch('/:id/read', protect, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user?._id?.toString?.() || req.user?.id?.toString?.();
    const tenantIds = req.tenantScopeIds || [];
    const includeGlobal = req.user?.role === 'super_admin';

    const notification = await markNotificationAsRead({
      notificationId,
      userId,
      tenantIds,
      includeGlobal,
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    res.json(notification);
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    res.status(500).json({ message: error.message || 'Failed to update notification.' });
  }
});

router.patch('/mark-all/read', protect, async (req, res) => {
  try {
    const userId = req.user?._id?.toString?.() || req.user?.id?.toString?.();
    const tenantIds = req.tenantScopeIds || [];
    const includeGlobal = req.user?.role === 'super_admin';

    const result = await markNotificationsAsRead({
      userId,
      tenantIds,
      includeGlobal,
    });

    res.json(result);
  } catch (error) {
    console.error('Failed to mark notifications as read:', error);
    res.status(500).json({ message: error.message || 'Failed to update notifications.' });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user?._id?.toString?.() || req.user?.id?.toString?.();
    const tenantIds = req.tenantScopeIds || [];
    const includeGlobal = req.user?.role === 'super_admin';

    const result = await deleteNotification({
      notificationId,
      userId,
      tenantIds,
      includeGlobal,
    });

    if (!result.deletedCount) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete notification:', error);
    res.status(500).json({ message: error.message || 'Failed to delete notification.' });
  }
});

router.post('/broadcast', protect, authorize('super_admin'), async (req, res) => {
  try {
    const { targetPharmacyId, type, title, message, link, expiresAt } = req.body;

    if (!title || !message || !type) {
      return res.status(400).json({ message: 'Type, title, and message are required.' });
    }

    const payload = {
      tenantId: targetPharmacyId || null,
      userId: null,
      type,
      title,
      message,
      link,
      sentBy: req.user?.email || 'System',
      app: req.app,
    };

    if (expiresAt) {
      payload.expiresAt = new Date(expiresAt);
    }

    const notification = await createNotification(payload);
    res.status(201).json(notification);
  } catch (error) {
    console.error('Failed to broadcast notification:', error);
    res.status(500).json({ message: error.message || 'Failed to create notification.' });
  }
});

export default router;




