import mongoose, { Schema, type Model } from "mongoose";
import { ROLES, type AdminRole } from "@/lib/permissions";

export type AdminStatus = "invited" | "active" | "deactivated";

export interface IAdminUser {
  email: string;
  name: string;
  role: AdminRole;
  status: AdminStatus;
  firebaseUid?: string;
  invitedBy?: string; // email of the admin who added them
  joinedAt?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AdminUserSchema = new Schema<IAdminUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    role: { type: String, enum: ROLES, required: true },
    status: { type: String, enum: ["invited", "active", "deactivated"], default: "invited", index: true },
    firebaseUid: { type: String, unique: true, sparse: true },
    invitedBy: String,
    joinedAt: Date,
    lastLoginAt: Date,
  },
  { timestamps: true }
);

const AdminUser: Model<IAdminUser> =
  (mongoose.models.AdminUser as Model<IAdminUser>) ||
  mongoose.model<IAdminUser>("AdminUser", AdminUserSchema);

export default AdminUser;