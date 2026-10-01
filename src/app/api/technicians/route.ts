import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Technician } from "@/models/Technician";
import { requirePermission } from "@/middleware/adminAuth";
import { TECHNICIAN_STATUS } from "@/lib/constants";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "technicians.view");
    if (admin instanceof NextResponse) return admin;

    await connectToDatabase();

    const status = req.nextUrl.searchParams.get("status");
    const valid = !!status && (Object.values(TECHNICIAN_STATUS) as string[]).includes(status);
    const filter = valid ? { status } : {};

    const technicians = await Technician.find(filter).sort({ createdAt: -1 }).limit(200);
    return NextResponse.json(technicians);
  } catch (err) {
    return apiError(err, "GET /api/technicians");
  }
}