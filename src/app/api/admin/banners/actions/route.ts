import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import mongoose from "mongoose";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import Banner from "@/models/Banner";
import { apiError } from "@/lib/apiError";
import { logAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const STARTERS = [
  {
    title: "Need it delivered?",
    subtitle: "Send a package anywhere in Lagos.",
    buttonText: "Book a rider",
    link: "/dashboard/rider",
    emoji: "\uD83D\uDEF5",
    theme: "navy",
  },
  {
    title: "Something needs fixing?",
    subtitle: "Book a trusted pro near you.",
    buttonText: "Find a pro",
    link: "/dashboard/technicians",
    emoji: "\uD83D\uDEE0\uFE0F",
    theme: "yellow",
  },
  {
    title: "Everything you need, nearby",
    subtitle: "Food, groceries and more from local vendors.",
    buttonText: "Open Hub",
    link: "/dashboard/hub",
    emoji: "\uD83E\uDDFA",
    theme: "purple",
  },
  {
    title: "Going somewhere?",
    subtitle: "Pick a ride or cargo van in minutes.",
    buttonText: "Book a ride",
    link: "/dashboard/rider",
    emoji: "\uD83D\uDE97",
    theme: "orange",
  },
  {
    title: "One app. Get things done.",
    subtitle: "Rides, Hub and technicians in one place.",
    buttonText: "Explore",
    link: "/dashboard",
    emoji: "\uD83D\uDCF1",
    theme: "white",
  },
];

/**
 * POST /api/admin/banners/actions
 * body: { action: "seed" } | { action: "reorder", ids: string[] } | { action: "signature" }
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "banners.manage");
    if (admin instanceof NextResponse) return admin;

    const body = (await req.json().catch(() => null)) as { action?: string; ids?: unknown } | null;
    if (!body?.action) return NextResponse.json({ error: "Bad request" }, { status: 400 });

    if (body.action === "signature") {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;
      if (!cloudName || !apiKey || !apiSecret) {
        return NextResponse.json(
          { error: "Image upload is not set up in the admin app yet (missing Cloudinary settings)." },
          { status: 500 }
        );
      }
      const folder = "crafteey/banners";
      const timestamp = Math.round(Date.now() / 1000);
      const signature = createHash("sha1")
        .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
        .digest("hex");
      return NextResponse.json({ signature, timestamp, cloudName, apiKey, folder });
    }

    await connectToDatabase();

    if (body.action === "seed") {
      const existing = await Banner.countDocuments();
      if (existing > 0) {
        return NextResponse.json({ error: "There are already banners, so nothing was added." }, { status: 409 });
      }
      await Banner.insertMany(STARTERS.map((b, i) => ({ ...b, order: i, enabled: true })));
      await logAudit(admin, {
        action: "banner.seed",
        targetType: "banner",
        summary: "Added the 5 starter banners",
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "reorder") {
      const ids = Array.isArray(body.ids) ? body.ids : [];
      if (ids.length === 0 || !ids.every((id) => typeof id === "string" && mongoose.isValidObjectId(id))) {
        return NextResponse.json({ error: "Bad request" }, { status: 400 });
      }
      await Promise.all((ids as string[]).map((id, i) => Banner.updateOne({ _id: id }, { $set: { order: i } })));
      await logAudit(admin, {
        action: "banner.reorder",
        targetType: "banner",
        summary: "Changed the banner order",
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return apiError(err, "POST /api/admin/banners/actions");
  }
}