import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import HubOrder from "@/models/HubOrder";
import Payout from "@/models/Payout";
import Transaction from "@/models/Transaction";
import Courier from "@/models/Courier";
import { logAudit } from "@/lib/audit";
import { parseRange } from "@/lib/reportRange";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

const MAX_ROWS = 10000;
const TYPES = ["orders", "payouts", "transactions"] as const;
type ExportType = (typeof TYPES)[number];

// Tells TypeScript exactly what a payout row contains, so it doesn't depend on Payout.ts.
type PayoutRow = {
  createdAt?: Date;
  courierUid: string;
  amountKobo?: number;
  status?: string;
  paystackTransferRef?: string;
  failureReason?: string;
};

const lagosFmt = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Africa/Lagos",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
const when = (d?: Date | null) => (d ? lagosFmt.format(new Date(d)) : "");
const money = (kobo?: number | null) => (Number(kobo ?? 0) / 100).toFixed(2);

// Quotes values, and defuses spreadsheet formulas (text starting with = + - @).
function cell(v: unknown): string {
  if (typeof v === "number") return String(v);
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function toCsv(header: string[], rows: unknown[][]): string {
  return "\uFEFF" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

async function riderMap(uids: string[]) {
  const unique = [...new Set(uids)];
  const list = unique.length
    ? await Courier.find({ firebaseUid: { $in: unique } }).select("firebaseUid name phone").lean()
    : [];
  return new Map(list.map((c) => [c.firebaseUid, c]));
}

/** GET /api/admin/reports/export?type=orders|payouts|transactions&from=&to= -> CSV download */
export async function GET(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "reports.view");
    if (admin instanceof NextResponse) return admin;

    const sp = req.nextUrl.searchParams;
    const type = sp.get("type") as ExportType;
    if (!TYPES.includes(type)) return NextResponse.json({ error: "Unknown export type." }, { status: 400 });
    const range = parseRange(sp);
    if (!range.ok) return NextResponse.json({ error: range.error }, { status: 400 });
    await connectToDatabase();

    const inRange = { $gte: range.from, $lt: range.toExclusive };
    let csv = "";
    let count = 0;

    if (type === "orders") {
      const rows = await HubOrder.find({ "payment.status": "success", createdAt: inRange })
        .sort({ createdAt: 1 })
        .limit(MAX_ROWS)
        .lean();
      count = rows.length;
      csv = toCsv(
        [
          "Order number", "Created (Lagos)", "Vendor", "Tier", "Status", "Items subtotal", "Delivery fee", "Total",
          "Vendor payout", "Platform vendor revenue", "Rider earning", "Platform delivery commission",
          "Refund status", "Refund amount",
        ],
        rows.map((o) => [
          o.orderNumber, when(o.createdAt), o.vendorName, o.vendorTier, o.status, money(o.subtotalKobo),
          money(o.deliveryFeeKobo), money(o.totalKobo), money(o.vendorPayoutKobo), money(o.platformVendorRevenueKobo),
          money(o.riderEarningKobo), money(o.platformCommissionKobo), o.refund?.status ?? "",
          o.refund?.amountKobo != null ? money(o.refund.amountKobo) : "",
        ])
      );
    } else if (type === "payouts") {
      const rows = await Payout.find({ createdAt: inRange })
        .sort({ createdAt: 1 })
        .limit(MAX_ROWS)
        .lean<PayoutRow[]>();
      const riders = await riderMap(rows.map((r) => r.courierUid));
      count = rows.length;
      csv = toCsv(
        ["Requested (Lagos)", "Rider", "Phone", "Amount", "Status", "Transfer reference", "Failure reason"],
        rows.map((p) => {
          const r = riders.get(p.courierUid);
          return [
            when(p.createdAt), r?.name ?? "Unknown rider", r?.phone ?? "", money(p.amountKobo), p.status ?? "",
            p.paystackTransferRef ?? "", p.failureReason ?? "",
          ];
        })
      );
    } else {
      const rows = await Transaction.find({ createdAt: inRange }).sort({ createdAt: 1 }).limit(MAX_ROWS).lean();
      const riders = await riderMap(rows.map((r) => r.courierUid));
      count = rows.length;
      csv = toCsv(
        ["Date (Lagos)", "Rider", "Type", "Label", "Amount", "Wallet after", "Debt after", "Status"],
        rows.map((t) => [
          when(t.createdAt), riders.get(t.courierUid)?.name ?? "Unknown rider", t.type, t.label, money(t.amountKobo),
          money(t.walletBalanceAfterKobo), money(t.debtAfterKobo), t.status,
        ])
      );
    }

    await logAudit(admin, {
      action: "report.export",
      targetType: "Report",
      summary: `Exported ${type} ${range.fromStr} to ${range.toStr} (${count} rows)`,
    });

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="crafteey-${type}-${range.fromStr}-to-${range.toStr}.csv"`,
        "Cache-Control": "no-store",
        "X-Row-Count": String(count),
        "X-Truncated": count >= MAX_ROWS ? "1" : "0",
      },
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/reports/export");
  }
}