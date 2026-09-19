import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Technician } from "@/models/Technician";
import { verifyAdminToken } from "@/middleware/adminAuth";

export async function GET(req: NextRequest) {
  const authResult = await verifyAdminToken(req);
  if (authResult instanceof NextResponse) return authResult;

  await connectToDatabase();

  const status = req.nextUrl.searchParams.get("status");
  const filter = status ? { status } : {};

  const technicians = await Technician.find(filter).sort({ createdAt: -1 });
  return NextResponse.json(technicians);
}
