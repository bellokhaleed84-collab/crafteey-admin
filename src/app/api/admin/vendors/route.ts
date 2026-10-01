import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import Vendor from "@/models/Vendor";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const KNOWN = ["approved", "rejected", "suspended"];

// "pending" also catches old test vendors with a missing or odd status.
const TAB_FILTERS: Record<string, Record<string, unknown>> = {
  pending: { status: { $nin: KNOWN } },
  approved: { status: "approved" },
  rejected: { status: "rejected" },
  suspended: { status: "suspended" },
  tier_requests: { "tierRequest.status": "pending" },
};

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** GET /api/admin/vendors?tab=pending&q=&page=1 */
export async function GET(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "vendors.view");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const sp = req.nextUrl.searchParams;
    const tab = sp.get("tab") && TAB_FILTERS[sp.get("tab") as string] ? (sp.get("tab") as string) : "pending";
    const q = (sp.get("q") || "").trim().slice(0, 80);
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);

    const filter: Record<string, unknown> = { ...TAB_FILTERS[tab] };
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ businessName: rx }, { email: rx }, { phone: rx }];
    }

    const tabNames = Object.keys(TAB_FILTERS);
    const [vendors, total, ...countValues] = await Promise.all([
      Vendor.find(filter)
        .select("businessName category email phone tier tierRequest status isApproved isOpen createdAt")
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      Vendor.countDocuments(filter),
      ...tabNames.map((t) => Vendor.countDocuments(TAB_FILTERS[t])),
    ]);

    const counts: Record<string, number> = {};
    tabNames.forEach((t, i) => (counts[t] = countValues[i] as number));

    return NextResponse.json({
      vendors,
      counts,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      total,
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/vendors");
  }
}