import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import SupportTicket from "@/models/SupportTicket";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

type MsgRow = { _id: unknown; senderRole: string; senderName?: string; text: string; createdAt: Date };
type TicketDoc = {
  _id: unknown;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  category: string;
  subject: string;
  status: string;
  unreadAdmin?: number;
  messages?: MsgRow[];
  createdAt: Date;
  fixedAt?: Date;
  fixedBy?: string;
};

/** GET /api/admin/support/tickets/[id] -> the report and its chat. Clears the admin unread count. */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const admin = await requirePermission(req, "support.view");
    if (admin instanceof NextResponse) return admin;
    if (!mongoose.isValidObjectId(params.id)) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    await connectToDatabase();

    const t = (await SupportTicket.findById(params.id).lean()) as unknown as TicketDoc | null;
    if (!t) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    if ((t.unreadAdmin ?? 0) > 0) {
      await SupportTicket.updateOne({ _id: params.id }, { $set: { unreadAdmin: 0 } });
    }

    return NextResponse.json({
      ticket: {
        id: String(t._id),
        clientName: t.clientName ?? "",
        clientEmail: t.clientEmail ?? "",
        clientPhone: t.clientPhone ?? "",
        category: t.category,
        subject: t.subject,
        status: t.status,
        createdAt: t.createdAt,
        fixedAt: t.fixedAt ?? null,
        fixedBy: t.fixedBy ?? null,
        messages: (t.messages ?? []).map((m) => ({
          id: String(m._id),
          senderRole: m.senderRole,
          senderName: m.senderName ?? "",
          text: m.text,
          createdAt: m.createdAt,
        })),
      },
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/support/tickets/[id]");
  }
}

/** PATCH /api/admin/support/tickets/[id]  body: { status: "in_progress" | "fixed" }. Fixed closes the chat for good. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const admin = await requirePermission(req, "support.manage");
    if (admin instanceof NextResponse) return admin;
    if (!mongoose.isValidObjectId(params.id)) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    const body = await req.json().catch(() => null);
    const status = String(body?.status ?? "");
    if (status !== "in_progress" && status !== "fixed") {
      return NextResponse.json({ error: "Choose a valid status." }, { status: 400 });
    }

    await connectToDatabase();

    const before = (await SupportTicket.findById(params.id).select("status subject clientName").lean()) as unknown as {
      status?: string;
      subject?: string;
      clientName?: string;
    } | null;
    if (!before) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    if (before.status === "fixed") {
      return NextResponse.json({ error: "This report is already fixed and closed." }, { status: 409 });
    }

    const set: Record<string, unknown> =
      status === "fixed" ? { status, fixedAt: new Date(), fixedBy: admin.name } : { status };

    const filter: Record<string, unknown> = { _id: params.id, status: { $ne: "fixed" } };
    const res = await SupportTicket.updateOne(filter, { $set: set, $inc: { unreadClient: 1 } });
    if (res.matchedCount === 0) {
      return NextResponse.json({ error: "This report is already fixed and closed." }, { status: 409 });
    }

    await logAudit(admin, {
      action: status === "fixed" ? "support_ticket.fixed" : "support_ticket.in_progress",
      targetType: "SupportTicket",
      targetId: params.id,
      summary: `Support report from ${before.clientName || "customer"} (${before.subject || "no subject"}): ${before.status} -> ${status}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, "PATCH /api/admin/support/tickets/[id]");
  }
}