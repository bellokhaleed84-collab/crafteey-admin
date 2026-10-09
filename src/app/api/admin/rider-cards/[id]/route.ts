import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import RiderHomeCard from "@/models/RiderHomeCard";
import { apiError } from "@/lib/apiError";
import { logAudit } from "@/lib/audit";
import { parseCardBody, serializeCard } from "@/lib/riderContentValidation";

export const dynamic = "force-dynamic";

/** PATCH - switch on/off ({enabled}) or save the whole form. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requirePermission(req, "settings.manage");
    if (admin instanceof NextResponse) return admin;
    if (!mongoose.isValidObjectId(params.id)) return NextResponse.json({ error: "Card not found" }, { status: 404 });
    await connectToDatabase();

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });

    const card = await RiderHomeCard.findById(params.id);
    if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

    if (Object.keys(body).length === 1 && typeof body.enabled === "boolean") {
      card.enabled = body.enabled;
      await card.save();
      await logAudit(admin, {
        action: card.enabled ? "rider_card.enable" : "rider_card.disable",
        targetType: "RiderHomeCard",
        targetId: String(card._id),
        summary: `${card.enabled ? "Switched on" : "Switched off"} rider Home card "${card.title}"`,
      });
      return NextResponse.json({ card: serializeCard(card) });
    }

    const parsed = parseCardBody(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    card.set(parsed.data);
    await card.save();
    await logAudit(admin, {
      action: "rider_card.update",
      targetType: "RiderHomeCard",
      targetId: String(card._id),
      summary: `Edited rider Home card "${card.title}"`,
    });
    return NextResponse.json({ card: serializeCard(card) });
  } catch (err) {
    return apiError(err, "PATCH /api/admin/rider-cards/[id]");
  }
}

/** DELETE */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requirePermission(req, "settings.manage");
    if (admin instanceof NextResponse) return admin;
    if (!mongoose.isValidObjectId(params.id)) return NextResponse.json({ error: "Card not found" }, { status: 404 });
    await connectToDatabase();

    const card = await RiderHomeCard.findByIdAndDelete(params.id);
    if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });
    await logAudit(admin, {
      action: "rider_card.delete",
      targetType: "RiderHomeCard",
      targetId: String(card._id),
      summary: `Deleted rider Home card "${card.title}"`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, "DELETE /api/admin/rider-cards/[id]");
  }
}