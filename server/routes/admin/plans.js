import express from 'express';
import { body, validationResult } from 'express-validator';
import Plan from '../../models/Plan.js';
import Subscription from '../../models/Subscription.js';
import { protect, authorize } from '../../middleware/auth.js';

const router = express.Router();

// All routes require super_admin
router.use((req, res, next) => {
  console.log(`🔐 Admin route accessed: ${req.method} ${req.path}`);
  next();
});

router.use(protect);
router.use(authorize('super_admin'));

// @route   GET /api/admin/plans
// @desc    Get all plans with revenue stats
// @access  Private (Super Admin)
router.get('/', async (req, res) => {
  console.log('📥 GET /api/admin/plans - Request received');
  try {
    const plans = await Plan.find().sort({ createdAt: -1 });
    
    // Get revenue stats for each plan
    const plansWithStats = await Promise.all(
      plans.map(async (plan) => {
        const subscriptions = await Subscription.find({
          plan_id: plan._id,
          status: 'active',
        });
        
        const totalRevenue = subscriptions.reduce(
          (sum, sub) => sum + sub.price_paid,
          0
        );
        
        return {
          ...plan.toObject(),
          activeUsers: subscriptions.length,
          totalRevenue,
        };
      })
    );
    
    res.json(plansWithStats);
  } catch (error) {
    console.error('❌ Error in GET /api/admin/plans:', error);
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/admin/plans
// @desc    Create new subscription plan
// @access  Private (Super Admin)
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Plan name is required'),
    body('duration_days').isInt({ min: 1 }).withMessage('Duration must be at least 1 day'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be positive'),
    body('discount').optional().isFloat({ min: 0, max: 100 }).withMessage('Discount must be between 0-100'),
    body('planType').optional().isIn(['trial', 'paid']).withMessage('Plan type must be trial or paid'),
    body('autoLockBehavior')
      .optional()
      .isIn(['lock', 'notice'])
      .withMessage('autoLockBehavior must be lock or notice'),
  ],
  async (req, res) => {
    console.log('📥 POST /api/admin/plans - Request received', req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const {
        name,
        duration_days,
        price,
        discount = 0,
        description,
        status = 'active',
        planType = 'paid',
        features = [],
        limitations = {},
        autoLockBehavior = 'lock',
        isDefaultTrial = false,
      } = req.body;

      // Check if plan name already exists
      const existingPlan = await Plan.findOne({ name });
      if (existingPlan) {
        return res.status(400).json({ message: 'Plan with this name already exists' });
      }

      const plan = await Plan.create({
        name,
        duration_days,
        price,
        discount,
        description,
        status,
        planType,
        features,
        limitations,
        autoLockBehavior,
        isDefaultTrial: planType === 'trial' ? isDefaultTrial : false,
      });

      if (plan.planType === 'trial' && plan.isDefaultTrial) {
        await Plan.updateMany(
          { _id: { $ne: plan._id }, planType: 'trial' },
          { $set: { isDefaultTrial: false } }
        );
      }

      console.log('✅ Plan created successfully:', plan._id);
      res.status(201).json(plan);
    } catch (error) {
      console.error('❌ Error in POST /api/admin/plans:', error);
      res.status(500).json({ message: error.message });
    }
  }
);

// @route   PUT /api/admin/plans/:id
// @desc    Update subscription plan
// @access  Private (Super Admin)
router.put(
  '/:id',
  [
    body('name').optional().trim().notEmpty(),
    body('duration_days').optional().isInt({ min: 1 }),
    body('price').optional().isFloat({ min: 0 }),
    body('discount').optional().isFloat({ min: 0, max: 100 }),
    body('planType').optional().isIn(['trial', 'paid']),
    body('autoLockBehavior').optional().isIn(['lock', 'notice']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const plan = await Plan.findById(req.params.id);
      if (!plan) {
        return res.status(404).json({ message: 'Plan not found' });
      }

      // Check if name is being changed and if it conflicts
      if (req.body.name && req.body.name !== plan.name) {
        const existingPlan = await Plan.findOne({ name: req.body.name });
        if (existingPlan) {
          return res.status(400).json({ message: 'Plan with this name already exists' });
        }
      }

      Object.assign(plan, req.body);
      await plan.save();

      if (plan.planType === 'trial' && plan.isDefaultTrial) {
        await Plan.updateMany(
          { _id: { $ne: plan._id }, planType: 'trial' },
          { $set: { isDefaultTrial: false } }
        );
      }

      res.json(plan);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// @route   PATCH /api/admin/plans/:id/status
// @desc    Activate/Deactivate plan
// @access  Private (Super Admin)
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Status must be active or inactive' });
    }

    const plan = await Plan.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!plan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    res.json(plan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/admin/plans/:id
// @desc    Delete plan (only if no active subscriptions)
// @access  Private (Super Admin)
router.delete('/:id', async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ message: 'Plan not found' });
    }

    // Check if plan has active subscriptions
    const activeSubscriptions = await Subscription.countDocuments({
      plan_id: plan._id,
      status: 'active',
    });

    if (activeSubscriptions > 0) {
      return res.status(400).json({
        message: 'Cannot delete plan with active subscriptions. Deactivate it instead.',
      });
    }

    await Plan.findByIdAndDelete(req.params.id);
    res.json({ message: 'Plan deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
