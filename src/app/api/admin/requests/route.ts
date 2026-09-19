import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import Job from "@/models/Job";
import { JOB_STATUS, type JobStatusValue } from "@/lib/constants";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

type Tab = "new" | "active" | "done" | "cancelled";

const TAB_STATUSES: Record<Tab, JobStatusValue[]> = {
  new: [JOB_STATUS.PENDING],
  active: [JOB_STATUS.DISPATCHED, JOB_STATUS.ON_THE_WAY, JOB_STATUS.ARRIVED, JOB_STATUS.IN_PROGRESS],
  done: [JOB_STATUS.COMPLETED],
  cancelled: [JOB_STATUS.CANCELLED],
};

/**
 * GET /api/admin/requests?tab=new|active|done|cancelled
 * "Client requests" are jobs that were posted from crafteey-client, meaning they carry a clientUid.
 * Jobs the admin posts by hand have no clientUid and stay on the Technician jobs page.
 * Returns { requests: [...], counts: { new, active, done, cancelled } }
 */
export async function GET(req: NextRequest) {
  try {
    // verifyAdminToken does not throw. On failure it RETURNS a 401/403 response,
    // so that response must be returned here or the route would run for anyone.
    const admin = await verifyAdminToken(req);
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const tabParam = req.nextUrl.searchParams.get("tab") || "new";
    const tab: Tab = tabParam in TAB_STATUSES ? (tabParam as Tab) : "new";

    // Oldest waiting request first on the "new" tab, newest first everywhere else.
    const sortOrder = tab === "new" ? 1 : -1;

    const requests = await Job.find({
      clientUid: { $type: "string" },
      status: { $in: TAB_STATUSES[tab] },
    })
      .sort({ createdAt: sortOrder })
      .limit(200)
      .lean();

    const grouped = await Job.aggregate<{ _id: string; n: number }>([
      { $match: { clientUid: { $type: "string" } } },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]);

    const counts: Record<Tab, number> = { new: 0, active: 0, done: 0, cancelled: 0 };
    for (const g of grouped) {
      for (const t of Object.keys(TAB_STATUSES) as Tab[]) {
        if ((TAB_STATUSES[t] as string[]).includes(g._id)) counts[t] += g.n;
      }
    }

    return NextResponse.json({ requests, counts });
  } catch (err) {
    return apiError(err, "GET /api/admin/requests");
  }
}