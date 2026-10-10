import mongoose, { Schema, type Model } from "mongoose";

// Same collection as the rider app's DeliveryReport ("deliveryreports").
// Riders write to it; admin reads it and marks reports fixed.
export const REPORT_KINDS = ["problem", "emergency", "gave_up"] as const;

export interface IDeliveryReport {
  kind: (typeof REPORT_KINDS)[number];
  requestId: string;
  courierUid: string;
  courierName: string;
  courierPhone: string;
  clientName: string;
  pickup: string;
  dropoff: string;
  source: string;
  orderNumber: string | null;
  reason: string;
  note: string;
  location: { lat: number; lng: number } | null;
  status: "open" | "resolved";
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryReportSchema = new Schema<IDeliveryReport>(
  {
    kind: { type: String, enum: REPORT_KINDS, required: true, index: true },
    requestId: { type: String, required: true, index: true },
    courierUid: { type: String, required: true, index: true },
    courierName: { type: String, default: "" },
    courierPhone: { type: String, default: "" },

    clientName: { type: String, default: "" },
    pickup: { type: String, default: "" },
    dropoff: { type: String, default: "" },
    source: { type: String, default: "direct" },
    orderNumber: { type: String, default: null },

    reason: { type: String, default: "" },
    note: { type: String, default: "" },
    location: {
      type: new Schema({ lat: Number, lng: Number }, { _id: false }),
      default: null,
    },

    status: { type: String, enum: ["open", "resolved"], default: "open", index: true },
    resolvedBy: { type: String },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

const DeliveryReport: Model<IDeliveryReport> =
  (mongoose.models.DeliveryReport as Model<IDeliveryReport>) ||
  mongoose.model<IDeliveryReport>("DeliveryReport", DeliveryReportSchema);

export default DeliveryReport;