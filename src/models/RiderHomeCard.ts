import mongoose, { Schema, type Model } from "mongoose";
import { CARD_COLORS, CARD_ICONS } from "@/lib/riderContent";

// Cards on the rider app's Home screen. The rider app reads the same collection.
export interface IRiderHomeCard {
  title: string;
  message: string;
  icon: string;
  color: string;
  order: number;
  enabled: boolean;
  schedule: { always: boolean; days: number[]; start: string; end: string };
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const RiderHomeCardSchema = new Schema<IRiderHomeCard>(
  {
    title: { type: String, required: true, maxlength: 40 },
    message: { type: String, default: "", maxlength: 1200 },
    icon: { type: String, enum: CARD_ICONS, default: "info" },
    color: { type: String, enum: CARD_COLORS, default: "orange" },
    order: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true },
    schedule: {
      always: { type: Boolean, default: true },
      days: { type: [Number], default: [] },
      start: { type: String, default: "17:00" },
      end: { type: String, default: "21:00" },
    },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
  },
  { timestamps: true }
);

RiderHomeCardSchema.index({ enabled: 1, order: 1 });

const RiderHomeCard: Model<IRiderHomeCard> =
  (mongoose.models.RiderHomeCard as Model<IRiderHomeCard>) ||
  mongoose.model<IRiderHomeCard>("RiderHomeCard", RiderHomeCardSchema);

export default RiderHomeCard;