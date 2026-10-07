// Every action in the admin app is a permission. Roles are named bundles of
// permissions. The SERVER checks these on every API route; hiding a menu item
// is only for convenience.

export const ROLES = [
  "super_admin",
  "operations",
  "onboarding",
  "rider_management",
  "finance",
  "support",
] as const;
export type AdminRole = (typeof ROLES)[number];

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  operations: "Operations",
  onboarding: "Onboarding",
  rider_management: "Rider Management",
  finance: "Finance",
  support: "Support",
};

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  super_admin: "Full access, including staff management and the audit log.",
  operations: "Live orders, client requests, technician jobs, home banners, and viewing riders, vendors and companies.",
  onboarding: "Reviews technician, rider, vendor and company applications.",
  rider_management: "Reviews and manages riders.",
  finance: "Wallets, payouts, reports and other money views.",
  support: "Customers, orders (view only), complaints, reviews, disputes and chat moderation.",
};

export const PERMISSIONS = [
  "dashboard.view",
  "technicians.view",
  "technicians.review",
  "companies.view",
  "companies.review",
  "requests.view",
  "requests.manage",
  "jobs.view",
  "jobs.manage",
  "riders.view",
  "riders.review",
  "riders.manage",
  "vendors.view",
  "vendors.review",
  "orders.view",
  "orders.manage",
  "customers.view",
  "wallet.view",
  "wallet.adjust",
  "payouts.view",
  "payouts.run",
  "disputes.manage",
  "chat.moderate",
  "support.view",
  "support.manage",
  "reviews.manage",
  "banners.manage",
  "reports.view",
  "settings.manage",
  "staff.manage",
  "audit.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  operations: [
    "dashboard.view",
    "technicians.view",
    "companies.view",
    "requests.view",
    "requests.manage",
    "jobs.view",
    "jobs.manage",
    "riders.view",
    "vendors.view",
    "orders.view",
    "orders.manage",
    "customers.view",
    "banners.manage",
  ],
  onboarding: [
    "dashboard.view",
    "technicians.view",
    "technicians.review",
    "companies.view",
    "companies.review",
    "riders.view",
    "riders.review",
    "vendors.view",
    "vendors.review",
  ],
  rider_management: ["dashboard.view", "riders.view", "riders.review", "riders.manage"],
  finance: [
    "dashboard.view",
    "companies.view",
    "orders.view",
    "customers.view",
    "wallet.view",
    "wallet.adjust",
    "payouts.view",
    "payouts.run",
    "reports.view",
  ],
  support: [
    "dashboard.view",
    "companies.view",
    "customers.view",
    "orders.view",
    "wallet.view",
    "support.view",
    "support.manage",
    "reviews.manage",
    "disputes.manage",
    "chat.moderate",
  ],
};

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function permissionsForRole(role: string | undefined): Permission[] {
  return isAdminRole(role) ? [...ROLE_PERMISSIONS[role]] : [];
}

export function hasPermission(role: string | undefined, permission: Permission): boolean {
  return isAdminRole(role) && ROLE_PERMISSIONS[role].includes(permission);
}