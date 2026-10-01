import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import HubOrder from "@/models/HubOrder";
import { requirePermission } from "@/middleware/adminAuth";
import { CANCELLED_STATUSES, DELIVERED_STATUSES, TERMINAL_STATUSES } from "@/lib/orderStatus";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

type Tab = "live" | "delivered" | "cancelled" | "all";

/* eslint-disable @typescript-eslint/no-explicit-any */
const TAB_FILTERS: Record<Tab, Record<string, any>> = {
  live: { "payment.status": "success", status: { $nin: TERMINAL_STATUSES } },
  delivered: { status: { $in: DELIVERED_STATUSES } },
  cancelled: { status: { $in: CANCELLED_STATUSES } },
  all: {},
};

const PAGE_SIZE = 25;

/**
 * GET /api/admin/orders?tab=live|delivered|cancelled|all&q=text&page=1
 * Returns { orders, counts, page, pageSize, total }
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "orders.view");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const sp = req.nextUrl.searchParams;
    const tabParam = sp.get("tab") || "live";
    const tab: Tab = tabParam in TAB_FILTERS ? (tabParam as Tab) : "live";
    const page = Math.max(parseInt(sp.get("page") || "1", 10) || 1, 1);

    const q = (sp.get("q") || "").trim().slice(0, 40);
    const parts: Record<string, any>[] = [];
    if (Object.keys(TAB_FILTERS[tab]).length) parts.push(TAB_FILTERS[tab]);
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      parts.push({ $or: [{ orderNumber: rx }, { vendorName: rx }] });
    }
    const filter: Record<string, any> = parts.length ? { $and: parts } : {};

    const [rows, total, live, delivered, cancelled, all] = await Promise.all([
      HubOrder.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .select("orderNumber vendorName status totalKobo vehicleType payment.status delivery.address createdAt")
        .lean(),
      HubOrder.countDocuments(filter),
      HubOrder.countDocuments(TAB_FILTERS.live),
      HubOrder.countDocuments(TAB_FILTERS.delivered),
      HubOrder.countDocuments(TAB_FILTERS.cancelled),
      HubOrder.countDocuments({}),
    ]);

    return NextResponse.json({
      orders: rows.map((o) => ({
        _id: String(o._id),
        orderNumber: o.orderNumber,
        vendorName: o.vendorName,
        status: o.status,
        totalKobo: o.totalKobo,
        vehicleType: o.vehicleType,
        paymentStatus: o.payment?.status ?? "",
        address: o.delivery?.address ?? "",
        createdAt: o.createdAt,
      })),
      counts: { live, delivered, cancelled, all },
      page,
      pageSize: PAGE_SIZE,
      total,
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/orders");
  }
}