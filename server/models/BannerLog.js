import mongoose from 'mongoose';

const bannerLogSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    banner_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Banner',
      required: true,
      index: true,
    },
    dismissed: {
      type: Boolean,
      default: false,
    },
    dismissed_at: {
      type: Date,
      default: null,
    },
    force_hidden: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

bannerLogSchema.index({ user_id: 1, banner_id: 1 }, { unique: true });

if (mongoose.models.BannerLog) {
  delete mongoose.models.BannerLog;
  delete mongoose.connection.models.BannerLog;
  delete mongoose.modelSchemas.BannerLog;
}

const BannerLog = mongoose.model('BannerLog', bannerLogSchema);

export default BannerLog;





