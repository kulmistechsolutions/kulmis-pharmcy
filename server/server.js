import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import cron from 'node-cron';
import connectDB from './config/database.js';
import jwt from 'jsonwebtoken';
import { Server as SocketServer } from 'socket.io';
import User from './models/User.js';
import { runTrialSweep } from './services/subscriptionTrialService.js';
import { ensureTrialPlanDefaults } from './services/trialConfigService.js';

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Log requests for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Debug: Log when admin routes are registered
console.log('🔧 Registering admin routes...');
console.log('  - /api/admin/plans');
console.log('  - /api/admin/subscriptions');
console.log('  - /api/admin/revenue');
console.log('  - /api/admin/pharmacies');
console.log('  - /api/admin/trials');

// Routes
import authRoutes from './routes/auth.js';
import invoiceRoutes from './routes/invoices.js';
import medicineRoutes from './routes/medicines.js';
import salesRoutes from './routes/sales.js';
import debtRoutes from './routes/debts.js';
import expenseRoutes from './routes/expenses.js';
import userRoutes from './routes/users.js';
import planRoutes from './routes/plans.js';
import subscriptionRoutes from './routes/subscriptions.js';
import adminPlanRoutes from './routes/admin/plans.js';
import adminSubscriptionRoutes from './routes/admin/subscriptions.js';
import adminRevenueRoutes from './routes/admin/revenue.js';
import adminPharmacyRoutes from './routes/admin/pharmacies.js';
import adminTrialRoutes from './routes/admin/trials.js';
import bannerRoutes from './routes/banners.js';
import adminBannerRoutes from './routes/admin/banners.js';
import labCashierRoutes from './routes/labCashier.js';
import transactionRoutes from './routes/transactions.js';
import activityLogRoutes from './routes/activityLogs.js';
import syncLogRoutes from './routes/syncLogs.js';
import reportExportRoutes from './routes/reportExports.js';
import settingsRoutes from './routes/settings.js';
import notificationRoutes from './routes/notifications.js';

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/debts', debtRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/users', userRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/lab-cashier', labCashierRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/admin/banners', adminBannerRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/sync/logs', syncLogRoutes);
app.use('/api/reports', reportExportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationRoutes);

ensureTrialPlanDefaults()
  .then(() => console.log('✅ Trial plan defaults ensured'))
  .catch((error) => console.error('❌ Failed to ensure trial plan defaults:', error));

const enableCron = process.env.ENABLE_CRON !== 'false';
if (enableCron) {
  const timezone = process.env.CRON_TIMEZONE || 'UTC';

  cron.schedule(
    '0 0 * * *',
    async () => {
      try {
        console.log('⏰ Running daily trial sweep job');
        await runTrialSweep(app);
        console.log('✅ Trial sweep completed');
      } catch (error) {
        console.error('❌ Trial sweep failed:', error);
      }
    },
    { timezone }
  );

  // Run once on startup after server is ready
  runTrialSweep(app)
    .then(() => console.log('✅ Initial trial sweep complete'))
    .catch((error) => console.error('❌ Initial trial sweep failed:', error));
}

// Admin Routes
try {
  app.use('/api/admin/plans', adminPlanRoutes);
  app.use('/api/admin/subscriptions', adminSubscriptionRoutes);
  app.use('/api/admin/revenue', adminRevenueRoutes);
  app.use('/api/admin/pharmacies', adminPharmacyRoutes);
  app.use('/api/admin/trials', adminTrialRoutes);
  console.log('✅ Admin routes registered successfully');
} catch (error) {
  console.error('❌ Error registering admin routes:', error);
  process.exit(1);
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

const io = new SocketServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const tenantRoom = (tenantId) => `tenant:${tenantId}`;
const userRoom = (userId) => `user:${userId}`;

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return next(new Error('Authentication token missing'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userDoc = await User.findById(decoded.id).select('role created_by');
    if (!userDoc) {
      return next(new Error('User not found'));
    }

    const tenantId =
      userDoc.role === 'staff' && userDoc.created_by
        ? userDoc.created_by
        : userDoc._id;

    socket.data.user = {
      id: userDoc._id.toString(),
      role: userDoc.role,
      tenantId: tenantId.toString(),
    };
    next();
  } catch (error) {
    next(new Error('Invalid authentication token'));
  }
});

io.on('connection', (socket) => {
  const { user } = socket.data;
  if (!user) {
    socket.disconnect(true);
    return;
  }

  const tenantId = user.tenantId?.toString();
  const userId = user.id?.toString();

  if (tenantId) {
    socket.join(tenantRoom(tenantId));
  }
  if (userId) {
    socket.join(userRoom(userId));
  }

  socket.emit('connection:ack', { connected: true });

  socket.on('disconnect', () => {
    if (tenantId) {
      socket.leave(tenantRoom(tenantId));
    }
    if (userId) {
      socket.leave(userRoom(userId));
    }
  });
});

app.set('io', io);
app.set('socketRooms', { tenantRoom, userRoom });

server.listen(PORT, () => {
  console.log(`\n🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`📡 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`🔐 Admin routes require super_admin role\n`);
});

