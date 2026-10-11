import mongoose, { Schema, type Model } from "mongoose";

// Copy of crafteey-vendor's Vendor (same "vendors" collection). autoIndex is off so
// this app never creates indexes on a collection the vendor app owns. The admin
// writes only status, isApproved, isOpen, tier, tierRequest.status, rejectionReason
// and resubmittedAt.
export interface IVendor {
  uid: string;
  businessName: string;
  category: string;
  email: string;
  phone: string;
  address: string;
  logoUrl?: string;
  coverImageUrl?: string;
  description?: string;
  tagline?: string;
  bankDetails?: { accountName?: string; accountNumber?: string; bankName?: string };
  verificationDocUrl?: string;
  businessDocuments?: { type?: string; url?: string; uploadedAt?: Date }[];
  rejectionReason?: string;
  resubmittedAt?: Date | null;
  pickupInstructions?: string;
  tier?: string;
  tierRequest?: { requestedTier?: string; status?: string; requestedAt?: Date };
  status: string;
  isApproved: boolean;
  isOpen?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessDocumentSchema = new Schema({
  type: { type: String },
  url: String,
  uploadedAt: Date,
});

const VendorSchema = new Schema<IVendor>(
  {
    uid: String,
    businessName: String,
    category: String,
    email: String,
    phone: String,
    address: String,
    logoUrl: String,
    coverImageUrl: String,
    description: String,
    tagline: String,
    bankDetails: { accountName: String, accountNumber: String, bankName: String },
    verificationDocUrl: String,
    businessDocuments: [BusinessDocumentSchema],
    rejectionReason: String,
    resubmittedAt: Date,
    pickupInstructions: String,
    tier: String,
    tierRequest: { _id: false, requestedTier: String, status: String, requestedAt: Date },
    status: String,
    isApproved: Boolean,
    isOpen: Boolean,
  },
  { timestamps: true, autoIndex: false }
);

const Vendor: Model<IVendor> =
  (mongoose.models.Vendor as Model<IVendor>) || mongoose.model<IVendor>("Vendor", VendorSchema);

export default Vendor;