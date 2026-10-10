import mongoose, { Schema, type Model } from "mongoose";

// Copy of the delivery request shared by crafteey-client and crafteey-rider.
// Its status is the DELIVERY status, not the rider account status in constants.ts.
// pickupCode and deliveryCode are left out on purpose so they can never reach an admin screen.
// deliveryCodeAttempts is here only so admin can unlock a locked delivery.
export interface ICourierRequest {
  clientName: string;
  clientPhone: string;
  pickup: string;
  dropoff: string;
  vehicleType: string;
  riderEarningKobo: number | null;
  source: string;
  hubOrderId: string | null;
  orderNumber: string | null;
  vendorName: string;
  status: string;
  courierUid: string | null;
  courierName: string | null;
  courierPhone: string | null;
  deliveryCodeAttempts?: number;
  createdAt: Date;
  updatedAt: Date;
}

const CourierRequestSchema = new Schema<ICourierRequest>(
  {
    clientName: String,
    clientPhone: String,
    pickup: String,
    dropoff: String,
    vehicleType: String,
    riderEarningKobo: Number,
    source: String,
    hubOrderId: String,
    orderNumber: String,
    vendorName: String,
    status: String,
    courierUid: String,
    courierName: String,
    courierPhone: String,
    deliveryCodeAttempts: Number,
  },
  { timestamps: true, autoIndex: false }
);

const CourierRequest: Model<ICourierRequest> =
  (mongoose.models.CourierRequest as Model<ICourierRequest>) ||
  mongoose.model<ICourierRequest>("CourierRequest", CourierRequestSchema);

export default CourierRequest;