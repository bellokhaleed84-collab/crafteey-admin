import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Technician } from "@/models/Technician";
import Courier from "@/models/Courier";
import { requirePermission } from "@/middleware/adminAuth";
import { hasPermission } from "@/lib/permissions";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

// Counts for the dashboard home. Each block is included only if the role may see it.
export async function GET(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "dashboard.view");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const out: {
      technicians?: { pending: number; approved: number };
      riders?: { pending: number; approved: number; online: number };
    } = {};

    if (hasPermission(admin.role, "technicians.view")) {
      const [pending, approved] = await Promise.all([
        Technician.countDocuments({ status: "pending" }),
        Technician.countDocuments({ status: "approved" }),
      ]);
      out.technicians = { pending, approved };
    }

    if (hasPermission(admin.role, "riders.view")) {
      const [pending, approved, online] = await Promise.all([
        Courier.countDocuments({ status: "pending" }),
        Courier.countDocuments({ status: "approved" }),
        Courier.countDocuments({ status: "approved", isOnline: true }),
      ]);
      out.riders = { pending, approved, online };
    }

    return NextResponse.json(out);
  } catch (err) {
    return apiError(err, "GET /api/admin/overview");
  }
}