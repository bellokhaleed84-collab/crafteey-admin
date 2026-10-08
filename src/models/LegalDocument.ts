import mongoose, { Schema, type Model } from "mongoose";

export interface ILegalDocument {
  slug: string;
  body: string;
  version: number;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LegalDocumentSchema = new Schema<ILegalDocument>(
  {
    slug: { type: String, required: true, unique: true },
    body: { type: String, required: true, maxlength: 60000 },
    version: { type: Number, default: 1 },
    updatedBy: { type: String },
  },
  { timestamps: true }
);

const LegalDocument: Model<ILegalDocument> =
  (mongoose.models.LegalDocument as Model<ILegalDocument>) ||
  mongoose.model<ILegalDocument>("LegalDocument", LegalDocumentSchema);

export default LegalDocument;