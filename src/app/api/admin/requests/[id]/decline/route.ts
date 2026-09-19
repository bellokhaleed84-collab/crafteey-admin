import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import Job from "@/models/Job";
import { JOB_STATUS } from "@/lib/constants";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/requests/[id]/decline
 * Moves a client request straight to CANCELLED. Also stamps it as
 * reviewed, since declining is itself a review decision.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await verifyAdminToken(req);
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const job = await Job.findByIdAndUpdate(
      params.id,
      {
        $set: {
          status: JOB_STATUS.CANCELLED,
          reviewedByAdmin: true,
          reviewedAt: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!job) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    return NextResponse.json({ request: job });
  } catch (err) {
    return apiError(err, "PATCH /api/admin/requests/[id]/decline");
  }
}