import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import SupportTicket, { TICKET_STATUSES } from "@/models/SupportTicket";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type Row = {
  _id: unknown;
  userType?: string;
  clientName?: string;
  category?: string;
  subject?: string;
  status?: string;
  lastMessage?: string;
  lastMessageAt?: Date;
  unreadAdmin?: number;
};

function kind(t?: string): "rider" | "vendor" | "client" {
  return t === "rider" ? "rider" : t === "vendor" ? "vendor" : "client";
}

const DEFAULT_NAME = { rider: "Rider", vendor: "Vendor", client: "Customer" } as const;

/** GET /api/admin/support/tickets?status=open|in_progress|fixed|all&who=client|rider|vendor&page=1 */
export async function GET(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "support.view");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") || "open";
    const who = sp.get("who") || "";
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);

    // Who filter also applies to the tab counts.
    // Customers = everything that is not a rider or a vendor (older tickets have no userType).
    const scope: Record<string, unknown> = {};
    if (who === "rider") scope.userType = "rider";
    if (who === "vendor") scope.userType = "vendor";
    if (who === "client") scope.userType = { $nin: ["rider", "vendor"] };

    const filter: Record<string, unknown> = { ...scope };
    if ((TICKET_STATUSES as readonly string[]).includes(status)) filter.status = status;

    const [rows, total, grouped] = await Promise.all([
      SupportTicket.find(filter)
        .select("-messages")
        .sort({ lastMessageAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean<Row[]>(),
      SupportTicket.countDocuments(filter),
      SupportTicket.aggregate<{ _id: string; n: number }>([
        { $match: scope },
        { $group: { _id: "$status", n: { $sum: 1 } } },
      ]),
    ]);

    const counts: Record<string, number> = { open: 0, in_progress: 0, fixed: 0 };
    for (const g of grouped) counts[g._id] = g.n;

    return NextResponse.json({
      tickets: rows.map((r) => {
        const k = kind(r.userType);
        return {
          id: String(r._id),
          userType: k,
          clientName: r.clientName || DEFAULT_NAME[k],
          category: r.category ?? "",
          subject: r.subject ?? "",
          status: r.status ?? "open",
          lastMessage: r.lastMessage ?? "",
          lastMessageAt: r.lastMessageAt,
          unreadAdmin: r.unreadAdmin ?? 0,
        };
      }),
      counts,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      total,
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/support/tickets");
  }
}