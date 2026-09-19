import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/adminApp";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());

export async function verifyAdminToken(req: NextRequest) {
  const idToken = req.headers.get("authorization")?.split("Bearer ")[1];

  if (!idToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const email = decodedToken.email?.toLowerCase();

    if (!email || !ADMIN_EMAILS.includes(email)) {
      return NextResponse.json({ error: "Not an admin account" }, { status: 403 });
    }

    return { uid: decodedToken.uid, email };
  } catch (error) {
    console.error("Error verifying admin token:", error);
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
}
