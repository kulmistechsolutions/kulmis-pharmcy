import mongoose from 'mongoose';

const labTestSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    unit: {
      type: String,
      trim: true,
    },
    reference_range: {
      type: String,
      trim: true,
    },
    default_price: {
      type: Number,
      required: true,
      min: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const LabTest = mongoose.model('LabTest', labTestSchema);

export default LabTest;

