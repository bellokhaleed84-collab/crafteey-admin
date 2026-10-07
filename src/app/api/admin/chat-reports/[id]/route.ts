import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getFirestore } from "firebase-admin/firestore";
import "@/lib/firebase/adminApp";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import ChatReport, { REPORT_STATUSES, type IChatReport } from "@/models/ChatReport";
import BlockedMessage from "@/models/BlockedMessage";
import Company from "@/models/Company";
import { logAudit } from "@/lib/audit";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };
type ReportDoc = IChatReport & { _id: unknown };
type BlockedDoc = { _id: unknown; uid: string; role: string; text: string; reason: string; createdAt: Date };

/** GET /api/admin/chat-reports/[id] -> the report, the chat (read-only) and blocked attempts. */
export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const admin = await requirePermission(req, "chat.moderate");
    if (admin instanceof NextResponse) return admin;
    if (!mongoose.isValidObjectId(params.id)) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    await connectToDatabase();

    const report = (await ChatReport.findById(params.id).lean()) as unknown as ReportDoc | null;
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    const company = mongoose.isValidObjectId(report.companyId)
      ? ((await Company.findById(report.companyId).select("businessName status").lean()) as unknown as {
          businessName?: string;
          status?: string;
        } | null)
      : null;

    let messages: { id: string; senderRole: string; type: string; text: string; createdAt: string | null }[] = [];
    let messagesError: string | null = null;
    try {
      if (!report.conversationId || report.conversationId.includes("/")) throw new Error("bad conversation id");
      const snap = await getFirestore()
        .collection("conversations")
        .doc(report.conversationId)
        .collection("messages")
        .orderBy("createdAt", "desc")
        .limit(150)
        .get();
      messages = snap.docs.reverse().map((d) => {
        const x = d.data();
        const ts = x.createdAt && typeof x.createdAt.toDate === "function" ? x.createdAt.toDate().toISOString() : null;
        return { id: d.id, senderRole: x.senderRole ?? "system", type: x.type ?? "text", text: x.text ?? "", createdAt: ts };
      });
    } catch (e) {
      console.error("chat report: couldn't load messages", e);
      messagesError = "Couldn't load the chat messages.";
    }

    const blocked = (await BlockedMessage.find({ conversationId: report.conversationId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()) as unknown as BlockedDoc[];

    await logAudit(admin, {
      action: "chat_report.view",
      targetType: "ChatReport",
      targetId: params.id,
      summary: `Viewed reported chat between ${report.clientName || "customer"} and ${report.companyName || "company"}`,
    });

    return NextResponse.json({
      report: {
        _id: String(report._id),
        reporterRole: report.reporterRole,
        reason: report.reason,
        details: report.details,
        status: report.status,
        adminNote: report.adminNote ?? "",
        reviewedBy: report.reviewedBy ?? null,
        reviewedAt: report.reviewedAt ?? null,
        createdAt: report.createdAt,
        companyId: report.companyId,
        companyName: report.companyName,
        clientName: report.clientName,
      },
      company: company ? { name: company.businessName ?? "", status: company.status ?? "" } : null,
      messages,
      messagesError,
      blocked: blocked.map((b) => ({
        _id: String(b._id),
        role: b.role,
        text: b.text,
        reason: b.reason,
        createdAt: b.createdAt,
      })),
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/chat-reports/[id]");
  }
}

/** PATCH /api/admin/chat-reports/[id]  body: { status, adminNote? } */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const admin = await requirePermission(req, "chat.moderate");
    if (admin instanceof NextResponse) return admin;
    if (!mongoose.isValidObjectId(params.id)) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    const body = await req.json().catch(() => null);
    const status = String(body?.status ?? "");
    const adminNote = String(body?.adminNote ?? "").trim().slice(0, 500);
    if (!(REPORT_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: "Choose a valid status." }, { status: 400 });
    }

    await connectToDatabase();
    const before = (await ChatReport.findById(params.id).select("status companyName").lean()) as unknown as {
      status?: string;
      companyName?: string;
    } | null;
    if (!before) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    await ChatReport.updateOne(
      { _id: params.id },
      { $set: { status, adminNote, reviewedBy: admin.email, reviewedAt: new Date() } }
    );

    await logAudit(admin, {
      action: "chat_report.update",
      targetType: "ChatReport",
      targetId: params.id,
      summary: `Chat report on ${before.companyName || "company"}: ${before.status} -> ${status}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, "PATCH /api/admin/chat-reports/[id]");
  }
}