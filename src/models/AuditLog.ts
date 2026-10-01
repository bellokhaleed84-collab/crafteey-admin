import mongoose, { Schema, type Model } from "mongoose";

export interface IAuditLog {
  actorUid: string;
  actorEmail: string;
  actorName?: string;
  actorRole: string;
  action: string; // e.g. "staff.invite"
  targetType?: string;
  targetId?: string;
  summary: string;
  before?: unknown;
  after?: unknown;
  createdAt: Date;
}

// Add-only log of what admins did. Nothing in the app edits or deletes these rows.
const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorUid: { type: String, required: true, index: true },
    actorEmail: { type: String, required: true },
    actorName: String,
    actorRole: { type: String, required: true },
    action: { type: String, required: true, index: true },
    targetType: String,
    targetId: String,
    summary: { type: String, required: true },
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ createdAt: -1 });

const AuditLog: Model<IAuditLog> =
  (mongoose.models.AuditLog as Model<IAuditLog>) ||
  mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);

export default AuditLog;