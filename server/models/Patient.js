import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    address: {
      type: String,
      trim: true,
    },
    age: {
      type: Number,
      min: 0,
      max: 150,
    },
    conditions: [
      {
        type: String,
        trim: true,
      },
    ],
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate patients per user
patientSchema.index({ phone: 1, user_id: 1 }, { unique: true });

const Patient = mongoose.model('Patient', patientSchema);

export default Patient;

