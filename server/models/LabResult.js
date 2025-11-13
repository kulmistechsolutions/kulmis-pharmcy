import mongoose from 'mongoose';

const labResultSchema = new mongoose.Schema(
  {
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabOrder',
      required: true,
      unique: true,
      index: true,
    },
    results: [
      {
        test_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'LabTest',
        },
        name: String,
        value: {
          type: String,
          required: true,
        },
        unit: String,
        reference_range: String,
        interpretation: {
          type: String,
          enum: ['Positive', 'Negative', 'Normal', 'Abnormal'],
          required: true,
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
        remarks: String,
      },
    ],
    overall_notes: String,
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    completed_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const LabResult = mongoose.model('LabResult', labResultSchema);

export default LabResult;

