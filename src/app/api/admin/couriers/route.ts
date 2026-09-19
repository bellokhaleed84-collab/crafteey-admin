import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/middleware/adminAuth";
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
    await verifyAdminToken(req);
    await connectToDatabase();

    const status = req.nextUrl.searchParams.get("status");
    const validStatuses = Object.values(COURIER_STATUS) as string[];
    const isValid = !!status && validStatuses.includes(status);

    const query = isValid
      ? Courier.find({ status: status as CourierStatus })
      : Courier.find();

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
