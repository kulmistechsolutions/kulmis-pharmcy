import express from 'express';
import Subscription from '../../models/Subscription.js';
import Plan from '../../models/Plan.js';
import { protect, authorize } from '../../middleware/auth.js';

const router = express.Router();

// All routes require super_admin
router.use(protect);
router.use(authorize('super_admin'));

// @route   GET /api/admin/revenue/summary
// @desc    Get revenue summary
// @access  Private (Super Admin)
router.get('/summary', async (req, res) => {
  try {
    const allSubscriptions = await Subscription.find({ status: 'active' });

    const totalRevenue = allSubscriptions.reduce(
      (sum, sub) => sum + sub.price_paid,
      0
    );

    // Calculate monthly revenue
    const monthlyRevenue = {};
    allSubscriptions.forEach((sub) => {
      const month = new Date(sub.createdAt).toLocaleString('default', { month: 'long', year: 'numeric' });
      monthlyRevenue[month] = (monthlyRevenue[month] || 0) + sub.price_paid;
    });

    // Count expiring soon (within 7 days)
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiringSoon = await Subscription.countDocuments({
      status: 'active',
      end_at: { $gte: now, $lte: sevenDaysFromNow },
    });

    res.json({
      totalRevenue,
      totalSubscriptions: allSubscriptions.length,
      expiringSoon,
      monthlyRevenue,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/admin/revenue/monthly
// @desc    Get monthly revenue breakdown
// @access  Private (Super Admin)
router.get('/monthly', async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ status: 'active' });

    // Group by month
    const monthlyData = {};
    subscriptions.forEach((sub) => {
      const date = new Date(sub.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleString('default', { month: 'short', year: 'numeric' });
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthName,
          revenue: 0,
          count: 0,
        };
      }
      
      monthlyData[monthKey].revenue += sub.price_paid;
      monthlyData[monthKey].count += 1;
    });

    // Convert to array and sort by month
    const monthlyArray = Object.values(monthlyData).sort((a, b) => {
      const aDate = new Date(a.month);
      const bDate = new Date(b.month);
      return aDate - bDate;
    });

    res.json(monthlyArray);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/admin/revenue/by-plan
// @desc    Get revenue breakdown by plan
// @access  Private (Super Admin)
router.get('/by-plan', async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ status: 'active' })
      .populate('plan_id', 'name');

    const planRevenue = {};
    subscriptions.forEach((sub) => {
      const planName = sub.plan_id?.name || 'Unknown';
      if (!planRevenue[planName]) {
        planRevenue[planName] = {
          name: planName,
          revenue: 0,
          count: 0,
        };
      }
      planRevenue[planName].revenue += sub.price_paid;
      planRevenue[planName].count += 1;
    });

    const planArray = Object.values(planRevenue);

    res.json(planArray);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;







