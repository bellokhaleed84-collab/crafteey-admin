import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import DeliveryReport from "@/models/DeliveryReport";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

/** PATCH /api/admin/safety-alerts/[id]  body: { status: "resolved" | "open" } */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requirePermission(req, "riders.manage");
    if (admin instanceof NextResponse) return admin;
    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const status = body?.status;
    if (status !== "resolved" && status !== "open") {
      return NextResponse.json({ error: "Status must be resolved or open." }, { status: 400 });
    }

    await connectToDatabase();
    const report = await DeliveryReport.findById(params.id).select("kind courierName status").lean<{
      kind?: string;
      courierName?: string;
      status?: string;
    } | null>();
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    const update =
      status === "resolved"
        ? { $set: { status: "resolved", resolvedBy: admin.email, resolvedAt: new Date() } }
        : { $set: { status: "open" }, $unset: { resolvedBy: "", resolvedAt: "" } };

    await DeliveryReport.updateOne({ _id: params.id }, update);

    await logAudit(admin, {
      action: status === "resolved" ? "safety_alert.resolve" : "safety_alert.reopen",
      targetType: "DeliveryReport",
      targetId: params.id,
      summary: `${status === "resolved" ? "Marked fixed" : "Reopened"}: ${report.kind} report for ${report.courierName || "rider"}`,
      before: { status: report.status },
      after: { status },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, "PATCH /api/admin/safety-alerts/[id]");
  }
}