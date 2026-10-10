import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/middleware/adminAuth";
import { hasPermission } from "@/lib/permissions";
import { connectToDatabase } from "@/lib/mongodb";
import Courier from "@/models/Courier";
import { COURIER_STATUS } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/apiError";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin(req);
    if (admin instanceof NextResponse) return admin;

    const body = await req.json().catch(() => null);
    const status = typeof body?.status === "string" ? body.status : "";
    const rejectionReasonInput =
      typeof body?.rejectionReason === "string" ? body.rejectionReason.trim().slice(0, 300) : "";

    const validStatuses = Object.values(COURIER_STATUS) as string[];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "A valid status is required" }, { status: 400 });
    }

    // A rejection must tell the rider why, so they can fix it.
    if (status === COURIER_STATUS.REJECTED && rejectionReasonInput.length < 5) {
      return NextResponse.json(
        { error: "Write a reason for the rider (at least 5 characters)." },
        { status: 400 }
      );
    }

    const needed =
      status === COURIER_STATUS.SUSPENDED || status === COURIER_STATUS.BLACKLISTED
        ? "riders.manage"
        : "riders.review";
    if (!hasPermission(admin.role, needed)) {
      return NextResponse.json({ error: "You don't have permission to do that." }, { status: 403 });
    }

    await connectToDatabase();

    // params.id is the courier's firebaseUid, same convention as the technicians route.
    const courier = await Courier.findOne({ firebaseUid: params.id });
    if (!courier) {
      return NextResponse.json({ error: "Courier not found" }, { status: 404 });
    }

    const before = courier.status;
    if (before === status) {
      return NextResponse.json({ courier });
    }

    // Rejecting saves the reason and clears the "sent a new document" mark.
    // Any other status clears the old reason.
    const rejecting = status === COURIER_STATUS.REJECTED;
    const set: Record<string, unknown> = {
      status,
      rejectionReason: rejecting ? rejectionReasonInput : "",
    };
    if (rejecting) set.resubmittedAt = null;

    await Courier.updateOne({ _id: courier._id }, { $set: set });

    await logAudit(admin, {
      action: `rider.${status}`,
      targetType: "Courier",
      targetId: params.id,
      summary: `${courier.name}: ${before} \u2192 ${status}${rejecting ? " (" + rejectionReasonInput + ")" : ""}`,
      before: { status: before },
      after: { status, ...(rejecting ? { rejectionReason: rejectionReasonInput } : {}) },
    });

    return NextResponse.json({ courier: { ...courier.toObject(), ...set } });
  } catch (err) {
    return apiError(err, "PATCH /api/admin/couriers/[id]");
  }
}