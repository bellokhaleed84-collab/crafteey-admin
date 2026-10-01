// Copy of crafteey-client/lib/hub/config.ts categories. Keep in sync.
export const HUB_CATEGORIES = ["food", "groceries", "drinks", "marketplace"] as const;
export type HubCategory = (typeof HUB_CATEGORIES)[number];

export const HUB_CATEGORY_LABELS: Record<HubCategory, string> = {
  food: "Food",
  groceries: "Groceries",
  drinks: "Drinks",
  marketplace: "Marketplace",
};

export function isHubCategory(v: unknown): v is HubCategory {
  return typeof v === "string" && (HUB_CATEGORIES as readonly string[]).includes(v);
}

// Copy of the vendor tiers. Percentages must match crafteey-client/lib/pricing/vendorCommission.ts.
export type VendorTier = "basic" | "regular" | "premium";
export const VENDOR_TIERS: readonly VendorTier[] = ["basic", "regular", "premium"];
export const TIER_LABELS: Record<VendorTier, string> = {
  basic: "Basic (15%)",
  regular: "Regular (20%)",
  premium: "Premium (30%)",
};

export function isVendorTier(v: unknown): v is VendorTier {
  return typeof v === "string" && (VENDOR_TIERS as readonly string[]).includes(v);
}