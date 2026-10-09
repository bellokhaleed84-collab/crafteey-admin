import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import RiderHomeCard from "@/models/RiderHomeCard";
import { apiError } from "@/lib/apiError";
import { logAudit } from "@/lib/audit";
import { parseCardBody, serializeCard } from "@/lib/riderContentValidation";

export const dynamic = "force-dynamic";

/** GET - every card, in display order. */
export async function GET(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "settings.manage");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();
    const rows = await RiderHomeCard.find().sort({ order: 1, createdAt: 1 }).lean();
    return NextResponse.json({ cards: rows.map((r) => serializeCard(r)) });
  } catch (err) {
    return apiError(err, "GET /api/admin/rider-cards");
  }
}

/** POST - add a card at the end. */
export async function POST(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "settings.manage");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });
    const parsed = parseCardBody(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const last = await RiderHomeCard.findOne().sort({ order: -1 }).select("order").lean<{ order?: number } | null>();
    const doc = await RiderHomeCard.create({ ...parsed.data, order: (last?.order ?? -1) + 1 });

    await logAudit(admin, {
      action: "rider_card.create",
      targetType: "RiderHomeCard",
      targetId: String(doc._id),
      summary: `Created rider Home card "${doc.title}"`,
    });
    return NextResponse.json({ card: serializeCard(doc) });
  } catch (err) {
    return apiError(err, "POST /api/admin/rider-cards");
  }
}

/** PUT - save a new order. Body: { ids: [...] } */
export async function PUT(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "settings.manage");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const body = (await req.json().catch(() => null)) as { ids?: unknown } | null;
    const ids = Array.isArray(body?.ids) ? (body!.ids as unknown[]) : null;
    if (!ids || ids.length === 0 || !ids.every((i) => typeof i === "string" && mongoose.isValidObjectId(i))) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }
    await RiderHomeCard.bulkWrite(
      (ids as string[]).map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: i } } } }))
    );
    await logAudit(admin, {
      action: "rider_card.reorder",
      targetType: "RiderHomeCard",
      summary: "Changed the order of the rider Home cards",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, "PUT /api/admin/rider-cards");
  }
}