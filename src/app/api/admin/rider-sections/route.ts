import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import RiderSection from "@/models/RiderSection";
import { apiError } from "@/lib/apiError";
import { logAudit } from "@/lib/audit";
import { BUILTIN_SLUGS, makeSlug, parseSectionBody, serializeSection } from "@/lib/riderContentValidation";

export const dynamic = "force-dynamic";

/** GET - every extra section, in display order. */
export async function GET(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "settings.manage");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();
    const rows = await RiderSection.find().sort({ order: 1, createdAt: 1 }).lean();
    return NextResponse.json({ sections: rows.map((r) => serializeSection(r)) });
  } catch (err) {
    return apiError(err, "GET /api/admin/rider-sections");
  }
}

/** POST - add a section at the end. The link name (slug) is made from the title and never changes. */
export async function POST(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "settings.manage");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });
    const parsed = parseSectionBody(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const base = makeSlug(parsed.data.title);
    let slug = base;
    let n = 2;
    while (BUILTIN_SLUGS.includes(slug) || (await RiderSection.exists({ slug }))) {
      slug = `${base}-${n++}`;
    }

    const last = await RiderSection.findOne().sort({ order: -1 }).select("order").lean<{ order?: number } | null>();
    const doc = await RiderSection.create({ ...parsed.data, slug, order: (last?.order ?? -1) + 1 });

    await logAudit(admin, {
      action: "rider_section.create",
      targetType: "RiderSection",
      targetId: String(doc._id),
      summary: `Created rider Settings section "${doc.title}"`,
    });
    return NextResponse.json({ section: serializeSection(doc) });
  } catch (err) {
    return apiError(err, "POST /api/admin/rider-sections");
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
    await RiderSection.bulkWrite(
      (ids as string[]).map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: i } } } }))
    );
    await logAudit(admin, {
      action: "rider_section.reorder",
      targetType: "RiderSection",
      summary: "Changed the order of the rider Settings sections",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, "PUT /api/admin/rider-sections");
  }
}