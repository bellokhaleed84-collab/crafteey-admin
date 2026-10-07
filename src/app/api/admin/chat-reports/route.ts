import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import ChatReport, { REPORT_STATUSES } from "@/models/ChatReport";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type ReportRow = {
  _id: unknown;
  companyName?: string;
  clientName?: string;
  reporterRole?: string;
  reason?: string;
  details?: string;
  status?: string;
  createdAt?: Date;
};

/** GET /api/admin/chat-reports?status=open|reviewed|action_taken|dismissed|all&page=1 */
export async function GET(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "chat.moderate");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") || "open";
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);

    const filter: Record<string, unknown> = {};
    if ((REPORT_STATUSES as readonly string[]).includes(status)) filter.status = status;

    const [rows, total, grouped] = await Promise.all([
      ChatReport.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean<ReportRow[]>(),
      ChatReport.countDocuments(filter),
      ChatReport.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    ]);

    const counts: Record<string, number> = { open: 0, reviewed: 0, action_taken: 0, dismissed: 0 };
    for (const g of grouped) counts[g._id] = g.n;

    return NextResponse.json({
      reports: rows.map((r) => ({
        _id: String(r._id),
        companyName: r.companyName || "Unknown company",
        clientName: r.clientName || "Unknown customer",
        reporterRole: r.reporterRole ?? "",
        reason: r.reason ?? "",
        details: (r.details ?? "").slice(0, 140),
        status: r.status ?? "open",
        createdAt: r.createdAt,
      })),
      counts,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      total,
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/chat-reports");
  }
}