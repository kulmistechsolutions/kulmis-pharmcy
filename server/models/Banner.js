import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    image_url: {
      type: String,
      required: true,
      trim: true,
    },
    target_users: {
      type: [String],
      default: ['all'],
      validate: {
        validator: function (arr) {
          return Array.isArray(arr) && arr.length > 0;
        },
        message: 'target_users must contain at least one entry',
      },
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    expiry_date: {
      type: Date,
      default: null,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

bannerSchema.index({ status: 1 });
bannerSchema.index({ expiry_date: 1 });

if (mongoose.models.Banner) {
  delete mongoose.models.Banner;
  delete mongoose.connection.models.Banner;
  delete mongoose.modelSchemas.Banner;
}

const Banner = mongoose.model('Banner', bannerSchema);

export default Banner;





