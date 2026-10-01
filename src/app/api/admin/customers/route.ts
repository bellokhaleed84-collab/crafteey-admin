import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/middleware/adminAuth";
import { hasPermission } from "@/lib/permissions";
import { connectToDatabase } from "@/lib/mongodb";
import Client from "@/models/Client";
import HubOrder from "@/models/HubOrder";
import { CANCELLED_STATUSES } from "@/lib/orderStatus";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** GET /api/admin/customers?q=&page=1 (read-only) */
export async function GET(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "customers.view");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") || "").trim().slice(0, 80);
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);

    const filter: Record<string, unknown> = {};
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
    }

    const [customers, total] = await Promise.all([
      Client.find(filter)
        .select("name email phone createdAt")
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      Client.countDocuments(filter),
    ]);

    // Paid order count (and spend, for report viewers only) for just this page.
    const seesMoney = hasPermission(admin.role, "reports.view");
    const stats = customers.length
      ? await HubOrder.aggregate<{ _id: unknown; orders: number; spentKobo: number }>([
          { $match: { clientId: { $in: customers.map((c) => c._id) }, "payment.status": "success" } },
          {
            $group: {
              _id: "$clientId",
              orders: { $sum: 1 },
              spentKobo: {
                $sum: { $cond: [{ $in: ["$status", CANCELLED_STATUSES] }, 0, { $ifNull: ["$totalKobo", 0] }] },
              },
            },
          },
        ])
      : [];
    const byId = new Map(stats.map((s) => [String(s._id), s]));

    return NextResponse.json({
      customers: customers.map((c) => {
        const s = byId.get(String(c._id));
        return {
          _id: String(c._id),
          name: c.name,
          email: c.email,
          phone: c.phone,
          createdAt: c.createdAt,
          orders: s?.orders ?? 0,
          ...(seesMoney ? { spentKobo: s?.spentKobo ?? 0 } : {}),
        };
      }),
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      total,
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/customers");
  }
}