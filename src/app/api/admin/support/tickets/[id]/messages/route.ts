import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import SupportTicket, { MAX_TICKET_MESSAGES } from "@/models/SupportTicket";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/** POST /api/admin/support/tickets/[id]/messages  body: { text }. Refused once the report is fixed. */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const admin = await requirePermission(req, "support.manage");
    if (admin instanceof NextResponse) return admin;
    if (!mongoose.isValidObjectId(params.id)) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    const body = await req.json().catch(() => null);
    const text = String(body?.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "Type a message first." }, { status: 400 });
    if (text.length > 1000) {
      return NextResponse.json({ error: "Messages can be up to 1000 characters." }, { status: 400 });
    }

    await connectToDatabase();

    const now = new Date();
    const filter: Record<string, unknown> = {
      _id: params.id,
      status: { $ne: "fixed" },
      [`messages.${MAX_TICKET_MESSAGES - 1}`]: { $exists: false },
    };

    const res = await SupportTicket.updateOne(filter, {
      $push: { messages: { senderRole: "admin", senderName: admin.name, text, createdAt: now } },
      $set: { status: "in_progress", lastMessage: text.slice(0, 120), lastMessageAt: now, unreadAdmin: 0 },
      $inc: { unreadClient: 1 },
    });

    if (res.matchedCount === 0) {
      const t = (await SupportTicket.findById(params.id).select("status").lean()) as unknown as {
        status?: string;
      } | null;
      if (!t) return NextResponse.json({ error: "Report not found" }, { status: 404 });
      if (t.status === "fixed") {
        return NextResponse.json({ error: "This report is fixed, so the chat is closed." }, { status: 409 });
      }
      return NextResponse.json({ error: "This chat has reached its message limit." }, { status: 409 });
    }

    await logAudit(admin, {
      action: "support_ticket.reply",
      targetType: "SupportTicket",
      targetId: params.id,
      summary: "Replied to a customer support report",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, "POST /api/admin/support/tickets/[id]/messages");
  }
}