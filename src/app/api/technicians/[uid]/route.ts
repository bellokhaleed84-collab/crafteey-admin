import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Technician } from "@/models/Technician";
import { verifyAdminToken } from "@/middleware/adminAuth";
import { TECHNICIAN_STATUS } from "@/lib/constants";

export async function PATCH(req: NextRequest, { params }: { params: { uid: string } }) {
  const authResult = await verifyAdminToken(req);
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json();
  const { status, rejectionReason } = body;

  if (!Object.values(TECHNICIAN_STATUS).includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  await connectToDatabase();

  const technician = await Technician.findOneAndUpdate(
    { firebaseUid: params.uid },
    { status, ...(rejectionReason ? { rejectionReason } : {}) },
    { new: true }
  );

  if (!technician) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(technician);
}
