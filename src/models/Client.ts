import mongoose, { Schema, type Model } from "mongoose";

// Read-only copy of crafteey-client's Client (same "clients" collection).
export interface IClient {
  firebaseUid: string;
  name: string;
  email: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
}

const ClientSchema = new Schema<IClient>(
  { firebaseUid: String, name: String, email: String, phone: String },
  { timestamps: true, autoIndex: false }
);

const Client: Model<IClient> =
  (mongoose.models.Client as Model<IClient>) || mongoose.model<IClient>("Client", ClientSchema);

export default Client;