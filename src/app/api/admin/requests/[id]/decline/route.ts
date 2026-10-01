import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import Job from "@/models/Job";
import { JOB_STATUS } from "@/lib/constants";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/requests/[id]/decline
 * Cancels a client request that is still waiting (pending). Requests that were
 * already dispatched or are under way can't be declined from here.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requirePermission(req, "requests.manage");
    if (admin instanceof NextResponse) return admin;

    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    await connectToDatabase();

    const job = await Job.findOneAndUpdate(
      { _id: params.id, status: JOB_STATUS.PENDING },
      { $set: { status: JOB_STATUS.CANCELLED, reviewedByAdmin: true, reviewedAt: new Date() } },
      { new: true }
    ).lean();

    if (!job) {
      const exists = await Job.exists({ _id: params.id });
      return exists
        ? NextResponse.json({ error: "This request is no longer waiting, so it can't be declined." }, { status: 409 })
        : NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    await logAudit(admin, {
      action: "request.decline",
      targetType: "Job",
      targetId: params.id,
      summary: `Declined client request${job.category ? ` (${job.category})` : ""}`,
      before: { status: JOB_STATUS.PENDING },
      after: { status: JOB_STATUS.CANCELLED },
    });

    return NextResponse.json({ request: job });
  } catch (err) {
    return apiError(err, "PATCH /api/admin/requests/[id]/decline");
  }
}