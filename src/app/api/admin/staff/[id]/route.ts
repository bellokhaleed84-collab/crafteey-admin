import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import AdminUser from "@/models/AdminUser";
import { requirePermission, isProtectedEmail } from "@/middleware/adminAuth";
import { isAdminRole } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/apiError";

type Ctx = { params: { id: string } };

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

// Body: { role?: AdminRole, status?: "active" | "deactivated" }
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const admin = await requirePermission(req, "staff.manage");
    if (admin instanceof NextResponse) return admin;
    if (!mongoose.isValidObjectId(params.id)) return bad("Staff member not found", 404);
    await connectToDatabase();

    const target = await AdminUser.findById(params.id);
    if (!target) return bad("Staff member not found", 404);

    if (target.firebaseUid === admin.uid) return bad("You can't change your own access.");
    if (isProtectedEmail(target.email)) {
      return bad("This account is set as a Super Admin in the server settings and can't be changed here.");
    }

    const body = await req.json().catch(() => null);
    let nextRole = target.role;
    let nextStatus = target.status;

    if (body && "role" in body) {
      if (!isAdminRole(body.role)) return bad("Choose a valid role.");
      nextRole = body.role;
    }
    if (body && "status" in body) {
      if (body.status === "deactivated") nextStatus = "deactivated";
      else if (body.status === "active") nextStatus = target.firebaseUid ? "active" : "invited";
      else return bad("Invalid status.");
    }

    if (nextRole === target.role && nextStatus === target.status) return bad("Nothing to change.");

    // Never leave the system without an active Super Admin.
    const losingSuper =
      target.role === "super_admin" &&
      target.status === "active" &&
      (nextRole !== "super_admin" || nextStatus !== "active");
    if (losingSuper) {
      const others = await AdminUser.countDocuments({
        role: "super_admin",
        status: "active",
        _id: { $ne: target._id },
      });
      if (others === 0) return bad("There must be at least one active Super Admin.");
    }

    const before = { role: target.role, status: target.status };
    target.role = nextRole;
    target.status = nextStatus;
    await target.save();

    await logAudit(admin, {
      action: nextStatus !== before.status ? `staff.${nextStatus}` : "staff.role_change",
      targetType: "AdminUser",
      targetId: String(target._id),
      summary: `${target.email}: ${before.role}/${before.status} → ${nextRole}/${nextStatus}`,
      before,
      after: { role: nextRole, status: nextStatus },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, "PATCH /api/admin/staff/[id]");
  }
}

// Cancel an invite that hasn't been used yet. Accounts that have already joined
// are deactivated instead, so their history stays.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const admin = await requirePermission(req, "staff.manage");
    if (admin instanceof NextResponse) return admin;
    if (!mongoose.isValidObjectId(params.id)) return bad("Staff member not found", 404);
    await connectToDatabase();

    const target = await AdminUser.findById(params.id);
    if (!target) return bad("Staff member not found", 404);
    if (isProtectedEmail(target.email)) return bad("This account can't be removed.");
    if (target.status !== "invited" || target.firebaseUid) {
      return bad("Only invites that haven't been used yet can be removed. Deactivate the account instead.");
    }

    await AdminUser.deleteOne({ _id: target._id });

    await logAudit(admin, {
      action: "staff.invite_removed",
      targetType: "AdminUser",
      targetId: String(target._id),
      summary: `Removed the invite for ${target.email}`,
      before: { email: target.email, role: target.role },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, "DELETE /api/admin/staff/[id]");
  }
}