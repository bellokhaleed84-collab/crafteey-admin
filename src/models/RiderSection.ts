import mongoose, { Schema, type Model } from "mongoose";

// Extra sections in the rider app's Settings list. The rider app reads the same collection.
export interface IRiderSection {
  slug: string;
  title: string;
  description: string;
  icon: string;
  group: "core" | "more";
  body: string;
  order: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RiderSectionSchema = new Schema<IRiderSection>(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true, maxlength: 40 },
    description: { type: String, default: "", maxlength: 100 },
    icon: { type: String, default: "\uD83D\uDCCC", maxlength: 8 },
    group: { type: String, enum: ["core", "more"], default: "more" },
    body: { type: String, default: "", maxlength: 20000 },
    order: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const RiderSection: Model<IRiderSection> =
  (mongoose.models.RiderSection as Model<IRiderSection>) ||
  mongoose.model<IRiderSection>("RiderSection", RiderSectionSchema);

export default RiderSection;