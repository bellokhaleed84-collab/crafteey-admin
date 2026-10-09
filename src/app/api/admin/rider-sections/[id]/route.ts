import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import RiderSection from "@/models/RiderSection";
import { apiError } from "@/lib/apiError";
import { logAudit } from "@/lib/audit";
import { parseSectionBody, serializeSection } from "@/lib/riderContentValidation";

export const dynamic = "force-dynamic";

/** PATCH - switch on/off ({enabled}) or save the whole form. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requirePermission(req, "settings.manage");
    if (admin instanceof NextResponse) return admin;
    if (!mongoose.isValidObjectId(params.id)) return NextResponse.json({ error: "Section not found" }, { status: 404 });
    await connectToDatabase();

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });

    const section = await RiderSection.findById(params.id);
    if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });

    if (Object.keys(body).length === 1 && typeof body.enabled === "boolean") {
      section.enabled = body.enabled;
      await section.save();
      await logAudit(admin, {
        action: section.enabled ? "rider_section.enable" : "rider_section.disable",
        targetType: "RiderSection",
        targetId: String(section._id),
        summary: `${section.enabled ? "Switched on" : "Switched off"} rider Settings section "${section.title}"`,
      });
      return NextResponse.json({ section: serializeSection(section) });
    }

    const parsed = parseSectionBody(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    section.set(parsed.data); // the slug is never changed, so links keep working
    await section.save();
    await logAudit(admin, {
      action: "rider_section.update",
      targetType: "RiderSection",
      targetId: String(section._id),
      summary: `Edited rider Settings section "${section.title}"`,
    });
    return NextResponse.json({ section: serializeSection(section) });
  } catch (err) {
    return apiError(err, "PATCH /api/admin/rider-sections/[id]");
  }
}

/** DELETE */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requirePermission(req, "settings.manage");
    if (admin instanceof NextResponse) return admin;
    if (!mongoose.isValidObjectId(params.id)) return NextResponse.json({ error: "Section not found" }, { status: 404 });
    await connectToDatabase();

    const section = await RiderSection.findByIdAndDelete(params.id);
    if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });
    await logAudit(admin, {
      action: "rider_section.delete",
      targetType: "RiderSection",
      targetId: String(section._id),
      summary: `Deleted rider Settings section "${section.title}"`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, "DELETE /api/admin/rider-sections/[id]");
  }
}