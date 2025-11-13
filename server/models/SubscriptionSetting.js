import mongoose from 'mongoose';

const limitationSchema = new mongoose.Schema(
  {
    maxInvoices: { type: Number, default: null },
    maxMedicines: { type: Number, default: null },
    maxLabRecords: { type: Number, default: null },
  },
  {
    _id: false,
  }
);

const subscriptionSettingSchema = new mongoose.Schema(
  {
    freeTrial: {
      enabled: {
        type: Boolean,
        default: true,
      },
      defaultDurationDays: {
        type: Number,
        default: 30,
        min: 1,
      },
      defaultPlan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan',
        default: null,
      },
      autoLockBehavior: {
        type: String,
        enum: ['lock', 'notice'],
        default: 'lock',
      },
      limitations: {
        type: limitationSchema,
        default: {},
      },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

subscriptionSettingSchema.statics.getSettings = async function () {
  let settings = await this.findOne({})
    .populate({ path: 'freeTrial.defaultPlan', select: 'name duration_days planType status' })
    .lean();

  if (!settings) {
    settings = await this.create({});
    settings = await this.findById(settings._id)
      .populate({ path: 'freeTrial.defaultPlan', select: 'name duration_days planType status' })
      .lean();
  }

  return settings;
};

const SubscriptionSetting =
  mongoose.models.SubscriptionSetting ||
  mongoose.model('SubscriptionSetting', subscriptionSettingSchema);

export default SubscriptionSetting;


