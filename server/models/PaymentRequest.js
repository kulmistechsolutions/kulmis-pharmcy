import mongoose from 'mongoose';

const paymentRequestSchema = new mongoose.Schema(
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
    method: {
      type: String,
      required: true,
      // Flexible validation - accepts case variations
      // Normalization happens in route handler
      validate: {
        validator: function(v) {
          if (!v || typeof v !== 'string') return false;
          const normalized = v.toLowerCase().trim().replace(/\s+/g, ' ');
          const validMethods = ['mobile money', 'bank transfer', 'cash', 'other', 'evc plus', 'evcplus', 'edahab'];
          return validMethods.includes(normalized);
        },
        message: props => `${props.value} is not a valid payment method. Valid methods: Mobile Money, Bank Transfer, Cash, EVC PLUS, EDAHAB, Other`
      }
    },
    sender_number: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    reference_id: {
      type: String,
      trim: true,
    },
    proof_url: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    approved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approved_at: {
      type: Date,
    },
    rejection_reason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
paymentRequestSchema.index({ status: 1 });
paymentRequestSchema.index({ user_id: 1, status: 1 });

// Delete model if it exists (to clear cache in development)
if (mongoose.models.PaymentRequest) {
  console.log('🔄 Clearing cached PaymentRequest model...');
  delete mongoose.models.PaymentRequest;
  delete mongoose.connection.models.PaymentRequest;
  delete mongoose.modelSchemas.PaymentRequest;
}

const PaymentRequest = mongoose.model('PaymentRequest', paymentRequestSchema);
console.log('✅ PaymentRequest model loaded. Method validation:', PaymentRequest.schema.paths.method.validators ? 'Custom validator active' : 'No validators');

export default PaymentRequest;

