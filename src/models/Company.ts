import { Schema, models, model, type Model } from "mongoose";

export type CompanyStatus = "pending" | "approved" | "rejected" | "suspended";
export type CompanyPriceRange = "low" | "mid" | "high";

export interface ICompany {
  uid: string; // Firebase uid of the owner
  businessName: string;
  email: string;
  phone: string;
  trades: string[];
  areas: string[];
  description?: string;
  yearsOperating: number;
  technicianCount: number;
  priceRange: CompanyPriceRange;
  address: string;
  logoUrl?: string;
  photos: string[];
  documents: {
    businessRegistrationUrl: string;
    idCardUrl: string;
    certificationUrls: string[];
    otherUrls: string[];
  };
  // Filled in by admin after the owner signs the agreement at the office.
  agreement: {
    signed: boolean;
    version?: string;
    signedAt?: Date;
    recordedByUid?: string;
    recordedByName?: string;
    notes?: string;
  };
  status: CompanyStatus;
  isApproved: boolean; // always follows status
  statusReason?: string; // why it was rejected or suspended
  verified: boolean; // verified badge
  isOnline: boolean;
  rating: number;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const CompanySchema = new Schema<ICompany>(
  {
    uid: { type: String, required: true, unique: true, index: true },
    businessName: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    trades: { type: [String], default: [] },
    areas: { type: [String], default: [] },
    description: { type: String, maxlength: 600 },
    yearsOperating: { type: Number, required: true, min: 0, max: 80 },
    technicianCount: { type: Number, required: true, min: 1, max: 500 },
    priceRange: { type: String, enum: ["low", "mid", "high"], required: true },
    address: { type: String, required: true, trim: true, maxlength: 200 },
    logoUrl: { type: String },
    photos: { type: [String], default: [] },
    documents: {
      businessRegistrationUrl: { type: String, required: true },
      idCardUrl: { type: String, required: true },
      certificationUrls: { type: [String], default: [] },
      otherUrls: { type: [String], default: [] },
    },
    agreement: {
      signed: { type: Boolean, default: false },
      version: { type: String },
      signedAt: { type: Date },
      recordedByUid: { type: String },
      recordedByName: { type: String },
      notes: { type: String, maxlength: 300 },
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending",
    },
    isApproved: { type: Boolean, default: false },
    statusReason: { type: String },
    verified: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// For browse and search in the client app later.
CompanySchema.index({ status: 1, trades: 1 });
CompanySchema.index({ status: 1, areas: 1 });

const Company: Model<ICompany> =
  (models.Company as Model<ICompany>) || model<ICompany>("Company", CompanySchema);

export default Company;