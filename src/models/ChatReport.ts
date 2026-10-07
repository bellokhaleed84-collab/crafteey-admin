import mongoose, { Schema, type Model } from "mongoose";

export const REPORT_REASONS = ["contact_outside", "abusive", "scam", "unsafe", "fake_request", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ["open", "reviewed", "action_taken", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export interface IChatReport {
  reporterUid: string;
  reporterRole: "client" | "company";
  conversationId: string;
  companyId: string;
  companyName: string;
  clientUid: string;
  clientName: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  adminNote?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ChatReportSchema = new Schema<IChatReport>(
  {
    reporterUid: { type: String, required: true, index: true },
    reporterRole: { type: String, enum: ["client", "company"], required: true },
    conversationId: { type: String, required: true, index: true },
    companyId: { type: String, required: true, index: true },
    companyName: { type: String, default: "" },
    clientUid: { type: String, required: true },
    clientName: { type: String, default: "" },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, default: "", maxlength: 500 },
    status: { type: String, enum: REPORT_STATUSES, default: "open" },
    adminNote: { type: String, maxlength: 500 },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

ChatReportSchema.index({ status: 1, createdAt: -1 });
ChatReportSchema.index({ reporterUid: 1, conversationId: 1, status: 1 });

const ChatReport: Model<IChatReport> =
  (mongoose.models.ChatReport as Model<IChatReport>) ||
  mongoose.model<IChatReport>("ChatReport", ChatReportSchema);

export default ChatReport;