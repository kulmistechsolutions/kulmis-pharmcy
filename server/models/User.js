import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    pharmacyName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['super_admin', 'pharmacy_owner', 'technician', 'staff'],
      default: 'pharmacy_owner',
    },
    permissions: [{
      type: String,
    }],
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    subscription: {
      plan: {
        type: String,
        enum: ['trial', 'monthly', 'quarterly', 'semiannual', 'yearly', 'lifetime'],
        default: null,
      },
      startDate: Date,
      endDate: Date,
      status: {
        type: String,
        enum: ['trial', 'active', 'expired', 'pending'],
        default: 'pending',
      },
    },
    planType: {
      type: String,
      enum: ['trial', 'paid'],
      default: 'trial',
    },
    trialStart: {
      type: Date,
    },
    trialEnd: {
      type: Date,
      index: true,
    },
    trialDaysGranted: {
      type: Number,
      default: 30,
      min: 1,
    },
    isTrialExpired: {
      type: Boolean,
      default: false,
      index: true,
    },
    subscriptionStatus: {
      type: String,
      enum: ['trial', 'active', 'expired', 'pending'],
      default: 'trial',
      index: true,
    },
    subscriptionPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      default: null,
    },
    trialReminderSentAt: {
      type: Date,
      default: null,
    },
    trialExpiredNotifiedAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;

