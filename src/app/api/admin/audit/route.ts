import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import AuditLog from "@/models/AuditLog";
import { requirePermission } from "@/middleware/adminAuth";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

// ?limit=50&before=<ISO date> for the next page.
export async function GET(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "audit.view");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 50, 1), 100);
    const beforeRaw = req.nextUrl.searchParams.get("before");
    const before = beforeRaw ? new Date(beforeRaw) : null;

    const filter = before && !Number.isNaN(before.getTime()) ? { createdAt: { $lt: before } } : {};
    const rows = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("actorEmail actorName actorRole action summary createdAt")
      .lean();

    return NextResponse.json({
      entries: rows.map((r) => ({
        _id: String(r._id),
        actorEmail: r.actorEmail,
        actorName: r.actorName ?? null,
        actorRole: r.actorRole,
        action: r.action,
        summary: r.summary,
        createdAt: r.createdAt,
      })),
      nextBefore: rows.length === limit ? rows[rows.length - 1].createdAt : null,
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/audit");
  }
}