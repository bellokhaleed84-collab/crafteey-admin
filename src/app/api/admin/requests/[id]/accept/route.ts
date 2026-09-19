import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import Job from "@/models/Job";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/requests/[id]/accept
 * Marks a client request as reviewed by an admin. Does NOT change
 * `status` — a job only becomes DISPATCHED once a technician is actually
 * assigned, which is a separate step. This just means "seen, not
 * ignored" so it's safe to leave sitting in the New tab.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await verifyAdminToken(req);
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const job = await Job.findByIdAndUpdate(
      params.id,
      { $set: { reviewedByAdmin: true, reviewedAt: new Date() } },
      { new: true }
    ).lean();

    if (!job) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    return NextResponse.json({ request: job });
  } catch (err) {
    return apiError(err, "PATCH /api/admin/requests/[id]/accept");
  }
}