import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    plan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
    },
    price_paid: {
      type: Number,
      required: true,
      min: 0,
    },
    start_at: {
      type: Date,
      required: true,
    },
    end_at: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled'],
      default: 'active',
    },
    payment_request_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentRequest',
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
subscriptionSchema.index({ user_id: 1, status: 1 });
subscriptionSchema.index({ end_at: 1 });

const Subscription = mongoose.model('Subscription', subscriptionSchema);

export default Subscription;







