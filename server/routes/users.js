import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users (super_admin gets all, pharmacy_owner gets their users)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let query = {};
    
    // Super admin can see all users
    if (req.user.role === 'super_admin') {
      query = {};
    } 
    // Pharmacy owner can see their own users (staff they created)
    else if (req.user.role === 'pharmacy_owner') {
      query = {
        $or: [
          { _id: req.user._id }, // Include themselves
          { created_by: req.user._id }, // Users they created
        ]
      };
    }
    // Staff can only see themselves
    else {
      query = { _id: req.user._id };
    }

    const users = await User.find(query).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check access
    if (req.user.role === 'super_admin') {
      // Super admin can see anyone
    } else if (req.user.role === 'pharmacy_owner') {
      // Pharmacy owner can see themselves or users they created
      if (user._id.toString() !== req.user._id.toString() && user.created_by?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else {
      // Staff can only see themselves
      if (user._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/users
// @desc    Create a new user (super_admin or pharmacy_owner)
// @access  Private
router.post(
  '/',
  protect,
  [
    body('pharmacyName').trim().notEmpty().withMessage('Pharmacy name is required'),
    body('email').isEmail().withMessage('Please include a valid email'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['super_admin', 'pharmacy_owner', 'technician', 'staff']).withMessage('Invalid role'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { pharmacyName, email, phone, password, role = 'staff', permissions = [] } = req.body;

      // Only super_admin can create super_admin or pharmacy_owner
      if (role === 'super_admin' || role === 'pharmacy_owner') {
        if (req.user.role !== 'super_admin') {
          return res.status(403).json({ message: 'Only super admin can create admin or pharmacy owner users' });
        }
      }

      // Pharmacy owners can only create staff users
      if (req.user.role === 'pharmacy_owner' && role !== 'staff') {
        return res.status(403).json({ message: 'Pharmacy owners can only create staff users' });
      }

      // Check if user exists
      const userExists = await User.findOne({ $or: [{ email }, { phone }] });
      if (userExists) {
        return res.status(400).json({ message: 'User with this email or phone already exists' });
      }

      // Create user
      const userData = {
        pharmacyName: pharmacyName || req.user.pharmacyName,
        email,
        phone,
        password,
        role,
        permissions: role === 'staff' ? permissions : [],
        created_by: req.user._id,
      };

      const user = await User.create(userData);

      res.status(201).json({
        _id: user._id,
        pharmacyName: user.pharmacyName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        permissions: user.permissions || [],
        isActive: user.isActive,
        createdAt: user.createdAt,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private
router.put(
  '/:id',
  protect,
  [
    body('pharmacyName').optional().trim().notEmpty(),
    body('email').optional().isEmail(),
    body('phone').optional().trim().notEmpty(),
    body('role').optional().isIn(['super_admin', 'pharmacy_owner', 'technician', 'staff']),
    body('isActive').optional().isBoolean(),
    body('permissions').optional().isArray(),
    body('subscription.plan').optional().isIn(['monthly', 'quarterly', 'semiannual', 'yearly', 'lifetime']),
    body('subscription.status').optional().isIn(['active', 'expired', 'pending']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { pharmacyName, email, phone, role, isActive, password, subscription, permissions } = req.body;
      const user = await User.findById(req.params.id);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check access
      if (req.user.role === 'super_admin') {
        // Super admin can edit anyone
      } else if (req.user.role === 'pharmacy_owner') {
        // Pharmacy owner can edit themselves or users they created
        if (user._id.toString() !== req.user._id.toString() && user.created_by?.toString() !== req.user._id.toString()) {
          return res.status(403).json({ message: 'Access denied' });
        }
        // Pharmacy owner cannot change role to super_admin or pharmacy_owner
        if (role && (role === 'super_admin' || role === 'pharmacy_owner')) {
          return res.status(403).json({ message: 'Cannot change role to admin or pharmacy owner' });
        }
      } else {
        // Staff can only edit themselves (and cannot change role or permissions)
        if (user._id.toString() !== req.user._id.toString()) {
          return res.status(403).json({ message: 'Access denied' });
        }
        if (role || permissions) {
          return res.status(403).json({ message: 'Cannot change role or permissions' });
        }
      }

      // Check if email/phone already exists for another user
      if (email || phone) {
        const existingUser = await User.findOne({
          $or: [
            ...(email ? [{ email }] : []),
            ...(phone ? [{ phone }] : []),
          ],
          _id: { $ne: req.params.id },
        });
        if (existingUser) {
          return res.status(400).json({ message: 'Email or phone already in use' });
        }
      }

      // Update fields
      if (pharmacyName) user.pharmacyName = pharmacyName;
      if (email) user.email = email;
      if (phone) user.phone = phone;
      if (role && req.user.role === 'super_admin') {
        user.role = role;
      }
      if (typeof isActive === 'boolean' && (req.user.role === 'super_admin' || req.user.role === 'pharmacy_owner')) {
        user.isActive = isActive;
      }
      if (password) {
        // Password will be hashed by pre-save hook
        user.password = password;
      }
      if (permissions && (req.user.role === 'super_admin' || req.user.role === 'pharmacy_owner')) {
        user.permissions = permissions;
      }
      if (subscription && req.user.role === 'super_admin') {
        user.subscription = {
          plan: subscription.plan || user.subscription?.plan || null,
          startDate: subscription.startDate ? new Date(subscription.startDate) : user.subscription?.startDate || null,
          endDate: subscription.endDate ? new Date(subscription.endDate) : user.subscription?.endDate || null,
          status: subscription.status || user.subscription?.status || 'pending',
        };
      }

      await user.save();

      res.json({
        _id: user._id,
        pharmacyName: user.pharmacyName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        updatedAt: user.updatedAt,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// @route   DELETE /api/users/:id
// @desc    Delete user (or deactivate)
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check access
    if (req.user.role === 'super_admin') {
      // Super admin can deactivate anyone except themselves
      if (user._id.toString() === req.user._id.toString()) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
      }
    } else if (req.user.role === 'pharmacy_owner') {
      // Pharmacy owner can only deactivate users they created
      if (user.created_by?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Instead of deleting, deactivate
    user.isActive = false;
    await user.save();

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;

