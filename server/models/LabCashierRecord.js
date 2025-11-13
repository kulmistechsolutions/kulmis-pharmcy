import mongoose from 'mongoose';

const LAB_DISEASES = [
  'Malaria',
  'Typhoid',
  'Diabetes',
  'Hepatitis',
  'Cholera',
  'COVID-19',
  'Tuberculosis',
  'HIV',
  'Dengue Fever',
  'Influenza',
  'Other',
];

const labCashierSchema = new mongoose.Schema(
  {
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
    phone: {
      type: String,
      trim: true,
    },
    age: {
      type: Number,
      min: 0,
      max: 130,
    },
    diseases: {
      type: [String],
      required: true,
      validate: {
        validator: function (arr) {
          return Array.isArray(arr) && arr.length > 0;
        },
        message: 'Select at least one disease or symptom',
      },
    },
    sample_type: {
      type: String,
      enum: ['Blood', 'Urine', 'Stool', 'Swab', 'Other'],
      required: true,
    },
    sample_notes: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      default: () => new Date(),
    },
    status: {
      type: String,
      enum: ['process', 'pending', 'complete'],
      default: 'process',
    },
    cashier_name: {
      type: String,
      trim: true,
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
  },
  {
    timestamps: true,
  }
);

labCashierSchema.index({ user_id: 1, date: -1 });
labCashierSchema.index({ status: 1 });

export const DEFAULT_DISEASES = LAB_DISEASES;

const LabCashierRecord = mongoose.models.LabCashierRecord || mongoose.model('LabCashierRecord', labCashierSchema);

export default LabCashierRecord;



