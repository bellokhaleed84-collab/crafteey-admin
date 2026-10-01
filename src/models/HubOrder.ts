import mongoose, { Schema, type Model, type Types } from "mongoose";

// Read-only copy of crafteey-client's HubOrder (same "huborders" collection).
// Only the fields the admin reads. autoIndex is off so this app never tries to
// create indexes on a collection the client app owns.
export interface IHubOrder {
  _id: Types.ObjectId;
  clientId: Types.ObjectId;
  vendorId: Types.ObjectId;
  vendorName: string;
  orderNumber: string;
  items: { name: string; unitPriceKobo: number; quantity: number }[];
  subtotalKobo: number;
  deliveryFeeKobo: number;
  totalKobo: number;
  vendorTier: string;
  vendorPayoutKobo: number;
  platformVendorRevenueKobo: number;
  vehicleType: string;
  riderEarningKobo: number;
  platformCommissionKobo: number;
  status: string;
  payment: { reference?: string; status?: string; paidAt?: Date; channel?: string };
  delivery: { address?: string; phone?: string; note?: string };
  vendorAcceptedAt?: Date;
  readyForPickupAt?: Date;
  cancelledBy?: string;
  cancelReason?: string;
  refund?: { status?: string; method?: string; amountKobo?: number; refundedAt?: Date };
  createdAt: Date;
  updatedAt: Date;
}

const HubOrderSchema = new Schema<IHubOrder>(
  {
    clientId: Schema.Types.ObjectId,
    vendorId: Schema.Types.ObjectId,
    vendorName: String,
    orderNumber: String,
    items: [{ _id: false, name: String, unitPriceKobo: Number, quantity: Number }],
    subtotalKobo: Number,
    deliveryFeeKobo: Number,
    totalKobo: Number,
    vendorTier: String,
    vendorPayoutKobo: Number,
    platformVendorRevenueKobo: Number,
    vehicleType: String,
    riderEarningKobo: Number,
    platformCommissionKobo: Number,
    status: String,
    payment: { reference: String, status: String, paidAt: Date, channel: String },
    delivery: { address: String, phone: String, note: String },
    vendorAcceptedAt: Date,
    readyForPickupAt: Date,
    cancelledBy: String,
    cancelReason: String,
    refund: { status: String, method: String, amountKobo: Number, refundedAt: Date },
  },
  { timestamps: true, autoIndex: false }
);

const HubOrder: Model<IHubOrder> =
  (mongoose.models.HubOrder as Model<IHubOrder>) || mongoose.model<IHubOrder>("HubOrder", HubOrderSchema);

export default HubOrder;