import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import AdminUser from "@/models/AdminUser";
import { requirePermission, isProtectedEmail } from "@/middleware/adminAuth";
import { isAdminRole } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "staff.manage");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const rows = await AdminUser.find().sort({ createdAt: 1 }).lean();
    return NextResponse.json({
      staff: rows.map((u) => ({
        _id: String(u._id),
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        lastLoginAt: u.lastLoginAt ?? null,
        createdAt: u.createdAt,
        isYou: u.firebaseUid === admin.uid,
        isProtected: isProtectedEmail(u.email),
      })),
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/staff");
  }
}

// Add a staff member. They then create their own account at /staff-signup with
// this exact email and verify it; the invite activates automatically.
export async function POST(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "staff.manage");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const body = await req.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = body?.role;

    if (name.length < 2 || name.length > 80) {
      return NextResponse.json({ error: "Enter the person's name." }, { status: 400 });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (!isAdminRole(role)) {
      return NextResponse.json({ error: "Choose a role." }, { status: 400 });
    }

    const exists = await AdminUser.exists({ email });
    if (exists) {
      return NextResponse.json({ error: "That email is already on the staff list." }, { status: 409 });
    }

    const created = await AdminUser.create({ email, name, role, status: "invited", invitedBy: admin.email });

    await logAudit(admin, {
      action: "staff.invite",
      targetType: "AdminUser",
      targetId: String(created._id),
      summary: `Invited ${email} as ${role}`,
      after: { email, name, role },
    });

    return NextResponse.json({ ok: true, id: String(created._id) }, { status: 201 });
  } catch (err) {
    if ((err as { code?: number } | null)?.code === 11000) {
      return NextResponse.json({ error: "That email is already on the staff list." }, { status: 409 });
    }
    return apiError(err, "POST /api/admin/staff");
  }
}