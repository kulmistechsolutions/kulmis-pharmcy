import mongoose from 'mongoose';

const debtSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    debtor_name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    whatsapp: String,
    due_date: {
      type: Date,
      required: true,
    },
    balance: {
      type: Number,
      required: true,
      min: 0,
    },
    paid: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['Pending', 'Partial', 'Paid', 'Overdue'],
      default: 'Pending',
      index: true,
    },
    medicines: [
      {
        name: String,
        quantity: Number,
        price: Number,
      },
    ],
    reminder_sent: {
      type: Boolean,
      default: false,
    },
    last_reminder_method: {
      type: String,
      enum: ['WhatsApp', 'SMS'],
      default: null,
    },
    last_reminder_date: Date,
  },
  {
    timestamps: true,
  }
);

const Debt = mongoose.model('Debt', debtSchema);

export default Debt;

