import mongoose, { model, models, Schema, Document } from 'mongoose';
import { TECHNICIAN_STATUS, AVAILABILITY, MIN_PORTFOLIO_PHOTOS, TechnicianStatus, Availability } from '@/lib/constants';

export interface ITechnician extends Document {
  firebaseUid: string;
  name: string;
  email: string;
  phone: string;
  categories: string[];
  yearsExperience: number;
  baseArea: string;
  idDocumentUrl: string;
  portfolioUrls: string[];
  status: TechnicianStatus;
  rejectionReason?: string;
  availability: Availability;
  fcmToken?: string;
  rating: number;
  completionRate: number;
  noShowRate: number;
  createdAt: Date;
  updatedAt: Date;
}

const TechnicianSchema = new Schema<ITechnician>(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    categories: { type: [String], required: true },
    yearsExperience: { type: Number, required: true, min: 0 },
    baseArea: { type: String, required: true },
    idDocumentUrl: { type: String, required: true },
    portfolioUrls: {
      type: [String],
      required: true,
      validate: [
        (val: string[]) => val.length >= MIN_PORTFOLIO_PHOTOS,
        `At least ${MIN_PORTFOLIO_PHOTOS} portfolio URLs required`,
      ],
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(TECHNICIAN_STATUS),
      default: TECHNICIAN_STATUS.PENDING,
    },
    rejectionReason: { type: String },
    availability: {
      type: String,
      enum: Object.values(AVAILABILITY),
      default: AVAILABILITY.OFFLINE,
    },
    fcmToken: { type: String },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    completionRate: { type: Number, default: 0, min: 0, max: 100 },
    noShowRate: { type: Number, default: 0, min: 0, max: 100 },
  },
  {
    timestamps: true,
  }
);

// firebaseUid is already indexed above (unique + index), so it is not indexed again here.
TechnicianSchema.index({ status: 1 });
TechnicianSchema.index({ availability: 1 });
TechnicianSchema.index({ categories: 1 });

export const Technician: mongoose.Model<ITechnician> =
  models.Technician || model<ITechnician>('Technician', TechnicianSchema);
