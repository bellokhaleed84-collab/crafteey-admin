import mongoose, { Schema, type Model } from "mongoose";

// Read-only copy of crafteey-vendor's Vendor (same "vendors" collection), trimmed
// to what the admin reads for now. Vendor approval will extend this later.
export interface IVendor {
  uid: string;
  businessName: string;
  category: string;
  email: string;
  phone: string;
  address: string;
  tier?: string;
  tierRequest?: { requestedTier?: string; status?: string; requestedAt?: Date };
  status: string;
  isApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VendorSchema = new Schema<IVendor>(
  {
    uid: String,
    businessName: String,
    category: String,
    email: String,
    phone: String,
    address: String,
    tier: String,
    tierRequest: { requestedTier: String, status: String, requestedAt: Date },
    status: String,
    isApproved: Boolean,
  },
  { timestamps: true, autoIndex: false }
);

const Vendor: Model<IVendor> =
  (mongoose.models.Vendor as Model<IVendor>) || mongoose.model<IVendor>("Vendor", VendorSchema);

export default Vendor;