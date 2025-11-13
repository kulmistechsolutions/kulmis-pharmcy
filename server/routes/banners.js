import express from 'express';
import Banner from '../models/Banner.js';
import BannerLog from '../models/BannerLog.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// GET /api/banners/active
// Return banners that the current user should see
router.get('/active', protect, async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const now = new Date();

    const banners = await Banner.find({
      status: 'active',
      $or: [{ expiry_date: null }, { expiry_date: { $gt: now } }],
      target_users: { $in: ['all', userId] },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!banners.length) {
      return res.json([]);
    }

    const bannerIds = banners.map((banner) => banner._id);
    const logs = await BannerLog.find({
      user_id: req.user._id,
      banner_id: { $in: bannerIds },
    })
      .lean()
      .then((records) => {
        const map = new Map();
        records.forEach((record) => {
          map.set(record.banner_id.toString(), record);
        });
        return map;
      });

    const visibleBanners = banners.filter((banner) => {
      const log = logs.get(banner._id.toString());
      if (!log) return true;
      if (log.force_hidden) return false;
      if (log.dismissed) return false;
      return true;
    });

    res.json(visibleBanners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/banners/:id/dismiss
// Mark the banner as dismissed for the current user
router.post('/:id/dismiss', protect, async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({ message: 'Banner not found' });
    }

    const log = await BannerLog.findOneAndUpdate(
      { user_id: req.user._id, banner_id: banner._id },
      { dismissed: true, dismissed_at: new Date() },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ message: 'Banner dismissed', log });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;





