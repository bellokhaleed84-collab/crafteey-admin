import mongoose, { Schema, type Model } from "mongoose";

// Read-only copy of crafteey-rider's Payout (same "payouts" collection).
export interface IPayout {
  courierUid: string;
  amountKobo: number;
  status: string;
  failureReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PayoutSchema = new Schema<IPayout>(
  {
    courierUid: String,
    amountKobo: Number,
    status: String,
    failureReason: String,
  },
  { timestamps: true, autoIndex: false }
);

const Payout: Model<IPayout> =
  (mongoose.models.Payout as Model<IPayout>) || mongoose.model<IPayout>("Payout", PayoutSchema);

export default Payout;