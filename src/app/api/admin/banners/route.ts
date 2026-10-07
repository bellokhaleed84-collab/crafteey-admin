import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import Banner from "@/models/Banner";
import { apiError } from "@/lib/apiError";
import { logAudit } from "@/lib/audit";
import { parseBannerBody, serializeBanner } from "@/lib/bannerValidation";

export const dynamic = "force-dynamic";

/** GET /api/admin/banners - every banner, in display order. */
export async function GET(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "banners.manage");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const rows = await Banner.find().sort({ order: 1, createdAt: 1 }).lean();
    return NextResponse.json({ banners: rows.map((r) => serializeBanner(r)) });
  } catch (err) {
    return apiError(err, "GET /api/admin/banners");
  }
}

/** POST /api/admin/banners - create a banner at the end of the list. */
export async function POST(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "banners.manage");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });

    const parsed = parseBannerBody(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const last = await Banner.findOne().sort({ order: -1 }).select("order").lean<{ order?: number } | null>();
    const order = (last?.order ?? -1) + 1;

    const doc = await Banner.create({ ...parsed.data, order });

    await logAudit(admin, {
      action: "banner.create",
      targetType: "banner",
      targetId: String(doc._id),
      summary: `Created banner "${doc.title}"`,
    });

    return NextResponse.json({ banner: serializeBanner(doc) });
  } catch (err) {
    return apiError(err, "POST /api/admin/banners");
  }
}