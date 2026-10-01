import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Technician } from "@/models/Technician";
import { requirePermission } from "@/middleware/adminAuth";
import { TECHNICIAN_STATUS } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/apiError";

export async function PATCH(req: NextRequest, { params }: { params: { uid: string } }) {
  try {
    const admin = await requirePermission(req, "technicians.review");
    if (admin instanceof NextResponse) return admin;

    const body = await req.json().catch(() => null);
    const status = body?.status;
    const rejectionReason =
      typeof body?.rejectionReason === "string" ? body.rejectionReason.trim().slice(0, 500) : "";

    if (!(Object.values(TECHNICIAN_STATUS) as string[]).includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    await connectToDatabase();

    // new: false returns the document as it was, so the log can show the old status.
    const before = await Technician.findOneAndUpdate(
      { firebaseUid: params.uid },
      { status, ...(rejectionReason ? { rejectionReason } : {}) },
      { new: false }
    );

    if (!before) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await logAudit(admin, {
      action: `technician.${status}`,
      targetType: "Technician",
      targetId: params.uid,
      summary: `${before.name}: ${before.status} → ${status}`,
      before: { status: before.status },
      after: { status, ...(rejectionReason ? { rejectionReason } : {}) },
    });

    return NextResponse.json({ ...before.toObject(), status });
  } catch (err) {
    return apiError(err, "PATCH /api/technicians/[uid]");
  }
}