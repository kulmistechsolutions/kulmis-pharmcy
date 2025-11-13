import mongoose from 'mongoose';

const labOrderSchema = new mongoose.Schema(
  {
    order_number: {
      type: String,
      unique: true,
      sparse: true,
    },
    patient_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tests: [
      {
        test_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'LabTest',
        },
        name: String,
        price: Number,
      },
    ],
    sample: {
      type: {
        type: String,
        enum: ['Blood', 'Urine', 'Stool', 'Sputum', 'Other'],
      },
      collected_at: Date,
      collected_by: {
        type: String,
        trim: true,
      },
      notes: String,
    },
    status: {
      type: String,
      enum: ['pending', 'collected', 'in_process', 'completed', 'delivered'],
      default: 'pending',
      index: true,
    },
    total_price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate order number before validation
labOrderSchema.pre('validate', async function (next) {
  if (!this.order_number) {
    try {
      const LabOrderModel = this.constructor;
      const count = await LabOrderModel.countDocuments();
      const year = new Date().getFullYear();
      const number = String(count + 1).padStart(5, '0');
      this.order_number = `LAB-${year}-${number}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

const LabOrder = mongoose.model('LabOrder', labOrderSchema);

export default LabOrder;

