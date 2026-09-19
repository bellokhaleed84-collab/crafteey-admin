// src/lib/constants.ts  (crafteey-admin)

// ---------------------------------------------------------------- Technicians
export const TECHNICIAN_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  SUSPENDED: "suspended",
  BLACKLISTED: "blacklisted",
} as const;

export type TechnicianStatus =
  (typeof TECHNICIAN_STATUS)[keyof typeof TECHNICIAN_STATUS];

// CHECK: copy the real values from fixteq-technicians-portal/src/lib/constants.ts if they differ.
export const AVAILABILITY = {
  AVAILABLE: "available",
  BUSY: "busy",
  OFFLINE: "offline",
} as const;

export type Availability = (typeof AVAILABILITY)[keyof typeof AVAILABILITY];

// CHECK: must match the technician portal's registration rule.
export const MIN_PORTFOLIO_PHOTOS = 3;

// ---------------------------------------------------------------------- Admin
export const ADMIN_ROLE = {
  SUPER_ADMIN: "super_admin",
  REVIEWER: "reviewer",
} as const;

export type AdminRole = (typeof ADMIN_ROLE)[keyof typeof ADMIN_ROLE];

// ----------------------------------------------------------------------- Jobs
export const JOB_STATUS = {
  // older admin-posted pool jobs
  NEW: "new",
  ACCEPTED: "accepted",
  // client requests and dispatch
  PENDING: "pending", // client asked for a job, waiting for the admin to dispatch
  DISPATCHED: "dispatched",
  ON_THE_WAY: "on_the_way",
  ARRIVED: "arrived",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type JobStatusValue = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

// CHECK: this list must be identical, word for word, to the technician portal's
// TRADE_OPTIONS. Jobs are matched to technicians by exact text.
export const TRADE_OPTIONS = [
  "Electrician",
  "Plumber",
  "Carpenter",
  "Painter",
  "Mason/Bricklayer",
  "AC Technician",
  "Generator Technician",
  "Inverter/Solar Installer",
  "Tiler",
  "POP Ceiling Installer",
  "Aluminum/Window Fabricator",
  "Roofing Specialist",
  "Interior Decorator",
  "Furniture Repair",
  "CCTV Installer",
  "Satellite/DSTV Installer",
  "Home Network/WiFi Technician",
  "Appliance Repair (fridge, washing machine)",
  "Pest Control",
  "Cleaner (deep cleaning)",
  "Movers/Relocation Help",
  "Event Decorator",
  "Photographer",
  "Makeup Artist",
  "Mechanic",
] as const;

export type TradeOption = (typeof TRADE_OPTIONS)[number];

// --------------------------------------------------------------------- Couriers
// Mirrors the courier account status set from crafteey-rider (pending/
// approved/rejected), extended with suspended/blacklisted for parity
// with technician moderation controls. crafteey-rider's own schema only
// ever writes pending/approved/rejected, so the extra two values are
// admin-only actions — safe to add here without touching the rider app.
export const COURIER_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  SUSPENDED: "suspended",
  BLACKLISTED: "blacklisted",
} as const;

export type CourierStatus = (typeof COURIER_STATUS)[keyof typeof COURIER_STATUS];

export const VEHICLE_TYPES = ["Motorcycle", "Bicycle", "Car", "Van/Truck"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];
