import mongoose from 'mongoose';

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    duration_days: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    description: {
      type: String,
      trim: true,
    },
    planType: {
      type: String,
      enum: ['trial', 'paid'],
      default: 'paid',
      index: true,
    },
    features: [
      {
        type: String,
        trim: true,
      },
    ],
    limitations: {
      maxInvoices: {
        type: Number,
        default: null,
        min: 0,
      },
      maxMedicines: {
        type: Number,
        default: null,
        min: 0,
      },
      maxLabRecords: {
        type: Number,
        default: null,
        min: 0,
      },
    },
    autoLockBehavior: {
      type: String,
      enum: ['lock', 'notice'],
      default: 'lock',
    },
    isDefaultTrial: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for final price after discount
planSchema.virtual('finalPrice').get(function () {
  return this.price * (1 - this.discount / 100);
});

const Plan = mongoose.model('Plan', planSchema);

export default Plan;

