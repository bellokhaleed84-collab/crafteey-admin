import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/middleware/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import BlockedMessage from "@/models/BlockedMessage";
import Company from "@/models/Company";
import Client from "@/models/Client";
import { apiError } from "@/lib/apiError";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const DAY = 24 * 60 * 60 * 1000;
const RANGES: Record<string, number | null> = { "24h": DAY, "7d": 7 * DAY, "30d": 30 * DAY, all: null };
const REASONS = ["phone", "email", "link", "social", "outside_contact", "payment_outside"];

type Row = {
  _id: unknown;
  uid: string;
  role: string;
  conversationId: string;
  companyId: string;
  text: string;
  reason: string;
  createdAt: Date;
};

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** GET /api/admin/blocked-messages?range=24h|7d|30d|all&reason=&q=&page=1 (read-only) */
export async function GET(req: NextRequest) {
  try {
    const admin = await requirePermission(req, "chat.moderate");
    if (admin instanceof NextResponse) return admin;
    await connectToDatabase();

    const sp = req.nextUrl.searchParams;
    const range = sp.get("range") && sp.get("range")! in RANGES ? sp.get("range")! : "7d";
    const reason = sp.get("reason") || "";
    const q = (sp.get("q") || "").trim().slice(0, 80);
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);

    const filter: Record<string, unknown> = {};
    const ms = RANGES[range];
    if (ms) filter.createdAt = { $gte: new Date(Date.now() - ms) };
    if (REASONS.includes(reason)) filter.reason = reason;
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      const companies = await Company.find({ businessName: rx }).select("_id").limit(100).lean();
      filter.$or = [{ uid: q }, { companyId: { $in: companies.map((c) => String(c._id)) } }];
    }

    const [rows, total, byReason, offenders] = await Promise.all([
      BlockedMessage.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean<Row[]>(),
      BlockedMessage.countDocuments(filter),
      BlockedMessage.aggregate<{ _id: string; n: number }>([
        { $match: filter },
        { $group: { _id: "$reason", n: { $sum: 1 } } },
      ]),
      BlockedMessage.aggregate<{ _id: { uid: string; role: string }; n: number; last: Date; companyId: string }>([
        { $match: filter },
        {
          $group: {
            _id: { uid: "$uid", role: "$role" },
            n: { $sum: 1 },
            last: { $max: "$createdAt" },
            companyId: { $first: "$companyId" },
          },
        },
        { $match: { n: { $gte: 2 } } },
        { $sort: { n: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const companyIds = [...new Set([...rows.map((r) => r.companyId), ...offenders.map((o) => o.companyId)])];
    const clientUids = [
      ...new Set([
        ...rows.filter((r) => r.role === "client").map((r) => r.uid),
        ...offenders.filter((o) => o._id.role === "client").map((o) => o._id.uid),
      ]),
    ];
    const companies = companyIds.length
      ? await Company.find({ _id: { $in: companyIds.filter((id) => /^[a-f0-9]{24}$/i.test(id)) } })
          .select("businessName")
          .lean()
      : [];
    const clients = clientUids.length
      ? await Client.find({ firebaseUid: { $in: clientUids } }).select("firebaseUid name").lean()
      : [];
    const companyName = new Map(companies.map((c) => [String(c._id), c.businessName as string]));
    const clientName = new Map(clients.map((c) => [c.firebaseUid as string, c.name as string]));

    const who = (role: string, uid: string, companyId: string) =>
      role === "company"
        ? companyName.get(companyId) || "Company"
        : clientName.get(uid) || "Customer";

    return NextResponse.json({
      blocked: rows.map((r) => ({
        _id: String(r._id),
        role: r.role,
        sender: who(r.role, r.uid, r.companyId),
        companyName: companyName.get(r.companyId) || "",
        text: r.text,
        reason: r.reason,
        createdAt: r.createdAt,
      })),
      byReason: Object.fromEntries(byReason.map((g) => [g._id, g.n])),
      repeat: offenders.map((o) => ({
        key: `${o._id.role}:${o._id.uid}`,
        role: o._id.role,
        sender: who(o._id.role, o._id.uid, o.companyId),
        count: o.n,
        last: o.last,
      })),
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      total,
    });
  } catch (err) {
    return apiError(err, "GET /api/admin/blocked-messages");
  }
}