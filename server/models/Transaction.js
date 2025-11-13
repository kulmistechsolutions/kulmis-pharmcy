import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    // Legacy sales transaction fields (per-medicine entries)
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      required: false,
    },
    medicine_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
    },
    quantity: {
      type: Number,
      min: 0,
    },
    total_sale: {
      type: Number,
      min: 0,
    },
    buying_price: {
      type: Number,
      min: 0,
    },
    selling_price: {
      type: Number,
      min: 0,
    },
    profit: {
      type: Number,
      default: 0,
    },
    is_loss_sale: {
      type: Boolean,
      default: false,
    },
    customer_name: {
      type: String,
      trim: true,
    },
    payment_method: {
      type: String,
      enum: ['Cash', 'Card', 'Mobile Money', 'Bank Transfer', 'Pending', 'Other'],
    },
    processed_by_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    processed_by_name: {
      type: String,
      trim: true,
    },
    processed_by_role: {
      type: String,
      trim: true,
    },
    user_name: {
      type: String,
      trim: true,
    },

    // Unified transaction ledger fields
    tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    invoice_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      index: true,
    },
    invoice_number: {
      type: String,
      trim: true,
      index: true,
    },
    transaction_type: {
      type: String,
      enum: ['sale', 'lab_cash', 'expense', 'debt_recovery', 'adjustment'],
    },
    amount: {
      type: Number,
      min: 0,
    },
    profit_total: {
      type: Number,
      default: 0,
    },
    loss_total: {
      type: Number,
      default: 0,
    },
    handled_by_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    handled_by_name: {
      type: String,
      trim: true,
    },
    handled_by_role: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['success', 'pending', 'cancelled'],
      default: 'success',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

transactionSchema.index({ transaction_type: 1, createdAt: -1 });
transactionSchema.index({ tenant_id: 1, createdAt: -1 });
transactionSchema.index({ handled_by_id: 1, createdAt: -1 });

const Transaction =
  mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema, 'transactions');

export default Transaction;

