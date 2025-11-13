import express from 'express';
import Plan from '../models/Plan.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/plans
// @desc    Get all active subscription plans (public for pharmacies)
// @access  Public (but can be protected if needed)
router.get('/', async (req, res) => {
  try {
    console.log('📥 GET /api/plans - Request received');
    const plans = await Plan.find({ status: 'active' }).sort({ price: 1 });
    
    console.log(`✅ Found ${plans.length} active plans in database`);
    
    // Format plans for frontend
    const formattedPlans = plans.map(plan => {
      const finalPrice = plan.price * (1 - (plan.discount || 0) / 100);
      return {
        id: plan._id.toString(),
        _id: plan._id.toString(),
        name: plan.name,
        duration_days: plan.duration_days,
        price: plan.price,
        discount: plan.discount || 0,
        finalPrice: finalPrice,
        description: plan.description || '',
        duration: formatDuration(plan.duration_days),
        features: getPlanFeatures(plan.name, plan.duration_days),
      };
    });
    
    console.log('📤 Sending formatted plans:', formattedPlans.length);
    res.json(formattedPlans);
  } catch (error) {
    console.error('❌ Error in GET /api/plans:', error);
    res.status(500).json({ message: error.message });
  }
});

// Helper function to format duration
function formatDuration(days) {
  if (days === 30) return '1 Month';
  if (days === 90) return '3 Months';
  if (days === 180) return '6 Months';
  if (days === 365) return '12 Months';
  if (days >= 3650) return 'Lifetime';
  return `${days} Days`;
}

// Helper function to get features based on plan
function getPlanFeatures(planName, durationDays) {
  const name = planName.toLowerCase();
  const baseFeatures = [
    'Unlimited Medicines',
    'Sales & Invoice Management',
    'Debt Tracking',
    'Basic Reports',
  ];
  
  if (name.includes('monthly') || durationDays === 30) {
    return [
      ...baseFeatures,
      'Email Support',
    ];
  }
  
  if (name.includes('3-month') || name.includes('quarterly') || durationDays === 90) {
    return [
      ...baseFeatures,
      'Advanced Reports',
      'Lab Test Management',
      'Priority Email Support',
      'Expense Tracking',
    ];
  }
  
  if (name.includes('6-month') || name.includes('semiannual') || durationDays === 180) {
    return [
      ...baseFeatures,
      'Advanced Reports',
      'Lab Test Management',
      'Priority Email Support',
      'Expense Tracking',
      'Multi-branch Support',
      'Custom Reports',
      'Phone & Email Support',
      'Data Export (Excel/PDF)',
    ];
  }
  
  if (name.includes('yearly') || name.includes('annual') || durationDays === 365) {
    return [
      ...baseFeatures,
      'Advanced Reports',
      'Lab Test Management',
      'Priority Email Support',
      'Expense Tracking',
      'Multi-branch Support',
      'Custom Reports',
      'Phone & Email Support',
      'Data Export (Excel/PDF)',
      'API Access',
      '24/7 Priority Support',
      'Custom Integrations',
    ];
  }
  
  if (name.includes('lifetime') || durationDays >= 3650) {
    return [
      ...baseFeatures,
      'Advanced Reports',
      'Lab Test Management',
      'Priority Email Support',
      'Expense Tracking',
      'Multi-branch Support',
      'Custom Reports',
      'Phone & Email Support',
      'Data Export (Excel/PDF)',
      'API Access',
      '24/7 Priority Support',
      'Custom Integrations',
      'All Future Features',
      'Lifetime Updates',
      'Premium Support Forever',
      'White Label Option',
    ];
  }
  
  return baseFeatures;
}

// @route   GET /api/plans/current
// @desc    Get current user's subscription plan
// @access  Private
router.get('/current', protect, async (req, res) => {
  try {
    const user = req.user;

    const now = new Date();
    const trialEnd = user.trialEnd ? new Date(user.trialEnd) : null;
    const trialDaysRemaining = trialEnd ? Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)) : 0;
    const trialActive =
      user.planType === 'trial' &&
      !user.isTrialExpired &&
      trialEnd &&
      trialDaysRemaining > 0;

    if (trialActive) {
      return res.json({
        hasSubscription: true,
        status: 'trial',
        plan: {
          plan: 'trial',
          startDate: user.trialStart,
          endDate: user.trialEnd,
          status: 'trial',
        },
        trial: {
          start: user.trialStart,
          end: user.trialEnd,
          daysRemaining: trialDaysRemaining,
        },
        daysRemaining: trialDaysRemaining,
        isTrial: true,
        isExpired: false,
      });
    }

    if (!user.subscription || !user.subscription.plan) {
      return res.json({
        hasSubscription: false,
        message: 'No active subscription',
        isTrial: user.planType === 'trial',
        isTrialExpired: !!user.isTrialExpired,
        trial: {
          start: user.trialStart,
          end: user.trialEnd,
          daysRemaining: Math.max(trialDaysRemaining, 0),
          isExpired: !!user.isTrialExpired || trialDaysRemaining <= 0,
        },
      });
    }

    // Try to find plan by matching the plan enum value to plan name
    const planNameMap = {
      'monthly': ['Monthly', 'monthly'],
      'quarterly': ['3-Month', 'Quarterly', 'quarterly', '3-month'],
      'semiannual': ['6-Month', 'Semi-Annual', 'Semiannual', 'semiannual', '6-month'],
      'yearly': ['Yearly', 'Annual', 'yearly', 'annual'],
      'lifetime': ['Lifetime', 'lifetime'],
    };
    
    const searchTerms = planNameMap[user.subscription.plan] || [user.subscription.plan];
    const plan = await Plan.findOne({ 
      $or: searchTerms.map(term => ({ name: { $regex: new RegExp(term, 'i') } }))
    });
    
    if (!plan) {
      return res.json({
        hasSubscription: true,
        plan: user.subscription,
        planDetails: null,
        status: user.subscription.status,
        isTrial: false,
        isExpired: user.subscription.status === 'expired',
        daysRemaining: user.subscription.endDate
          ? Math.max(Math.ceil((new Date(user.subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24)), 0)
          : 0,
      });
    }
    
    const daysRemaining = user.subscription.endDate 
      ? Math.ceil((new Date(user.subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24))
      : 0;
    
    res.json({
      hasSubscription: true,
      plan: user.subscription,
      planDetails: {
        ...plan.toObject(),
        finalPrice: plan.finalPrice || plan.price * (1 - (plan.discount || 0) / 100),
      },
      daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
      status: user.subscription.status,
      isTrial: false,
      isExpired: user.subscription.status === 'expired' || daysRemaining <= 0,
    });
  } catch (error) {
    console.error('❌ Error in GET /api/plans/current:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
