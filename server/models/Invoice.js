import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema(
  {
    invoice_number: {
      type: String,
      unique: true,
      sparse: true, // Allow null values for unique index
    },
    type: {
      type: String,
      enum: ['pharmacy', 'lab'],
      default: 'pharmacy',
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    patient_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      index: true,
    },
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabOrder',
      index: true,
    },
    customer_name: {
      type: String,
      trim: true,
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
    payment_method: {
      type: String,
      trim: true,
    },
    items: [
      {
        title: String,
        qty: {
          type: Number,
          default: 1,
        },
        price: Number,
        total: Number,
      },
    ],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['Pending', 'Paid', 'Cancelled'],
      default: 'Paid',
    },
    meta: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate invoice number before validation
invoiceSchema.pre('validate', async function (next) {
  if (!this.invoice_number) {
    try {
      // Get the model to avoid circular dependency issues
      const InvoiceModel = this.constructor;
      // Count all invoices to generate unique number
      const count = await InvoiceModel.countDocuments();
      // Generate invoice number: INV-YYYY-XXXXX
      const year = new Date().getFullYear();
      const number = String(count + 1).padStart(5, '0');
      this.invoice_number = `INV-${year}-${number}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

const Invoice = mongoose.model('Invoice', invoiceSchema);

export default Invoice;

