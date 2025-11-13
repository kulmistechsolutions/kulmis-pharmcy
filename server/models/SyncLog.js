import mongoose from 'mongoose';

const syncLogSchema = new mongoose.Schema(
  {
    tenant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    user_email: {
      type: String,
      trim: true,
    },
    target: {
      type: String,
      trim: true,
      required: true,
      index: true,
    },
    local_id: {
      type: String,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['queued', 'synced', 'failed', 'conflict'],
      required: true,
      index: true,
    },
    message: {
      type: String,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    retried_count: {
      type: Number,
      default: 0,
    },
    conflict_resolved_at: {
      type: Date,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

syncLogSchema.index({ tenant_id: 1, created_at: -1 });
syncLogSchema.index({ tenant_id: 1, status: 1, created_at: -1 });

const SyncLog = mongoose.models.SyncLog || mongoose.model('SyncLog', syncLogSchema);

export default SyncLog;




