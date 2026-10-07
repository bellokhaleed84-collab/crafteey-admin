import mongoose, { Schema, type Model } from "mongoose";

// One document with key "platform". The other apps can read the same collection.
export interface IPlatformSettings {
  key: string;
  debtAlertKobo: number;
  debtBlockKobo: number;
  riderSharePercent: number;
  commission: { basic: number; regular: number; premium: number };
  companyCommissionPercent: number;
  withdrawalDays: number[];
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformSettingsSchema = new Schema<IPlatformSettings>(
  {
    key: { type: String, required: true, unique: true },
    debtAlertKobo: Number,
    debtBlockKobo: Number,
    riderSharePercent: Number,
    commission: {
      type: new Schema({ basic: Number, regular: Number, premium: Number }, { _id: false }),
    },
    companyCommissionPercent: Number,
    withdrawalDays: [Number],
    updatedBy: String,
  },
  { timestamps: true }
);

const PlatformSettings: Model<IPlatformSettings> =
  (mongoose.models.PlatformSettings as Model<IPlatformSettings>) ||
  mongoose.model<IPlatformSettings>("PlatformSettings", PlatformSettingsSchema);

export default PlatformSettings;