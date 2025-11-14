import mongoose from 'mongoose';

const pharmacySettingSchema = new mongoose.Schema(
  {
    pharmacy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    name: {
      type: String,
      trim: true,
    },
    owner_name: {
      type: String,
      trim: true,
    },
    logo_url: {
      type: String,
      trim: true,
    },
    logo_file_id: {
      type: String,
      trim: true,
    },
    logo_thumbnail_url: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      trim: true,
    },
    about: {
      type: String,
      trim: true,
      maxlength: 600,
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

const PharmacySetting =
  mongoose.models.PharmacySetting || mongoose.model('PharmacySetting', pharmacySettingSchema);

export default PharmacySetting;




