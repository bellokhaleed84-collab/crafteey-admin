import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import Review, { type ReviewTarget } from "@/models/Review";
import { recomputeRating } from "@/lib/reviews";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

type ReviewRow = {
  _id: unknown;
  targetType: ReviewTarget;
  targetId: string;
  targetName?: string;
  reviewerName?: string;
  rating: number;
  status: string;
};

/**
 * PATCH /api/admin/reviews/[id]
 * body: { action: "hide" | "unhide" | "recalculate", reason? }
 *  - hide: reason required (at least 5 characters). The review disappears from the app.
 *  - unhide: puts a hidden review back.
 *  - recalculate: recounts the company's rating from published reviews.
 * Hide and unhide recalculate the average automatically.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requirePermission(req, "reviews.manage");
    if (admin instanceof NextResponse) return admin;
    if (!mongoose.isValidObjectId(params.id)) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    if (!["hide", "unhide", "recalculate"].includes(action)) {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    await connectToDatabase();
    const review = await Review.findById(params.id).lean<ReviewRow | null>();
    if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 });

    const who = `${review.reviewerName || "Customer"} on ${review.targetName || "company"}`;

    if (action === "recalculate") {
      const result = await recomputeRating(review.targetType, review.targetId);
      await logAudit(admin, {
        action: "review.recalculate",
        targetType: "Review",
        targetId: params.id,
        summary: `Recalculated rating for ${review.targetName || "company"}: ${result.rating} (${result.count} reviews)`,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === "hide") {
      const reason = String(body?.reason ?? "").trim().slice(0, 300);
      if (reason.length < 5) {
        return NextResponse.json({ error: "Enter a reason (at least 5 characters)." }, { status: 400 });
      }
      const res = await Review.updateOne(
        { _id: params.id, status: "published" },
        { $set: { status: "hidden", hiddenReason: reason, hiddenBy: admin.email, hiddenAt: new Date() } }
      );
      if (res.modifiedCount === 0) {
        return NextResponse.json({ error: "This review is already hidden." }, { status: 409 });
      }
      const result = await recomputeRating(review.targetType, review.targetId);
      await logAudit(admin, {
        action: "review.hide",
        targetType: "Review",
        targetId: params.id,
        summary: `Hid ${review.rating}-star review by ${who}: ${reason}`,
        before: { status: "published" },
        after: { status: "hidden", reason },
      });
      return NextResponse.json({ ok: true, ...result });
    }

    // unhide
    const res = await Review.updateOne(
      { _id: params.id, status: "hidden" },
      { $set: { status: "published" }, $unset: { hiddenReason: "", hiddenBy: "", hiddenAt: "" } }
    );
    if (res.modifiedCount === 0) {
      return NextResponse.json({ error: "This review is already published." }, { status: 409 });
    }
    const result = await recomputeRating(review.targetType, review.targetId);
    await logAudit(admin, {
      action: "review.unhide",
      targetType: "Review",
      targetId: params.id,
      summary: `Restored ${review.rating}-star review by ${who}`,
      before: { status: "hidden" },
      after: { status: "published" },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return apiError(err, "PATCH /api/admin/reviews/[id]");
  }
}