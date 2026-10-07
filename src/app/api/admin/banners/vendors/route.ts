import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import Vendor from "@/models/Vendor";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

/** GET /api/admin/banners/vendors - approved shops, for the "Promote a shop" picker. */
export async function GET(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "banners.manage");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const rows = await Vendor.find({ status: "approved" })
      .select("businessName category")
      .sort({ businessName: 1 })
      .limit(500)
      .lean();

    return NextResponse.json({
      vendors: rows.map((v) => ({
        _id: String(v._id),
        businessName: v.businessName || "Unnamed shop",
        category: v.category || "",
      })),
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/banners/vendors");
  }
}