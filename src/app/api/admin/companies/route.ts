import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import Company from "@/models/Company";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const KNOWN = ["approved", "rejected", "suspended"];

// "pending" also catches any record with a missing or odd status.
const TAB_FILTERS: Record<string, Record<string, unknown>> = {
  pending: { status: { $nin: KNOWN } },
  approved: { status: "approved" },
  rejected: { status: "rejected" },
  suspended: { status: "suspended" },
};

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** GET /api/admin/companies?tab=pending&q=&page=1 */
export async function GET(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "companies.view");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const sp = req.nextUrl.searchParams;
    const tabParam = sp.get("tab") || "";
    const tab = TAB_FILTERS[tabParam] ? tabParam : "pending";
    const q = (sp.get("q") || "").trim().slice(0, 80);
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);

    const filter: Record<string, unknown> = { ...TAB_FILTERS[tab] };
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ businessName: rx }, { email: rx }, { phone: rx }];
    }

    const tabNames = Object.keys(TAB_FILTERS);
    const [companies, total, ...countValues] = await Promise.all([
      Company.find(filter)
        .select("businessName email phone trades areas status isApproved verified agreement.signed createdAt")
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      Company.countDocuments(filter),
      ...tabNames.map((t) => Company.countDocuments(TAB_FILTERS[t])),
    ]);

    const counts: Record<string, number> = {};
    tabNames.forEach((t, i) => (counts[t] = countValues[i] as number));

    return NextResponse.json({
      companies,
      counts,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      total,
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/companies");
  }
}