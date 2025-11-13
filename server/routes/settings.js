import express from 'express';
import { body, validationResult } from 'express-validator';
import { protect } from '../middleware/auth.js';
import PharmacySetting from '../models/PharmacySetting.js';
import User from '../models/User.js';
import { getImageKit, hasImageKitConfig } from '../utils/imagekit.js';

const router = express.Router();

const sanitizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const resolveTargetPharmacyId = (req, source) => {
  if (req.user.role === 'super_admin' && source) {
    return source;
  }
  return req.accountId?.toString?.() || req.user._id.toString();
};

const ensureSettings = async (pharmacyId, defaults = {}) => {
  let settings = await PharmacySetting.findOne({ pharmacy: pharmacyId });
  if (!settings) {
    settings = await PharmacySetting.create({
      pharmacy: pharmacyId,
      ...defaults,
    });
  }
  return settings;
};

const canEditSettings = (req, targetPharmacyId) => {
  if (req.user.role === 'super_admin') {
    return true;
  }
  if (req.user.role === 'pharmacy_owner' && req.accountId?.toString() === targetPharmacyId) {
    return true;
  }
  return false;
};

const buildSettingsResponse = (settingsDoc, ownerDoc, canEdit) => {
  const branding = {
    name: settingsDoc?.name || ownerDoc?.pharmacyName || '',
    phone: settingsDoc?.phone || ownerDoc?.phone || '',
    email: settingsDoc?.email || ownerDoc?.email || '',
    address: settingsDoc?.address || ownerDoc?.address || '',
    about: settingsDoc?.about || '',
    owner_name: settingsDoc?.owner_name || '',
    logo_url: settingsDoc?.logo_url || '',
    logo_thumbnail_url: settingsDoc?.logo_thumbnail_url || '',
  };

  return {
    id: settingsDoc?._id?.toString?.() || null,
    pharmacyId: ownerDoc?._id?.toString?.() || '',
    ...branding,
    updatedAt: settingsDoc?.updatedAt || ownerDoc?.updatedAt,
    canEdit,
  };
};

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const targetPharmacyId =
      (req.user.role === 'super_admin' && req.query.pharmacyId?.toString()) ||
      resolveTargetPharmacyId(req);

    if (!targetPharmacyId) {
      return res.status(400).json({ message: 'Missing target pharmacy identifier' });
    }

    const owner = await User.findById(targetPharmacyId).select(
      'pharmacyName email phone role created_by address'
    );

    if (!owner) {
      return res.status(404).json({ message: 'Pharmacy account not found' });
    }

    const defaults = {
      name: owner.pharmacyName || '',
      email: owner.email || '',
      phone: owner.phone || '',
    };
    const settings = await ensureSettings(targetPharmacyId, defaults);
    const canEdit = canEditSettings(req, targetPharmacyId);

    return res.json(buildSettingsResponse(settings, owner, canEdit));
  } catch (error) {
    console.error('Error fetching settings:', error);
    return res.status(500).json({ message: error.message || 'Failed to fetch settings.' });
  }
});

router.put(
  '/',
  [
    body('name').optional().isString().isLength({ max: 120 }).withMessage('Name must be under 120 characters'),
    body('owner_name')
      .optional()
      .isString()
      .isLength({ max: 120 })
      .withMessage('Owner name must be under 120 characters'),
    body('phone').optional().isString().isLength({ max: 40 }).withMessage('Phone must be under 40 characters'),
    body('email').optional().isEmail().withMessage('Email must be valid'),
    body('address')
      .optional()
      .isString()
      .isLength({ max: 200 })
      .withMessage('Address must be under 200 characters'),
    body('about')
      .optional()
      .isString()
      .isLength({ max: 600 })
      .withMessage('About section must be under 600 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const targetPharmacyId =
        (req.user.role === 'super_admin' && req.body.pharmacyId?.toString()) ||
        resolveTargetPharmacyId(req);

      if (!targetPharmacyId) {
        return res.status(400).json({ message: 'Missing target pharmacy identifier' });
      }

      if (!canEditSettings(req, targetPharmacyId)) {
        return res.status(403).json({ message: 'You do not have permission to update these settings.' });
      }

      const owner = await User.findById(targetPharmacyId);
      if (!owner) {
        return res.status(404).json({ message: 'Pharmacy account not found' });
      }

      const {
        name,
        owner_name: ownerName,
        phone,
        email,
        address,
        about,
      } = req.body;

      const settings = await ensureSettings(targetPharmacyId);

      if (typeof name === 'string') {
        settings.name = sanitizeString(name);
        owner.pharmacyName = sanitizeString(name);
      }

      if (typeof ownerName === 'string') {
        settings.owner_name = sanitizeString(ownerName);
      }

      if (typeof phone === 'string') {
        const normalizedPhone = sanitizeString(phone);
        settings.phone = normalizedPhone;
        owner.phone = normalizedPhone;
      }

      if (typeof email === 'string') {
        const normalizedEmail = sanitizeString(email).toLowerCase();
        settings.email = normalizedEmail;
        owner.email = normalizedEmail;
      }

      if (typeof address === 'string') {
        settings.address = sanitizeString(address);
      }

      if (typeof about === 'string' || about === '') {
        settings.about = sanitizeString(about);
      }

      settings.updated_by = req.user._id;
      await settings.save();
      await owner.save();

      return res.json(buildSettingsResponse(settings, owner, true));
    } catch (error) {
      console.error('Error updating settings:', error);
      return res.status(500).json({ message: error.message || 'Failed to update settings.' });
    }
  }
);

