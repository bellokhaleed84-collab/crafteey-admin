import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken } from "@/middleware/auth";
import { connectToDatabase } from "@/lib/mongodb";
import Courier from "@/models/Courier";
import { COURIER_STATUS } from "@/lib/constants";
import { apiError } from "@/lib/apiError";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await verifyAdminToken(req);
    await connectToDatabase();

    const body = await req.json();
    const { status } = body as { status?: string };

    const validStatuses = Object.values(COURIER_STATUS) as string[];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ error: "A valid status is required" }, { status: 400 });
    }

    // params.id is the courier's firebaseUid, same convention as the
    // technicians route (PATCH /api/admin/technicians/${uid}).
    const courier = await Courier.findOneAndUpdate(
      { firebaseUid: params.id },
      { $set: { status } },
      { new: true }
    );

    if (!courier) {
      return NextResponse.json({ error: "Courier not found" }, { status: 404 });
    }

    return NextResponse.json({ courier });
  } catch (err) {
    return apiError(err, "PATCH /api/admin/couriers/[id]");
  }
}
