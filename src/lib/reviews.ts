import { connectToDatabase } from "@/lib/mongodb";
import Review, { type ReviewTarget } from "@/models/Review";
import Company from "@/models/Company";

/**
 * Recalculates the average rating and count from PUBLISHED reviews only,
 * and saves them on the target. Safe to call as often as you like.
 * Only companies for now; vendors and riders are added when their reviews are built.
 */
export async function recomputeRating(
  targetType: ReviewTarget,
  targetId: string
): Promise<{ rating: number; count: number }> {
  await connectToDatabase();
  const rows = await Review.aggregate([
    { $match: { targetType, targetId, status: "published" } },
    { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const count: number = rows[0]?.count ?? 0;
  const rating = count > 0 ? Math.round(rows[0].avg * 10) / 10 : 0;

  if (targetType === "company") {
    await Company.updateOne({ _id: targetId }, { $set: { rating, ratingCount: count } });
  }
  return { rating, count };
}