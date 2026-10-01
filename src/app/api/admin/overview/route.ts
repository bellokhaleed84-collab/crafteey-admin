import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Technician } from "@/models/Technician";
import Courier from "@/models/Courier";
import Job from "@/models/Job";
import HubOrder from "@/models/HubOrder";
import Vendor from "@/models/Vendor";
import Payout from "@/models/Payout";
import Client from "@/models/Client";
import { requirePermission } from "@/middleware/adminAuth";
import { hasPermission } from "@/lib/permissions";
import { JOB_STATUS } from "@/lib/constants";
import { CANCELLED_STATUSES, DELIVERED_STATUSES, TERMINAL_STATUSES } from "@/lib/orderStatus";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

const RIDER_DEBT_ALERT_KOBO = 500_000; // ₦5,000, the level where debt alerts start

// Same rule as the Vendors page "Pending" tab: anything not approved, rejected or suspended.
const VENDOR_KNOWN_STATUSES = ["approved", "rejected", "suspended"];

// Midnight today in Lagos (UTC+1, no daylight saving), as a UTC Date.
function startOfLagosDay(): Date {
  const HOUR = 60 * 60 * 1000;
  const lagos = new Date(Date.now() + HOUR);
  return new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate()) - HOUR);
}

// Each block is included only if the role may see it.
export async function GET(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "dashboard.view");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const can = (p: Parameters<typeof hasPermission>[1]) => hasPermission(admin.role, p);
    const out: Record<string, unknown> = {};
    const todayStart = startOfLagosDay();

    if (can("technicians.view")) {
      const [pending, approved] = await Promise.all([
        Technician.countDocuments({ status: "pending" }),
        Technician.countDocuments({ status: "approved" }),
      ]);
      out.technicians = { pending, approved };
    }

    if (can("requests.view")) {
      const base = { clientUid: { $type: "string" }, status: JOB_STATUS.PENDING };
      const [waiting, unreviewed] = await Promise.all([
        Job.countDocuments(base),
        Job.countDocuments({ ...base, reviewedByAdmin: { $ne: true } }),
      ]);
      out.requests = { waiting, unreviewed };
    }

    const seesRiderMoney = can("riders.manage") || can("payouts.view");
    if (can("riders.view") || seesRiderMoney) {
      const debt = { $ifNull: ["$debtKobo", 0] };
      const [r] = await Courier.aggregate([
        {
          $group: {
            _id: null,
            pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
            approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
            suspended: { $sum: { $cond: [{ $eq: ["$status", "suspended"] }, 1, 0] } },
            online: {
              $sum: {
                $cond: [{ $and: [{ $eq: ["$status", "approved"] }, { $eq: ["$isOnline", true] }] }, 1, 0],
              },
            },
            debtKobo: { $sum: debt },
            walletKobo: { $sum: { $ifNull: ["$walletBalanceKobo", 0] } },
            overAlert: { $sum: { $cond: [{ $gte: [debt, RIDER_DEBT_ALERT_KOBO] }, 1, 0] } },
            debtSuspended: { $sum: { $cond: [{ $eq: ["$accountSuspended", true] }, 1, 0] } },
          },
        },
      ]);
      const x = r ?? {};
      if (can("riders.view")) {
        out.riders = {
          pending: x.pending ?? 0,
          approved: x.approved ?? 0,
          online: x.online ?? 0,
          suspended: x.suspended ?? 0,
        };
      }
      if (seesRiderMoney) {
        out.riderMoney = {
          debtKobo: x.debtKobo ?? 0,
          walletKobo: x.walletKobo ?? 0,
          overAlert: x.overAlert ?? 0,
          debtSuspended: x.debtSuspended ?? 0,
        };
      }
    }

    if (can("vendors.view")) {
      const [pending, approved, tierRequests] = await Promise.all([
        Vendor.countDocuments({ status: { $nin: VENDOR_KNOWN_STATUSES } }),
        Vendor.countDocuments({ status: "approved" }),
        Vendor.countDocuments({ "tierRequest.status": "pending" }),
      ]);
      out.vendors = { pending, approved, tierRequests };
    }

    if (can("orders.view")) {
      const paid = { "payment.status": "success" };
      const [live, today, deliveredToday, cancelledToday, recent] = await Promise.all([
        HubOrder.countDocuments({ ...paid, status: { $nin: TERMINAL_STATUSES } }),
        HubOrder.countDocuments({ ...paid, createdAt: { $gte: todayStart } }),
        HubOrder.countDocuments({ status: { $in: DELIVERED_STATUSES }, updatedAt: { $gte: todayStart } }),
        HubOrder.countDocuments({ status: { $in: CANCELLED_STATUSES }, updatedAt: { $gte: todayStart } }),
        HubOrder.find(paid)
          .sort({ createdAt: -1 })
          .limit(6)
          .select("orderNumber vendorName status totalKobo createdAt")
          .lean(),
      ]);

      const orders: Record<string, unknown> = {
        live,
        today,
        deliveredToday,
        cancelledToday,
        recent: recent.map((o) => ({
          _id: String(o._id),
          orderNumber: o.orderNumber,
          vendorName: o.vendorName,
          status: o.status,
          totalKobo: o.totalKobo,
          createdAt: o.createdAt,
        })),
      };

      // Order value is a money figure, so only roles that see reports get it.
      if (can("reports.view")) {
        const [v] = await HubOrder.aggregate<{ total: number }>([
          { $match: { ...paid, createdAt: { $gte: todayStart }, status: { $nin: CANCELLED_STATUSES } } },
          { $group: { _id: null, total: { $sum: "$totalKobo" } } },
        ]);
        orders.revenueTodayKobo = v?.total ?? 0;
      }
      out.orders = orders;
    }

    if (can("payouts.view")) {
      const grouped = await Payout.aggregate<{ _id: string; n: number; kobo: number }>([
        { $group: { _id: "$status", n: { $sum: 1 }, kobo: { $sum: "$amountKobo" } } },
      ]);
      const by = (s: string) => grouped.find((g) => g._id === s);
      out.payouts = {
        pending: by("pending")?.n ?? 0,
        processing: by("processing")?.n ?? 0,
        failed: by("failed")?.n ?? 0,
        pendingKobo: (by("pending")?.kobo ?? 0) + (by("processing")?.kobo ?? 0),
      };
    }

    if (can("customers.view")) {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [total, newThisWeek] = await Promise.all([
        Client.countDocuments(),
        Client.countDocuments({ createdAt: { $gte: weekAgo } }),
      ]);
      out.customers = { total, newThisWeek };
    }

    return NextResponse.json(out);
  } catch (err) {
    return apiError(err, "GET /api/admin/overview");
  }
}