import { NextRequest, NextResponse } from "next/server";
import type { HydratedDocument } from "mongoose";
import { adminAuth } from "@/lib/firebase/adminApp";
import { connectToDatabase } from "@/lib/mongodb";
import AdminUser, { type IAdminUser } from "@/models/AdminUser";
import { hasPermission, isAdminRole, type AdminRole, type Permission } from "@/lib/permissions";

function parseEmails(...values: (string | undefined)[]): string[] {
  return values
    .flatMap((v) => (v ?? "").split(","))
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

// Emails listed here are always active Super Admins. They can't be demoted or
// deactivated from the Staff screen. SUPER_ADMIN_EMAILS wins if set; ADMIN_EMAILS
// is still read so the existing setting keeps working.
const SUPER_ADMIN_EMAILS = new Set(parseEmails(process.env.SUPER_ADMIN_EMAILS, process.env.ADMIN_EMAILS));

export function isProtectedEmail(email: string): boolean {
  return SUPER_ADMIN_EMAILS.has(email.trim().toLowerCase());
}

export interface AdminContext {
  uid: string;
  email: string;
  name: string;
  role: AdminRole;
  adminUserId: string;
}

export type AdminResolution =
  | { ok: true; admin: AdminContext }
  | { ok: false; status: number; error: string; needsEmailVerification?: boolean };

const LAST_LOGIN_REFRESH_MS = 60 * 60 * 1000;

async function claimAccount(
  email: string,
  uid: string,
  displayName: string | undefined,
  protectedEmail: boolean
): Promise<HydratedDocument<IAdminUser> | null> {
  try {
    if (protectedEmail) {
      return await AdminUser.findOneAndUpdate(
        { email },
        {
          $set: { firebaseUid: uid, role: "super_admin", status: "active" },
          $setOnInsert: { name: displayName?.trim() || email.split("@")[0], joinedAt: new Date() },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    }
    // Everyone else must have been invited by a Super Admin.
    return await AdminUser.findOneAndUpdate(
      { email, status: "invited" },
      { $set: { firebaseUid: uid, status: "active", joinedAt: new Date() } },
      { new: true }
    );
  } catch (e) {
    // This login is already linked to another admin record.
    if ((e as { code?: number } | null)?.code === 11000) return null;
    throw e;
  }
}

/**
 * Works out who is calling and whether they are an active admin. The database is
 * checked on every request, so removing someone takes effect immediately.
 */
export async function resolveAdmin(req: NextRequest): Promise<AdminResolution> {
  const idToken = req.headers.get("authorization")?.split("Bearer ")[1];
  if (!idToken) return { ok: false, status: 401, error: "Unauthorized" };

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch (error) {
    console.error("Error verifying admin token:", error);
    return { ok: false, status: 401, error: "Invalid token" };
  }

  const email = decoded.email?.trim().toLowerCase();
  if (!email) return { ok: false, status: 403, error: "Not an admin account" };

  await connectToDatabase();

  const protectedEmail = SUPER_ADMIN_EMAILS.has(email);
  const verified = decoded.email_verified === true;

  let record = await AdminUser.findOne({ firebaseUid: decoded.uid });

  if (!record) {
    if (!verified) {
      const invited = protectedEmail || (await AdminUser.exists({ email, status: "invited" }));
      if (invited) {
        return { ok: false, status: 403, error: "Verify your email to continue", needsEmailVerification: true };
      }
      return { ok: false, status: 403, error: "Not an admin account" };
    }
    record = await claimAccount(email, decoded.uid, decoded.name as string | undefined, protectedEmail);
    if (!record) return { ok: false, status: 403, error: "Not an admin account" };
  }

  // Server-listed Super Admins can never be locked out by a Staff screen change.
  if (protectedEmail && (record.role !== "super_admin" || record.status !== "active")) {
    record.role = "super_admin";
    record.status = "active";
    await record.save();
  }

  if (record.status === "deactivated") {
    return { ok: false, status: 403, error: "Your admin access has been removed." };
  }
  if (record.status !== "active" || !isAdminRole(record.role)) {
    return { ok: false, status: 403, error: "Not an admin account" };
  }

  const last = record.lastLoginAt?.getTime() ?? 0;
  if (Date.now() - last > LAST_LOGIN_REFRESH_MS) {
    await AdminUser.updateOne({ _id: record._id }, { $set: { lastLoginAt: new Date() } });
  }

  return {
    ok: true,
    admin: {
      uid: decoded.uid,
      email,
      name: record.name,
      role: record.role,
      adminUserId: String(record._id),
    },
  };
}

/** Any active admin. Returns the admin, or a ready-made error response to return. */
export async function requireAdmin(req: NextRequest): Promise<AdminContext | NextResponse> {
  const result = await resolveAdmin(req);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.needsEmailVerification ? { needsEmailVerification: true } : {}) },
      { status: result.status }
    );
  }
  return result.admin;
}

/** An active admin whose role includes this permission. */
export async function requirePermission(
  req: NextRequest,
  permission: Permission
): Promise<AdminContext | NextResponse> {
  const result = await requireAdmin(req);
  if (result instanceof NextResponse) return result;
  if (!hasPermission(result.role, permission)) {
    return NextResponse.json({ error: "You don't have permission to do that." }, { status: 403 });
  }
  return result;
}

/**
 * Older routes still call this. Until each one is moved to requirePermission it
 * stays Super Admin only, so no other role can reach an unconverted route.
 */
export async function verifyAdminToken(req: NextRequest) {
  const result = await requireAdmin(req);
  if (result instanceof NextResponse) return result;
  if (result.role !== "super_admin") {
    return NextResponse.json({ error: "This isn't available for your role yet." }, { status: 403 });
  }
  return { uid: result.uid, email: result.email, role: result.role };
}