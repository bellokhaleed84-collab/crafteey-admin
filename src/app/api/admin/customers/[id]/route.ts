import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePermission } from "@/middleware/adminAuth";
import { hasPermission } from "@/lib/permissions";
import { connectToDatabase } from "@/lib/mongodb";
import Client from "@/models/Client";
import HubOrder from "@/models/HubOrder";
import { CANCELLED_STATUSES } from "@/lib/orderStatus";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

// Tells TypeScript exactly what the customer row contains, so it doesn't depend on Client.ts.
type ClientRow = {
  _id: unknown;
  name?: string;
  email?: string;
  phone?: string;
  createdAt?: Date;
};

/** GET /api/admin/customers/[id] (read-only): profile, order stats, last 10 orders. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requirePermission(req, "customers.view");
    if (admin instanceof NextResponse) return admin;
    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    await connectToDatabase();

    const client = await Client.findById(params.id)
      .select("name email phone createdAt")
      .lean<ClientRow | null>();
    if (!client) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    const paid = { clientId: client._id, "payment.status": "success" };
    const [recent, [agg]] = await Promise.all([
      HubOrder.find(paid)
        .sort({ createdAt: -1 })
        .limit(10)
        .select("orderNumber vendorName status totalKobo createdAt")
        .lean(),
      HubOrder.aggregate<{ orders: number; cancelled: number; spentKobo: number }>([
        { $match: paid },
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            cancelled: { $sum: { $cond: [{ $in: ["$status", CANCELLED_STATUSES] }, 1, 0] } },
            spentKobo: {
              $sum: { $cond: [{ $in: ["$status", CANCELLED_STATUSES] }, 0, { $ifNull: ["$totalKobo", 0] }] },
            },
          },
        },
      ]),
    ]);

    const stats: Record<string, number> = { orders: agg?.orders ?? 0, cancelled: agg?.cancelled ?? 0 };
    if (hasPermission(admin.role, "reports.view")) stats.spentKobo = agg?.spentKobo ?? 0;

    return NextResponse.json({
      customer: {
        _id: String(client._id),
        name: client.name ?? "",
        email: client.email ?? "",
        phone: client.phone ?? "",
        createdAt: client.createdAt,
      },
      stats,
      recent: recent.map((o) => ({
        _id: String(o._id),
        orderNumber: o.orderNumber,
        vendorName: o.vendorName,
        status: o.status,
        totalKobo: o.totalKobo,
        createdAt: o.createdAt,
      })),
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/customers/[id]");
  }
}