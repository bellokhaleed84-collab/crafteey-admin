import mongoose, { Schema, type Model } from "mongoose";
import { BANNER_THEMES } from "@/lib/bannerThemes";

export interface IBanner {
  title: string;
  subtitle: string;
  buttonText: string;
  link: string;
  art: string;
  emoji: string;
  theme: string;
  placement: string;
  order: number;
  enabled: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const BannerSchema = new Schema<IBanner>(
  {
    title: { type: String, required: true, maxlength: 60 },
    subtitle: { type: String, default: "", maxlength: 120 },
    buttonText: { type: String, default: "", maxlength: 24 },
    link: { type: String, default: "/dashboard", maxlength: 300 },
    art: { type: String, default: "", maxlength: 500 },
    emoji: { type: String, default: "", maxlength: 8 },
    theme: { type: String, enum: BANNER_THEMES, default: "navy" },
    placement: { type: String, enum: ["home", "hub", "both", "rides"], default: "home" },
    order: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true },
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
  },
  { timestamps: true }
);

BannerSchema.index({ enabled: 1, order: 1 });

const Banner: Model<IBanner> =
  (mongoose.models.Banner as Model<IBanner>) || mongoose.model<IBanner>("Banner", BannerSchema);

export default Banner;