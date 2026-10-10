import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import DeliveryReport, { REPORT_KINDS } from "@/models/DeliveryReport";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type Row = {
  _id: unknown;
  kind: string;
  requestId: string;
  courierName?: string;
  courierPhone?: string;
  clientName?: string;
  pickup?: string;
  dropoff?: string;
  source?: string;
  orderNumber?: string | null;
  reason?: string;
  note?: string;
  location?: { lat: number; lng: number } | null;
  status?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
};

/** GET /api/admin/safety-alerts?status=open|resolved|all&kind=emergency|gave_up|problem&page=1 */
export async function GET(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "riders.view");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") || "open";
    const kind = sp.get("kind") || "";
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);

    const filter: Record<string, unknown> = {};
    if (status === "open" || status === "resolved") filter.status = status;
    if ((REPORT_KINDS as readonly string[]).includes(kind)) filter.kind = kind;

    const [rows, total, grouped, openSos] = await Promise.all([
      DeliveryReport.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean<Row[]>(),
      DeliveryReport.countDocuments(filter),
      DeliveryReport.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      DeliveryReport.countDocuments({ kind: "emergency", status: "open" }),
    ]);

    const counts: Record<string, number> = { open: 0, resolved: 0, all: 0 };
    for (const g of grouped) {
      counts[g._id] = g.n;
      counts.all += g.n;
    }

    return NextResponse.json({
      reports: rows.map((r) => ({
        _id: String(r._id),
        kind: r.kind,
        requestId: r.requestId,
        courierName: r.courierName || "Unknown rider",
        courierPhone: r.courierPhone || "",
        clientName: r.clientName || "",
        pickup: r.pickup || "",
        dropoff: r.dropoff || "",
        source: r.source || "direct",
        orderNumber: r.orderNumber ?? null,
        reason: r.reason || "",
        note: r.note || "",
        location: r.location ?? null,
        status: r.status ?? "open",
        resolvedBy: r.resolvedBy ?? null,
        resolvedAt: r.resolvedAt ?? null,
        createdAt: r.createdAt,
      })),
      counts,
      openSos,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      total,
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/safety-alerts");
  }
}