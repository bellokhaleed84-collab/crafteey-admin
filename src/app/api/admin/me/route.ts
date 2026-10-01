import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/middleware/adminAuth";
import { permissionsForRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Who am I, and what can I do? The app builds the menu from this.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;
  return NextResponse.json({
    admin: {
      name: admin.name,
      email: admin.email,
      role: admin.role,
      permissions: permissionsForRole(admin.role),
    },
  });
}