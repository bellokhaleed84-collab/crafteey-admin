import mongoose, { Schema, type Model } from "mongoose";

// Read-only copy of crafteey-rider's Transaction (same "transactions" collection):
// the rider wallet/debt ledger. amountKobo is always positive; `type` says which way it moved.
export interface ITransaction {
  courierUid: string;
  type: string; // hub_earning | direct_ride_debt | withdrawal | debt_payment
  amountKobo: number;
  walletBalanceAfterKobo: number;
  debtAfterKobo: number;
  sourceId?: string | null;
  label: string;
  status: string; // completed | pending | paid | failed
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    courierUid: String,
    type: String,
    amountKobo: Number,
    walletBalanceAfterKobo: Number,
    debtAfterKobo: Number,
    sourceId: String,
    label: String,
    status: String,
  },
  { timestamps: true, autoIndex: false }
);

const Transaction: Model<ITransaction> =
  (mongoose.models.Transaction as Model<ITransaction>) ||
  mongoose.model<ITransaction>("Transaction", TransactionSchema);

export default Transaction;