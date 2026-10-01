import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import HubOrder from "@/models/HubOrder";
import Payout from "@/models/Payout";
import Transaction from "@/models/Transaction";
import { CANCELLED_STATUSES } from "@/lib/orderStatus";
import { parseRange } from "@/lib/reportRange";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

const sum = (field: string) => ({ $sum: { $ifNull: [`$${field}`, 0] } });

/** GET /api/admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD (read-only summary) */
export async function GET(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "reports.view");
    if (admin instanceof NextResponse) return admin;

    const range = parseRange(req.nextUrl.searchParams);
    if (!range.ok) return NextResponse.json({ error: range.error }, { status: 400 });
    await connectToDatabase();

    const inRange = { $gte: range.from, $lt: range.toExclusive };
    const notCancelled = { status: { $nin: CANCELLED_STATUSES } };

    const [orderFacets, payoutGroups, txGroups] = await Promise.all([
      HubOrder.aggregate([
        { $match: { "payment.status": "success", createdAt: inRange } },
        {
          $facet: {
            totals: [
              { $match: notCancelled },
              {
                $group: {
                  _id: null,
                  orders: { $sum: 1 },
                  totalKobo: sum("totalKobo"),
                  subtotalKobo: sum("subtotalKobo"),
                  deliveryFeeKobo: sum("deliveryFeeKobo"),
                  vendorPayoutKobo: sum("vendorPayoutKobo"),
                  platformVendorRevenueKobo: sum("platformVendorRevenueKobo"),
                  riderEarningKobo: sum("riderEarningKobo"),
                  platformCommissionKobo: sum("platformCommissionKobo"),
                },
              },
            ],
            cancelled: [
              { $match: { status: { $in: CANCELLED_STATUSES } } },
              {
                $group: {
                  _id: null,
                  orders: { $sum: 1 },
                  totalKobo: sum("totalKobo"),
                  refundedKobo: sum("refund.amountKobo"),
                },
              },
            ],
            byTier: [
              { $match: notCancelled },
              {
                $group: {
                  _id: { $ifNull: ["$vendorTier", "unknown"] },
                  orders: { $sum: 1 },
                  subtotalKobo: sum("subtotalKobo"),
                  platformVendorRevenueKobo: sum("platformVendorRevenueKobo"),
                },
              },
              { $sort: { platformVendorRevenueKobo: -1 } },
            ],
            byDay: [
              { $match: notCancelled },
              {
                $group: {
                  _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Africa/Lagos" } },
                  orders: { $sum: 1 },
                  totalKobo: sum("totalKobo"),
                },
              },
              { $sort: { _id: 1 } },
            ],
            topVendors: [
              { $match: notCancelled },
              {
                $group: {
                  _id: "$vendorId",
                  name: { $first: "$vendorName" },
                  orders: { $sum: 1 },
                  subtotalKobo: sum("subtotalKobo"),
                  platformVendorRevenueKobo: sum("platformVendorRevenueKobo"),
                },
              },
              { $sort: { subtotalKobo: -1 } },
              { $limit: 10 },
            ],
          },
        },
      ]),
      Payout.aggregate<{ _id: string; n: number; kobo: number }>([
        { $match: { createdAt: inRange } },
        { $group: { _id: "$status", n: { $sum: 1 }, kobo: sum("amountKobo") } },
      ]),
      Transaction.aggregate<{ _id: string; n: number; kobo: number }>([
        { $match: { createdAt: inRange } },
        { $group: { _id: "$type", n: { $sum: 1 }, kobo: sum("amountKobo") } },
      ]),
    ]);

    const f = orderFacets[0] ?? {};
    const t = f.totals?.[0] ?? {};
    const c = f.cancelled?.[0] ?? {};

    const totals = {
      orders: t.orders ?? 0,
      totalKobo: t.totalKobo ?? 0,
      subtotalKobo: t.subtotalKobo ?? 0,
      deliveryFeeKobo: t.deliveryFeeKobo ?? 0,
      vendorPayoutKobo: t.vendorPayoutKobo ?? 0,
      platformVendorRevenueKobo: t.platformVendorRevenueKobo ?? 0,
      riderEarningKobo: t.riderEarningKobo ?? 0,
      platformCommissionKobo: t.platformCommissionKobo ?? 0,
      platformRevenueKobo: (t.platformVendorRevenueKobo ?? 0) + (t.platformCommissionKobo ?? 0),
    };

    return NextResponse.json({
      range: { from: range.fromStr, to: range.toStr },
      totals,
      cancelled: { orders: c.orders ?? 0, totalKobo: c.totalKobo ?? 0, refundedKobo: c.refundedKobo ?? 0 },
      byTier: (f.byTier ?? []).map((x: any) => ({
        tier: x._id,
        orders: x.orders,
        subtotalKobo: x.subtotalKobo,
        platformVendorRevenueKobo: x.platformVendorRevenueKobo,
      })),
      byDay: (f.byDay ?? []).map((x: any) => ({ day: x._id, orders: x.orders, totalKobo: x.totalKobo })),
      topVendors: (f.topVendors ?? []).map((x: any) => ({
        vendorId: String(x._id),
        name: x.name || "Unknown vendor",
        orders: x.orders,
        subtotalKobo: x.subtotalKobo,
        platformVendorRevenueKobo: x.platformVendorRevenueKobo,
      })),
      payouts: payoutGroups.map((g) => ({ status: g._id, n: g.n, kobo: g.kobo })),
      riderLedger: txGroups.map((g) => ({ type: g._id, n: g.n, kobo: g.kobo })),
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/reports");
  }
}