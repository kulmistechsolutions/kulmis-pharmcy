import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema(
  {
    tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      required: true,
    },
    user_name: {
      type: String,
      trim: true,
      required: true,
    },
    user_role: {
      type: String,
      trim: true,
    },
    module: {
      type: String,
      trim: true,
      required: true,
    },
    action: {
      type: String,
      trim: true,
      required: true,
    },
    message: {
      type: String,
      trim: true,
      required: true,
    },
    amount: {
      type: Number,
      default: 0,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

activityLogSchema.index({ tenant_id: 1, createdAt: -1 });
activityLogSchema.index({ user_id: 1, createdAt: -1 });
activityLogSchema.index({ module: 1, createdAt: -1 });

const ActivityLog =
  mongoose.models.ActivityLog || mongoose.model('ActivityLog', activityLogSchema);

export default ActivityLog;




