import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import PlatformSettings from "@/models/PlatformSettings";
import { DEFAULT_SETTINGS, validateSettings, type PlatformSettingsValues } from "@/lib/platformSettings";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

type SettingsRow = Partial<PlatformSettingsValues> & { updatedAt?: Date };

function merge(row: SettingsRow | null): PlatformSettingsValues {
  return {
    debtAlertKobo: row?.debtAlertKobo ?? DEFAULT_SETTINGS.debtAlertKobo,
    debtBlockKobo: row?.debtBlockKobo ?? DEFAULT_SETTINGS.debtBlockKobo,
    riderSharePercent: row?.riderSharePercent ?? DEFAULT_SETTINGS.riderSharePercent,
    commission: {
      basic: row?.commission?.basic ?? DEFAULT_SETTINGS.commission.basic,
      regular: row?.commission?.regular ?? DEFAULT_SETTINGS.commission.regular,
      premium: row?.commission?.premium ?? DEFAULT_SETTINGS.commission.premium,
    },
    withdrawalDays: row?.withdrawalDays?.length ? row.withdrawalDays : DEFAULT_SETTINGS.withdrawalDays,
  };
}

/** GET /api/admin/settings -> current platform settings (defaults if never saved) */
export async function GET(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "settings.manage");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const row = await PlatformSettings.findOne({ key: "platform" }).lean<SettingsRow | null>();
    return NextResponse.json({ settings: merge(row), updatedAt: row?.updatedAt ?? null });
  } catch (err) {
    return apiError(err, "GET /api/admin/settings");
  }
}

/** PUT /api/admin/settings -> save platform settings */
export async function PUT(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "settings.manage");
    if (admin instanceof NextResponse) return admin;

    const body = await req.json().catch(() => null);
    const checked = validateSettings(body);
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
    await connectToDatabase();

    const before = merge(await PlatformSettings.findOne({ key: "platform" }).lean<SettingsRow | null>());
    const v = checked.value;

    await PlatformSettings.findOneAndUpdate(
      { key: "platform" },
      { $set: { ...v, updatedBy: String((admin as any).email ?? (admin as any).uid ?? "") }, $setOnInsert: { key: "platform" } },
      { upsert: true, new: true }
    );

    const changes: string[] = [];
    if (before.debtAlertKobo !== v.debtAlertKobo) changes.push(`debt alert ${before.debtAlertKobo / 100} -> ${v.debtAlertKobo / 100}`);
    if (before.debtBlockKobo !== v.debtBlockKobo) changes.push(`debt block ${before.debtBlockKobo / 100} -> ${v.debtBlockKobo / 100}`);
    if (before.riderSharePercent !== v.riderSharePercent) changes.push(`rider share ${before.riderSharePercent}% -> ${v.riderSharePercent}%`);
    for (const t of ["basic", "regular", "premium"] as const) {
      if (before.commission[t] !== v.commission[t]) changes.push(`${t} commission ${before.commission[t]}% -> ${v.commission[t]}%`);
    }
    if (before.withdrawalDays.join() !== v.withdrawalDays.join()) {
      changes.push(`withdrawal days ${before.withdrawalDays.join(",")} -> ${v.withdrawalDays.join(",")}`);
    }

    await logAudit(admin, {
      action: "settings.update",
      targetType: "PlatformSettings",
      summary: changes.length ? `Changed ${changes.join("; ")}` : "Saved settings (no changes)",
    });

    return NextResponse.json({ ok: true, settings: v });
  } catch (err) {
    return apiError(err, "PUT /api/admin/settings");
  }
}