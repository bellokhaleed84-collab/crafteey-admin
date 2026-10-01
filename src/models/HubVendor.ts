import mongoose, { Schema, type Model } from "mongoose";

// Copy of crafteey-client's HubVendor (same "hubvendors" collection). The admin
// creates/updates these on vendor approval. autoIndex is off: the client app owns
// the indexes (ownerUid unique + sparse). No schema defaults here, on purpose:
// every value the admin writes is explicit.
export interface IHubVendor {
  ownerUid?: string;
  name: string;
  categories: string[];
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  address?: string;
  lat?: number;
  lng?: number;
  tagline?: string;
  isOpen: boolean;
  isActive: boolean;
  tier: string;
}

const HubVendorSchema = new Schema<IHubVendor>(
  {
    ownerUid: String,
    name: String,
    categories: [String],
    description: String,
    logoUrl: String,
    bannerUrl: String,
    address: String,
    lat: Number,
    lng: Number,
    tagline: String,
    isOpen: Boolean,
    isActive: Boolean,
    tier: String,
  },
  { timestamps: true, autoIndex: false }
);

const HubVendor: Model<IHubVendor> =
  (mongoose.models.HubVendor as Model<IHubVendor>) ||
  mongoose.model<IHubVendor>("HubVendor", HubVendorSchema);

export default HubVendor;