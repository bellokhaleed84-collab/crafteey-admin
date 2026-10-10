import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import DeliveryReport from "@/models/DeliveryReport";
import CourierRequest from "@/models/CourierRequest";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

/** POST /api/admin/safety-alerts/[id]/unlock - gives the rider fresh tries and marks the alert fixed. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requirePermission(req, "riders.manage");
    if (admin instanceof NextResponse) return admin;
    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    await connectToDatabase();
    const report = await DeliveryReport.findById(params.id)
      .select("kind requestId courierName status")
      .lean<{ kind?: string; requestId?: string; courierName?: string; status?: string } | null>();
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    if (report.kind !== "locked") {
      return NextResponse.json({ error: "Only locked deliveries can be unlocked." }, { status: 400 });
    }
    if (!report.requestId || !mongoose.isValidObjectId(report.requestId)) {
      return NextResponse.json({ error: "This report has no delivery attached." }, { status: 400 });
    }

    const res = await CourierRequest.updateOne({ _id: report.requestId }, { $set: { deliveryCodeAttempts: 0 } });
    if (res.matchedCount === 0) {
      return NextResponse.json({ error: "The delivery could not be found." }, { status: 404 });
    }

    await DeliveryReport.updateOne(
      { _id: params.id },
      { $set: { status: "resolved", resolvedBy: admin.email, resolvedAt: new Date() } }
    );

    await logAudit(admin, {
      action: "safety_alert.unlock",
      targetType: "DeliveryReport",
      targetId: params.id,
      summary: `Unlocked delivery code for ${report.courierName || "rider"} (delivery ${report.requestId})`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, "POST /api/admin/safety-alerts/[id]/unlock");
  }
}