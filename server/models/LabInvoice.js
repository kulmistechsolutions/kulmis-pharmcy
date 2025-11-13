import mongoose from 'mongoose';

const labInvoiceSchema = new mongoose.Schema(
  {
    record_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabCashierRecord',
      required: true,
      unique: true,
    },
    invoice_number: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    patient_name: {
      type: String,
      required: true,
      trim: true,
    },
    diseases: {
      type: [String],
      default: [],
    },
    sample_type: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    user_name: {
      type: String,
      trim: true,
    },
    user_role: {
      type: String,
      trim: true,
    },
    processed_by_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    status: {
      type: String,
      enum: ['paid', 'void'],
      default: 'paid',
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

labInvoiceSchema.index({ user_id: 1, created_at: -1 });

const LabInvoice = mongoose.models.LabInvoice || mongoose.model('LabInvoice', labInvoiceSchema);

export default LabInvoice;



