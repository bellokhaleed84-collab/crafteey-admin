import mongoose, { Schema, type Document, type Model } from "mongoose";
import { COURIER_STATUS, VEHICLE_TYPES, type CourierStatus } from "@/lib/constants";

export interface ICourier extends Document {
  firebaseUid: string;
  name: string;
  phone: string;
  vehicleType: string;
  vehiclePlate: string;
  idNumber: string;
  idPhotoUrl: string;
  status: CourierStatus;
  rejectionReason?: string;
  resubmittedAt?: Date | null;
  isOnline: boolean;
  currentLocation: { lat: number; lng: number } | null;
  createdAt: Date;
  updatedAt: Date;
}

// IMPORTANT: field names here must match crafteey-rider's src/models/Courier.ts
// exactly — both apps read/write the same "couriers" collection in the same
// database. If you add a field on one side, add it here too.
const CourierSchema = new Schema<ICourier>(
  {
    firebaseUid: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    vehicleType: { type: String, enum: VEHICLE_TYPES, required: true },
    vehiclePlate: { type: String, default: "" },
    idNumber: { type: String, default: "" },
    idPhotoUrl: { type: String, default: "" },
    status: {
      type: String,
      enum: Object.values(COURIER_STATUS),
      default: COURIER_STATUS.PENDING,
    },
    // Why the application was rejected (the rider sees this), and when the
    // rider last sent a new document after a rejection.
    rejectionReason: { type: String, default: "" },
    resubmittedAt: { type: Date, default: null },
    isOnline: { type: Boolean, default: false },
    currentLocation: {
      type: new Schema({ lat: Number, lng: Number }, { _id: false }),
      default: null,
    },
  },
  { timestamps: true }
);

const Courier: Model<ICourier> =
  mongoose.models.Courier || mongoose.model<ICourier>("Courier", CourierSchema);

export default Courier;