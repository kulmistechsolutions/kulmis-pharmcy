import express from 'express';
import Banner from '../../models/Banner.js';
import BannerLog from '../../models/BannerLog.js';
import { protect, authorize } from '../../middleware/auth.js';
import { getImageKit, hasImageKitConfig } from '../../utils/imagekit.js';

const router = express.Router();

router.use(protect);
router.use(authorize('super_admin'));

// GET /api/admin/banners - list all banners with stats
router.get('/', async (req, res) => {
  try {
    const banners = await Banner.find()
      .sort({ createdAt: -1 })
      .lean();

    if (!banners.length) {
      return res.json([]);
    }

    const bannerIds = banners.map((banner) => banner._id);
    const stats = await BannerLog.aggregate([
      { $match: { banner_id: { $in: bannerIds } } },
      {
        $group: {
          _id: '$banner_id',
          views: { $sum: 1 },
          dismissed: {
            $sum: {
              $cond: [{ $eq: ['$dismissed', true] }, 1, 0],
            },
          },
          forceHidden: {
            $sum: {
              $cond: [{ $eq: ['$force_hidden', true] }, 1, 0],
            },
          },
        },
      },
    ]);

    const statsMap = new Map();
    stats.forEach((stat) => {
      statsMap.set(stat._id.toString(), {
        views: stat.views,
        dismissed: stat.dismissed,
        forceHidden: stat.forceHidden,
      });
    });

    const payload = banners.map((banner) => ({
      ...banner,
      stats: statsMap.get(banner._id.toString()) || { views: 0, dismissed: 0, forceHidden: 0 },
    }));

    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/admin/banners - create banner
router.post('/', async (req, res) => {
  try {
    const { title, message, image_url, target_users, status = 'active', expiry_date = null } = req.body;

    if (!title || !message || !image_url) {
      return res.status(400).json({ message: 'Title, message and image_url are required' });
    }

    const banner = await Banner.create({
      title,
      message,
      image_url,
      target_users: Array.isArray(target_users) && target_users.length ? target_users : ['all'],
      status,
      expiry_date: expiry_date || null,
      created_by: req.user._id,
    });

    res.status(201).json(banner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/admin/banners/:id - update banner
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    if (updates.target_users && (!Array.isArray(updates.target_users) || updates.target_users.length === 0)) {
      updates.target_users = ['all'];
    }

    const banner = await Banner.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!banner) {
      return res.status(404).json({ message: 'Banner not found' });
    }

    res.json(banner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/admin/banners/:id/logs - retrieve banner logs with user info
router.get('/:id/logs', async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({ message: 'Banner not found' });
    }

    const logs = await BannerLog.find({ banner_id: id })
      .populate('user_id', 'pharmacyName email phone role')
      .sort({ updated_at: -1 })
      .lean();

    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/admin/banners/upload - upload image to ImageKit
router.post('/upload', async (req, res) => {
  try {
    if (!hasImageKitConfig()) {
      return res.status(500).json({ message: 'ImageKit is not configured. Please set IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and IMAGEKIT_URL_ENDPOINT.' });
    }

    const imagekit = getImageKit();
    if (!imagekit) {
      return res.status(500).json({ message: 'Failed to initialize ImageKit client. Check configuration.' });
    }

    const { file, fileName, folder = '/kulmis_pharmacy/banners' } = req.body;

    if (!file || !fileName) {
      return res.status(400).json({ message: 'file and fileName are required' });
    }

    const uploadResponse = await imagekit.upload({
      file,
      fileName,
      folder,
    });

    res.json({
      image_url: uploadResponse.url,
      thumbnail_url: uploadResponse.thumbnailUrl,
      file_id: uploadResponse.fileId,
    });
  } catch (error) {
    console.error('Image upload failed:', error);
    res.status(500).json({ message: error.message || 'Image upload failed' });
  }
});

// DELETE /api/admin/banners/:id - delete banner and related logs
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await Banner.findByIdAndDelete(id);
    if (!banner) {
      return res.status(404).json({ message: 'Banner not found' });
    }

    await BannerLog.deleteMany({ banner_id: banner._id });

    res.json({ message: 'Banner deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/admin/banners/:id/stop/:userId - stop showing banner for user (force hidden toggle)
router.patch('/:id/stop/:userId', async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { forceHidden = true } = req.body;

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({ message: 'Banner not found' });
    }

    const log = await BannerLog.findOneAndUpdate(
      { user_id: userId, banner_id: id },
      {
        force_hidden: !!forceHidden,
        dismissed: !!forceHidden,
        dismissed_at: forceHidden ? new Date() : null,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ message: forceHidden ? 'Banner hidden for user' : 'Banner re-enabled for user', log });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
