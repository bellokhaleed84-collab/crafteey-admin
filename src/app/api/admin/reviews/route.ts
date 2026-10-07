import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import Review from "@/models/Review";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type ReviewRow = {
  _id: unknown;
  reviewerName?: string;
  targetType: string;
  targetId: string;
  targetName?: string;
  sourceType: string;
  rating: number;
  comment?: string;
  status: string;
  hiddenReason?: string;
  hiddenBy?: string;
  hiddenAt?: Date;
  createdAt: Date;
};

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** GET /api/admin/reviews?status=published|hidden|all&rating=1-5&q=&page=1 */
export async function GET(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "reviews.manage");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") || "published";
    const rating = parseInt(sp.get("rating") || "", 10);
    const q = (sp.get("q") || "").trim().slice(0, 80);
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);

    const filter: Record<string, unknown> = {};
    if (status === "published" || status === "hidden") filter.status = status;
    if (Number.isInteger(rating) && rating >= 1 && rating <= 5) filter.rating = rating;
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ targetName: rx }, { reviewerName: rx }];
    }

    const [rows, total, grouped] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean<ReviewRow[]>(),
      Review.countDocuments(filter),
      Review.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    ]);

    const counts: Record<string, number> = { published: 0, hidden: 0, all: 0 };
    for (const g of grouped) {
      counts[g._id] = g.n;
      counts.all += g.n;
    }

    return NextResponse.json({
      reviews: rows.map((r) => ({
        _id: String(r._id),
        reviewerName: r.reviewerName || "Customer",
        targetType: r.targetType,
        targetName: r.targetName || "Unknown",
        sourceType: r.sourceType,
        rating: r.rating,
        comment: r.comment ?? "",
        status: r.status,
        hiddenReason: r.hiddenReason ?? null,
        hiddenBy: r.hiddenBy ?? null,
        hiddenAt: r.hiddenAt ?? null,
        createdAt: r.createdAt,
      })),
      counts,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      total,
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/reviews");
  }
}