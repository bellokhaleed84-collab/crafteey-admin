import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import Job from "@/models/Job";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/requests/[id]/accept
 * Marks a client request as reviewed. Does NOT change `status`.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requirePermission(req, "requests.manage");
    if (admin instanceof NextResponse) return admin;

    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    await connectToDatabase();

    const job = await Job.findByIdAndUpdate(
      params.id,
      { $set: { reviewedByAdmin: true, reviewedAt: new Date() } },
      { new: true }
    ).lean();

    if (!job) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    await logAudit(admin, {
      action: "request.accept",
      targetType: "Job",
      targetId: params.id,
      summary: `Reviewed client request${job.category ? ` (${job.category})` : ""}`,
    });

    return NextResponse.json({ request: job });
  } catch (err) {
    return apiError(err, "PATCH /api/admin/requests/[id]/accept");
  }
}