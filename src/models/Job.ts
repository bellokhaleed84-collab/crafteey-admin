import mongoose, { model, models, Schema, Document } from "mongoose";
import { JOB_STATUS, JobStatusValue } from "@/lib/constants";

export interface IJobMedia {
  url: string;
  type: "image" | "video";
}

export interface IJob extends Document {
  // --- who asked for it (filled in by crafteey-client; null for jobs the admin posts by hand)
  clientUid: string | null;
  clientName: string;
  clientPhone: string;

  // --- what the job is
  category: string; // the trade, same text as TRADE_OPTIONS
  description: string;
  address: string; // area or typed address, no map
  media: IJobMedia[]; // photos and videos the client attached

  // --- older fields, kept so existing admin/technician screens keep working
  scheduledFor: string;
  price: number;

  // --- admin review — separate from dispatch status. "Accept" on the
  // requests list just means an admin has looked at it and it's not
  // being ignored; the job doesn't move to DISPATCHED until a
  // technician is actually assigned.
  reviewedByAdmin: boolean;
  reviewedAt: Date | null;

  // --- dispatch
  status: JobStatusValue;
  technicianUid: string | null;
  dispatchedAt: Date | null;
  dispatchedByUid: string | null;
  declinedBy: string[];
  completedAt?: string;

  createdAt: Date;
  updatedAt: Date;
}

const MediaSchema = new Schema<IJobMedia>(
  {
    url: { type: String, required: true },
    type: { type: String, enum: ["image", "video"], default: "image" },
  },
  { _id: false }
);

const JobSchema = new Schema<IJob>(
  {
    clientUid: { type: String, default: null },
    clientName: { type: String, default: "" },
    clientPhone: { type: String, default: "" },

    category: { type: String, required: true, index: true },
    description: { type: String, required: true },
    address: { type: String, required: true },
    media: { type: [MediaSchema], default: [] },

    scheduledFor: { type: String, default: "" },
    price: { type: Number, default: 0, min: 0 },

    reviewedByAdmin: { type: Boolean, default: false },
    reviewedAt: { type: Date, default: null },

    status: {
      type: String,
      required: true,
      enum: Object.values(JOB_STATUS),
      default: JOB_STATUS.NEW,
    },
    technicianUid: { type: String, default: null, index: true },
    dispatchedAt: { type: Date, default: null },
    dispatchedByUid: { type: String, default: null },
    declinedBy: { type: [String], default: [] },
    completedAt: { type: String },
  },
  { timestamps: true }
);

JobSchema.index({ status: 1, category: 1 });
JobSchema.index({ technicianUid: 1, status: 1 });
JobSchema.index({ clientUid: 1, createdAt: -1 });

export const Job: mongoose.Model<IJob> = models.Job || model<IJob>("Job", JobSchema);

export default Job;