import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import Vendor from "@/models/Vendor";
import HubVendor from "@/models/HubVendor";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/apiError";
import { isVendorTier } from "@/lib/hubCategories";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/vendors/[id]/tier
 * body: { decision: "approve" | "reject" }
 * Only works on a pending tier request. Approving copies the tier to the HubVendor.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requirePermission(req, "vendors.review");
    if (admin instanceof NextResponse) return admin;
    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }
    const body = await req.json().catch(() => ({}));
    const decision = body?.decision;
    if (decision !== "approve" && decision !== "reject") {
      return NextResponse.json({ error: "Unknown decision" }, { status: 400 });
    }
    await connectToDatabase();

    const vendor = await Vendor.findById(params.id).lean();
    if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

    const requested = vendor.tierRequest?.requestedTier;
    if (vendor.tierRequest?.status !== "pending" || !isVendorTier(requested)) {
      return NextResponse.json({ error: "There is no pending tier request for this vendor." }, { status: 409 });
    }

    const update =
      decision === "approve"
        ? { $set: { tier: requested, "tierRequest.status": "approved" } }
        : { $set: { "tierRequest.status": "rejected" } };

    // Conditional on still pending, so a double click can't apply it twice.
    const result = await Vendor.updateOne({ _id: params.id, "tierRequest.status": "pending" }, update);
    if (result.modifiedCount === 0) {
      return NextResponse.json({ error: "This request was already handled." }, { status: 409 });
    }

    if (decision === "approve" && vendor.uid) {
      await HubVendor.updateOne({ ownerUid: vendor.uid }, { $set: { tier: requested } });
    }

    await logAudit(admin, {
      action: decision === "approve" ? "vendor.tier_approve" : "vendor.tier_reject",
      targetType: "Vendor",
      targetId: params.id,
      summary: `${decision === "approve" ? "Approved" : "Rejected"} tier change for ${vendor.businessName}: ${vendor.tier || "none"} to ${requested}`,
      before: { tier: vendor.tier, tierRequestStatus: "pending" },
      after: { tier: decision === "approve" ? requested : vendor.tier, tierRequestStatus: decision === "approve" ? "approved" : "rejected" },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, "PATCH /api/admin/vendors/[id]/tier");
  }
}