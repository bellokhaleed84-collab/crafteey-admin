import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import Banner from "@/models/Banner";
import { apiError } from "@/lib/apiError";
import { logAudit } from "@/lib/audit";
import { parseBannerBody, serializeBanner } from "@/lib/bannerValidation";

export const dynamic = "force-dynamic";

/** PATCH /api/admin/banners/:id - switch on/off ({enabled}) or save the full edit form. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requirePermission(req, "banners.manage");
    if (admin instanceof NextResponse) return admin;

    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Banner not found" }, { status: 404 });
    }
    await connectToDatabase();

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });

    const banner = await Banner.findById(params.id);
    if (!banner) return NextResponse.json({ error: "Banner not found" }, { status: 404 });

    if (Object.keys(body).length === 1 && typeof body.enabled === "boolean") {
      banner.enabled = body.enabled;
      await banner.save();
      await logAudit(admin, {
        action: banner.enabled ? "banner.enable" : "banner.disable",
        targetType: "banner",
        targetId: String(banner._id),
        summary: `${banner.enabled ? "Switched on" : "Switched off"} banner "${banner.title}"`,
      });
      return NextResponse.json({ banner: serializeBanner(banner) });
    }

    const parsed = parseBannerBody(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    banner.set(parsed.data);
    await banner.save();

    await logAudit(admin, {
      action: "banner.update",
      targetType: "banner",
      targetId: String(banner._id),
      summary: `Edited banner "${banner.title}"`,
    });

    return NextResponse.json({ banner: serializeBanner(banner) });
  } catch (err) {
    return apiError(err, "PATCH /api/admin/banners/[id]");
  }
}

/** DELETE /api/admin/banners/:id */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requirePermission(req, "banners.manage");
    if (admin instanceof NextResponse) return admin;

    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Banner not found" }, { status: 404 });
    }
    await connectToDatabase();

    const banner = await Banner.findByIdAndDelete(params.id);
    if (!banner) return NextResponse.json({ error: "Banner not found" }, { status: 404 });

    await logAudit(admin, {
      action: "banner.delete",
      targetType: "banner",
      targetId: String(banner._id),
      summary: `Deleted banner "${banner.title}"`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, "DELETE /api/admin/banners/[id]");
  }
}