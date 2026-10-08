import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import LegalDocument from "@/models/LegalDocument";
import { DEFAULT_TERMS } from "@/lib/legalDefaults";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

type Doc = { body: string; version: number; updatedBy?: string; updatedAt?: Date };

const MIN_LEN = 50;
const MAX_LEN = 60000;

/** GET /api/admin/legal/terms -> the saved terms, or the starter text if nothing is saved yet. */
export async function GET(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "settings.manage");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const doc = await LegalDocument.findOne({ slug: "terms" }).lean<Doc | null>();
    return NextResponse.json({
      body: doc?.body ?? DEFAULT_TERMS,
      defaultBody: DEFAULT_TERMS,
      version: doc?.version ?? 0,
      isDefault: !doc,
      updatedBy: doc?.updatedBy ?? null,
      updatedAt: doc?.updatedAt ?? null,
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/legal/terms");
  }
}

/** PUT /api/admin/legal/terms  body: { body, expectedVersion }. Replaces the terms. */
export async function PUT(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "settings.manage");
    if (admin instanceof NextResponse) return admin;

    const payload = await req.json().catch(() => null);
    const body = String(payload?.body ?? "").replace(/\r\n/g, "\n").trim();
    const expectedVersion = Number(payload?.expectedVersion);

    if (body.length < MIN_LEN) return NextResponse.json({ error: "The terms are too short." }, { status: 400 });
    if (body.length > MAX_LEN) return NextResponse.json({ error: "The terms are too long." }, { status: 400 });
    if (!Number.isInteger(expectedVersion)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    await connectToDatabase();

    const conflict = NextResponse.json(
      { error: "Someone else saved a newer version. Reload the page to see it before you save." },
      { status: 409 }
    );

    const current = await LegalDocument.findOne({ slug: "terms" }).select("version").lean<{ version: number } | null>();
    const currentVersion = current?.version ?? 0;
    if (expectedVersion !== currentVersion) return conflict;

    let newVersion = 1;
    if (!current) {
      try {
        await LegalDocument.create({ slug: "terms", body, version: 1, updatedBy: admin.email });
      } catch (e) {
        if ((e as { code?: number } | null)?.code === 11000) return conflict;
        throw e;
      }
    } else {
      const res = await LegalDocument.updateOne(
        { slug: "terms", version: currentVersion },
        { $set: { body, updatedBy: admin.email }, $inc: { version: 1 } }
      );
      if (res.matchedCount === 0) return conflict;
      newVersion = currentVersion + 1;
    }

    await logAudit(admin, {
      action: "legal_terms.update",
      targetType: "LegalDocument",
      targetId: "terms",
      summary: `Updated the Terms & Conditions (version ${newVersion})`,
    });

    return NextResponse.json({ ok: true, version: newVersion });
  } catch (err) {
    return apiError(err, "PUT /api/admin/legal/terms");
  }
}