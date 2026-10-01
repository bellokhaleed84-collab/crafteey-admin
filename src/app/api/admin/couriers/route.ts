import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/middleware/adminAuth";
import { hasPermission } from "@/lib/permissions";
import { connectToDatabase } from "@/lib/mongodb";
import Courier from "@/models/Courier";
import { COURIER_STATUS, type CourierStatus } from "@/lib/constants";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/couriers?status=pending
 * Returns { couriers: [...], counts: { pending: n, approved: n, ... } }
 * Leave out ?status to get every rider.
 */
export async function GET(req: NextRequest) {
  try {
    // Returns an error response (401/403) when the caller isn't allowed.
    const admin = await requirePermission(req, "riders.view");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const status = req.nextUrl.searchParams.get("status");
    const validStatuses = Object.values(COURIER_STATUS) as string[];
    const isValid = !!status && validStatuses.includes(status);

    const query = isValid
      ? Courier.find({ status: status as CourierStatus })
      : Courier.find();

    // ID details are for the people who approve riders, not everyone who can look.
    if (!hasPermission(admin.role, "riders.review")) {
      query.select("-idNumber -idPhotoUrl");
    }

    const couriers = await query.sort({ createdAt: -1 }).limit(200).lean();

    const grouped = await Courier.aggregate<{ _id: string; n: number }>([
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]);
    const counts: Record<string, number> = {};
    for (const s of validStatuses) counts[s] = 0;
    for (const g of grouped) counts[g._id] = g.n;

    return NextResponse.json({ couriers, counts });
  } catch (err) {
    return apiError(err, "GET /api/admin/couriers");
  }
}