router.put(
  '/password',
  [
    body('newPassword')
      .isString()
      .isLength({ min: 6 })
      .withMessage('New password must be at least 6 characters long'),
    body('confirmPassword')
      .custom((value, { req }) => value === req.body.newPassword)
      .withMessage('Password confirmation does not match'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const targetPharmacyId =
        (req.user.role === 'super_admin' && req.body.pharmacyId?.toString()) ||
        resolveTargetPharmacyId(req);

      if (!targetPharmacyId) {
        return res.status(400).json({ message: 'Missing target pharmacy identifier' });
      }

      const canEdit = canEditSettings(req, targetPharmacyId);
      if (!canEdit && req.user.role !== 'super_admin') {
        return res.status(403).json({ message: 'You do not have permission to update this password.' });
      }

      const owner = await User.findById(targetPharmacyId);
      if (!owner) {
        return res.status(404).json({ message: 'Pharmacy account not found' });
      }

      if (req.user.role !== 'super_admin' || targetPharmacyId === req.user._id.toString()) {
        const currentPassword = req.body.currentPassword;
        if (!currentPassword) {
          return res.status(400).json({ message: 'Current password is required.' });
        }
        const isMatch = await owner.matchPassword(currentPassword);
        if (!isMatch) {
          return res.status(400).json({ message: 'Current password is incorrect.' });
        }
      }

      owner.password = req.body.newPassword;
      await owner.save();

      return res.json({ message: 'Password updated successfully.' });
    } catch (error) {
      console.error('Error updating password:', error);
      return res.status(500).json({ message: error.message || 'Failed to update password.' });
    }
  }
);

router.post('/logo', async (req, res) => {
  try {
    if (!hasImageKitConfig()) {
      return res
        .status(500)
        .json({ message: 'ImageKit is not configured. Please contact the administrator to enable logo uploads.' });
    }

    const targetPharmacyId =
      (req.user.role === 'super_admin' && req.body.pharmacyId?.toString()) || resolveTargetPharmacyId(req);

    if (!targetPharmacyId) {
      return res.status(400).json({ message: 'Missing target pharmacy identifier' });
    }

    if (!canEditSettings(req, targetPharmacyId)) {
      return res.status(403).json({ message: 'You do not have permission to update this logo.' });
    }

    const { file, fileName } = req.body;
    if (!file || !fileName) {
      return res.status(400).json({ message: 'file and fileName are required.' });
    }

    const owner = await User.findById(targetPharmacyId).select('pharmacyName');
    if (!owner) {
      return res.status(404).json({ message: 'Pharmacy account not found' });
    }

    const settings = await ensureSettings(targetPharmacyId);
    const imagekit = getImageKit();
    if (!imagekit) {
      return res.status(500).json({ message: 'Failed to initialize image uploader.' });
    }

    if (settings.logo_file_id) {
      try {
        await imagekit.deleteFile(settings.logo_file_id);
      } catch (cleanupError) {
        console.warn('Failed to delete previous logo from ImageKit:', cleanupError.message);
      }
    }

    const uploadResponse = await imagekit.upload({
      file,
      fileName,
      folder: `/kulmis_pharmacy/logos/${targetPharmacyId}`,
      useUniqueFileName: true,
    });

    settings.logo_url = uploadResponse.url;
    settings.logo_thumbnail_url = uploadResponse.thumbnailUrl || uploadResponse.url;
    settings.logo_file_id = uploadResponse.fileId;
    settings.updated_by = req.user._id;
    await settings.save();

    return res.json(
      buildSettingsResponse(settings, owner, true)
    );
  } catch (error) {
    console.error('Error uploading logo:', error);
    return res.status(500).json({ message: error.message || 'Failed to upload logo.' });
  }
});

export default router;




