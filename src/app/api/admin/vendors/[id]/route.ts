import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePermission } from "@/middleware/adminAuth";
import { hasPermission } from "@/lib/permissions";
import { connectToDatabase } from "@/lib/mongodb";
import Vendor from "@/models/Vendor";
import HubVendor from "@/models/HubVendor";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/apiError";
import { isHubCategory, isVendorTier } from "@/lib/hubCategories";

export const dynamic = "force-dynamic";

/** GET /api/admin/vendors/[id]. Bank details and documents only for vendors.review. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requirePermission(req, "vendors.view");
    if (admin instanceof NextResponse) return admin;
    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }
    await connectToDatabase();

    const vendor = await Vendor.findById(params.id).lean();
    if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

    const hubVendor = vendor.uid ? await HubVendor.findOne({ ownerUid: vendor.uid }).lean() : null;
    const canReview = hasPermission(admin.role, "vendors.review");

    const safe: Record<string, unknown> = { ...vendor };
    if (!canReview) {
      delete safe.bankDetails;
      delete safe.verificationDocUrl;
    }
    return NextResponse.json({ vendor: safe, hubVendor, canReview });
  } catch (err) {
    return apiError(err, "GET /api/admin/vendors/[id]");
  }
}

/**
 * PATCH /api/admin/vendors/[id]
 * body: { action: "approve" | "reject" | "suspend", categories?, lat?, lng? }
 * "approve" also works on an already approved vendor (re-syncs the HubVendor) and
 * is how a suspended or rejected vendor is reinstated.
 * status is the source of truth; isApproved always follows it.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requirePermission(req, "vendors.review");
    if (admin instanceof NextResponse) return admin;
    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    if (!["approve", "reject", "suspend"].includes(action)) {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    await connectToDatabase();

    const vendor = await Vendor.findById(params.id).lean();
    if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    if (!vendor.uid) {
      return NextResponse.json({ error: "This vendor has no uid, so it can't be linked to the Hub." }, { status: 409 });
    }

    const before = { status: vendor.status, isApproved: vendor.isApproved };

    if (action === "approve") {
      const categories = Array.from(
        new Set((Array.isArray(body.categories) ? body.categories : []).filter(isHubCategory))
      );
      if (categories.length === 0) {
        return NextResponse.json({ error: "Pick at least one Hub category." }, { status: 400 });
      }
      const lat = Number(body.lat);
      const lng = Number(body.lng);
      // Rough Nigeria bounds, to catch swapped or mistyped numbers.
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 4 || lat > 14 || lng < 2 || lng > 15) {
        return NextResponse.json(
          { error: "Enter valid coordinates inside Nigeria, e.g. 6.5244, 3.3792 (latitude first)." },
          { status: 400 }
        );
      }
      const tier = isVendorTier(vendor.tier) ? vendor.tier : "regular";

      await Vendor.updateOne({ _id: params.id }, { $set: { status: "approved", isApproved: true } });

      const onInsert: Record<string, unknown> = { isOpen: !!vendor.isOpen };
      if (vendor.logoUrl) onInsert.logoUrl = vendor.logoUrl;
      if (vendor.coverImageUrl) onInsert.bannerUrl = vendor.coverImageUrl;
      if (vendor.tagline) onInsert.tagline = vendor.tagline;
      if (vendor.description) onInsert.description = vendor.description;

      try {
        await HubVendor.findOneAndUpdate(
          { ownerUid: vendor.uid },
          {
            $set: {
              name: vendor.businessName,
              categories,
              address: vendor.address,
              lat,
              lng,
              tier,
              isActive: true,
            },
            $setOnInsert: onInsert,
          },
          { upsert: true, new: true }
        );
      } catch (hubErr) {
        // Don't leave the vendor "approved" with no store in the Hub.
        await Vendor.updateOne(
          { _id: params.id },
          { $set: { status: before.status || "pending", isApproved: !!before.isApproved } }
        );
        throw hubErr;
      }

      await logAudit(admin, {
        action: "vendor.approve",
        targetType: "Vendor",
        targetId: params.id,
        summary: `Approved vendor ${vendor.businessName} (${categories.join(", ")}, ${tier})`,
        before,
        after: { status: "approved", isApproved: true, categories, lat, lng, tier },
      });
      return NextResponse.json({ ok: true });
    }

    // reject or suspend
    const newStatus = action === "reject" ? "rejected" : "suspended";
    await Vendor.updateOne(
      { _id: params.id },
      { $set: { status: newStatus, isApproved: false, isOpen: false } }
    );
    await HubVendor.updateOne({ ownerUid: vendor.uid }, { $set: { isActive: false, isOpen: false } });

    await logAudit(admin, {
      action: action === "reject" ? "vendor.reject" : "vendor.suspend",
      targetType: "Vendor",
      targetId: params.id,
      summary: `${action === "reject" ? "Rejected" : "Suspended"} vendor ${vendor.businessName}`,
      before,
      after: { status: newStatus, isApproved: false },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, "PATCH /api/admin/vendors/[id]");
  }
}