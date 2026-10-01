import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import Payout from "@/models/Payout";
import Courier from "@/models/Courier";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const STATUSES = ["pending", "processing", "paid", "failed"];

// Tells TypeScript exactly what a payout row contains, so it doesn't depend on Payout.ts.
type PayoutRow = {
  _id: unknown;
  courierUid: string;
  amountKobo?: number;
  status?: string;
  failureReason?: string | null;
  paystackTransferRef?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** GET /api/admin/payouts?status=all|pending|processing|paid|failed&q=&page=1 (read-only) */
export async function GET(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "payouts.view");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") || "all";
    const q = (sp.get("q") || "").trim().slice(0, 80);
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);

    const filter: Record<string, unknown> = {};
    if (STATUSES.includes(status)) filter.status = status;
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      const riders = await Courier.find({ $or: [{ name: rx }, { phone: rx }] })
        .select("firebaseUid")
        .limit(200)
        .lean();
      filter.$or = [{ courierUid: { $in: riders.map((r) => r.firebaseUid) } }, { paystackTransferRef: rx }];
    }

    const [rows, total, grouped] = await Promise.all([
      Payout.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean<PayoutRow[]>(),
      Payout.countDocuments(filter),
      Payout.aggregate<{ _id: string; n: number; kobo: number }>([
        { $group: { _id: "$status", n: { $sum: 1 }, kobo: { $sum: { $ifNull: ["$amountKobo", 0] } } } },
      ]),
    ]);

    const couriers = rows.length
      ? await Courier.find({ firebaseUid: { $in: [...new Set(rows.map((r) => r.courierUid))] } })
          .select("firebaseUid name phone")
          .lean()
      : [];
    const byUid = new Map(couriers.map((c) => [c.firebaseUid, c]));

    const bucket = (s: string) => {
      const g = grouped.find((x) => x._id === s);
      return { n: g?.n ?? 0, kobo: g?.kobo ?? 0 };
    };

    return NextResponse.json({
      payouts: rows.map((p) => {
        const c = byUid.get(p.courierUid);
        return {
          _id: String(p._id),
          courierUid: p.courierUid,
          riderName: c?.name || "Unknown rider",
          riderPhone: c?.phone || "",
          amountKobo: p.amountKobo ?? 0,
          status: p.status ?? "",
          failureReason: p.failureReason ?? null,
          paystackTransferRef: p.paystackTransferRef ?? null,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        };
      }),
      summary: {
        pending: bucket("pending"),
        processing: bucket("processing"),
        paid: bucket("paid"),
        failed: bucket("failed"),
      },
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      total,
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/payouts");
  }
}