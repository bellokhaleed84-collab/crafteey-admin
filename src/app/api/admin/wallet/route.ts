import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/middleware/adminAuth";
import { hasPermission } from "@/lib/permissions";
import { connectToDatabase } from "@/lib/mongodb";
import Courier from "@/models/Courier";
import Transaction from "@/models/Transaction";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const TYPES = ["hub_earning", "direct_ride_debt", "withdrawal", "debt_payment"];
const SORTS: Record<string, string> = { debt: "debtKobo", wallet: "walletBalanceKobo", lifetime: "lifetimeEarningsKobo" };

// Same levels as the rider app's rules: alert at ₦5,000, blocked from going online above ₦8,000.
const DEBT_ALERT_KOBO = 500_000;
const DEBT_BLOCK_KOBO = 800_000;

type RiderBalance = {
  _id: unknown;
  name?: string;
  phone?: string;
  status?: string;
  debtKobo?: number;
  walletBalanceKobo?: number;
  lifetimeEarningsKobo?: number;
  accountSuspended?: boolean;
};

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * GET /api/admin/wallet?view=ledger&type=&q=&page=1   (rider transaction ledger)
 * GET /api/admin/wallet?view=balances&sort=debt|wallet|lifetime&q=&page=1   (rider balances)
 * Read-only. Rider money is only for roles that already see it on the dashboard.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "wallet.view");
    if (admin instanceof NextResponse) return admin;
    if (!hasPermission(admin.role, "payouts.view") && !hasPermission(admin.role, "riders.manage")) {
      return NextResponse.json({ error: "Rider money isn't available for your role." }, { status: 403 });
    }
    await connectToDatabase();

    const sp = req.nextUrl.searchParams;
    const view = sp.get("view") === "balances" ? "balances" : "ledger";
    const q = (sp.get("q") || "").trim().slice(0, 80);
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const rx = q ? new RegExp(escapeRegex(q), "i") : null;

    if (view === "ledger") {
      const filter: Record<string, unknown> = {};
      const type = sp.get("type") || "";
      if (TYPES.includes(type)) filter.type = type;
      if (rx) {
        const riders = await Courier.find({ $or: [{ name: rx }, { phone: rx }] })
          .select("firebaseUid")
          .limit(200)
          .lean();
        filter.$or = [{ courierUid: { $in: riders.map((r) => r.firebaseUid) } }, { label: rx }];
      }

      const [rows, total] = await Promise.all([
        Transaction.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * PAGE_SIZE)
          .limit(PAGE_SIZE)
          .lean(),
        Transaction.countDocuments(filter),
      ]);
      const couriers = rows.length
        ? await Courier.find({ firebaseUid: { $in: [...new Set(rows.map((r) => r.courierUid))] } })
            .select("firebaseUid name")
            .lean()
        : [];
      const nameByUid = new Map(couriers.map((c) => [c.firebaseUid, c.name]));

      return NextResponse.json({
        view,
        transactions: rows.map((t) => ({
          _id: String(t._id),
          courierUid: t.courierUid,
          riderName: nameByUid.get(t.courierUid) || "Unknown rider",
          type: t.type,
          amountKobo: t.amountKobo ?? 0,
          walletBalanceAfterKobo: t.walletBalanceAfterKobo ?? 0,
          debtAfterKobo: t.debtAfterKobo ?? 0,
          label: t.label,
          status: t.status,
          createdAt: t.createdAt,
        })),
        page,
        pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
        total,
      });
    }

    // balances
    const sortField = SORTS[sp.get("sort") || "debt"] || "debtKobo";
    const hasMoney = {
      $or: [{ debtKobo: { $gt: 0 } }, { walletBalanceKobo: { $gt: 0 } }, { lifetimeEarningsKobo: { $gt: 0 } }],
    };
    const filter = rx ? { $and: [hasMoney, { $or: [{ name: rx }, { phone: rx }] }] } : hasMoney;

    const debt = { $ifNull: ["$debtKobo", 0] };
    const [riders, total, [t]] = await Promise.all([
      Courier.find(filter)
        .select("name phone status debtKobo walletBalanceKobo lifetimeEarningsKobo accountSuspended")
        .sort({ [sortField]: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean<RiderBalance[]>(),
      Courier.countDocuments(filter),
      Courier.aggregate<{ debtKobo: number; walletKobo: number; overAlert: number; debtSuspended: number }>([
        {
          $group: {
            _id: null,
            debtKobo: { $sum: debt },
            walletKobo: { $sum: { $ifNull: ["$walletBalanceKobo", 0] } },
            overAlert: { $sum: { $cond: [{ $gte: [debt, DEBT_ALERT_KOBO] }, 1, 0] } },
            debtSuspended: { $sum: { $cond: [{ $eq: ["$accountSuspended", true] }, 1, 0] } },
          },
        },
      ]),
    ]);

    return NextResponse.json({
      view,
      riders: riders.map((r) => ({
        _id: String(r._id),
        name: r.name ?? "",
        phone: r.phone ?? "",
        status: r.status ?? "",
        debtKobo: r.debtKobo ?? 0,
        walletBalanceKobo: r.walletBalanceKobo ?? 0,
        lifetimeEarningsKobo: r.lifetimeEarningsKobo ?? 0,
        accountSuspended: r.accountSuspended === true,
      })),
      totals: {
        debtKobo: t?.debtKobo ?? 0,
        walletKobo: t?.walletKobo ?? 0,
        overAlert: t?.overAlert ?? 0,
        debtSuspended: t?.debtSuspended ?? 0,
      },
      thresholds: { alertKobo: DEBT_ALERT_KOBO, blockKobo: DEBT_BLOCK_KOBO },
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      total,
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/wallet");
  }
}