import mongoose, { Schema, type Model } from "mongoose";

export interface IBlockedMessage {
  uid: string;
  role: "client" | "company";
  conversationId: string;
  companyId: string;
  text: string;
  reason: string;
  createdAt: Date;
}

const BlockedMessageSchema = new Schema<IBlockedMessage>(
  {
    uid: { type: String, required: true, index: true },
    role: { type: String, enum: ["client", "company"], required: true },
    conversationId: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    text: { type: String, required: true, maxlength: 1000 },
    reason: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

BlockedMessageSchema.index({ uid: 1, createdAt: -1 });

const BlockedMessage: Model<IBlockedMessage> =
  (mongoose.models.BlockedMessage as Model<IBlockedMessage>) ||
  mongoose.model<IBlockedMessage>("BlockedMessage", BlockedMessageSchema);

export default BlockedMessage;