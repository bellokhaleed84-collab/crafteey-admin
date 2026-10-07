"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { dateTime } from "@/lib/format";
import { LOCK_REASON_LABELS, REPORT_REASON_LABELS, REPORT_STATUS_LABELS } from "@/lib/moderationLabels";

type Report = {
  _id: string;
  reporterRole: string;
  reason: string;
  details: string;
  status: string;
  adminNote: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  companyId: string;
  companyName: string;
  clientName: string;
};
type Msg = { id: string; senderRole: string; type: string; text: string; createdAt: string | null };
type Blocked = { _id: string; role: string; text: string; reason: string; createdAt: string };
type Detail = {
  report: Report;
  company: { name: string; status: string } | null;
  messages: Msg[];
  messagesError: string | null;
  blocked: Blocked[];
};

export default function ChatReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getIdToken } = useAdminAuth();
  const [data, setData] = useState<Detail | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [warnReason, setWarnReason] = useState("");
  const [warning, setWarning] = useState(false);
  const [warnMsg, setWarnMsg] = useState("");
  const [warnError, setWarnError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/admin/chat-reports/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Something went wrong");
      setData(d);
      setNote(d.report?.adminNote ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this report");
    } finally {
      setLoading(false);
    }
  }, [getIdToken, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(status: string) {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/admin/chat-reports/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote: note }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Could not save");
      setSaved(true);
      setData((cur) => (cur ? { ...cur, report: { ...cur.report, status, adminNote: note } } : cur));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function warnCompany() {
    if (!data || warning) return;
    if (!window.confirm("Send an official warning to this company? It is recorded on the company and in the audit log.")) return;
    setWarning(true);
    setWarnError("");
    setWarnMsg("");
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/admin/companies/${data.report.companyId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "warn", reason: warnReason, reportId: data.report._id }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Could not record the warning");
      setWarnMsg(`Warning recorded. This company now has ${d.warningCount} warning(s).`);
      setWarnReason("");
    } catch (e) {
      setWarnError(e instanceof Error ? e.message : "Could not record the warning");
    } finally {
      setWarning(false);
    }
  }

  const r = data?.report;

  return (
    <div>
      <Link href="/chat-reports" className="text-sm font-semibold text-slate-500 hover:text-slate-900">
        Back to chat reports
      </Link>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading && (
        <div className="mt-4 animate-pulse space-y-3" aria-busy="true">
          <div className="h-24 rounded-2xl bg-slate-100" />
          <div className="h-48 rounded-2xl bg-slate-100" />
        </div>
      )}

      {r && data && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-1">
            <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-slate-400">Report</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{REPORT_REASON_LABELS[r.reason] || r.reason}</p>
              {r.details && <p className="mt-1 text-sm text-slate-700">{r.details}</p>}
              <dl className="mt-3 space-y-1 text-xs text-slate-500">
                <div>Company: <span className="font-semibold text-slate-700">{data.company?.name || r.companyName}</span>
                  {data.company?.status ? ` (${data.company.status})` : ""}</div>
                <div>Customer: <span className="font-semibold text-slate-700">{r.clientName}</span></div>
                <div>Reported by the {r.reporterRole === "client" ? "customer" : "company"} on {dateTime(r.createdAt)}</div>
                <div>Status: <span className="font-semibold text-slate-700">{REPORT_STATUS_LABELS[r.status] || r.status}</span></div>
                {r.reviewedBy && <div>Last reviewed by {r.reviewedBy}{r.reviewedAt ? ` on ${dateTime(r.reviewedAt)}` : ""}</div>}
              </dl>
            </section>

            <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-slate-900">Decision</p>
              <textarea
                rows={3}
                maxLength={500}
                value={note}
                onChange={(e) => {
                  setSaved(false);
                  setNote(e.target.value);
                }}
                placeholder="Internal note (only admins see this)"
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              />
              {saved && <p className="mt-2 rounded-lg bg-green-50 p-2 text-xs text-green-700">Saved.</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={saving} onClick={() => void setStatus("reviewed")}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
                  Mark reviewed
                </button>
                <button type="button" disabled={saving} onClick={() => void setStatus("action_taken")}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
                  Action taken
                </button>
                <button type="button" disabled={saving} onClick={() => void setStatus("dismissed")}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-40">
                  Dismiss
                </button>
                {r.status !== "open" && (
                  <button type="button" disabled={saving} onClick={() => void setStatus("open")}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-40">
                    Reopen
                  </button>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-slate-900">Warn this company</p>
              <p className="mt-1 text-xs text-slate-500">
                Records a warning on the company. To suspend, use the Companies page (needs the review permission).
              </p>
              <textarea
                rows={2}
                maxLength={300}
                value={warnReason}
                onChange={(e) => setWarnReason(e.target.value)}
                placeholder="Reason for the warning"
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              />
              {warnMsg && <p className="mt-2 rounded-lg bg-green-50 p-2 text-xs text-green-700">{warnMsg}</p>}
              {warnError && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{warnError}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={warning || warnReason.trim().length < 5}
                  onClick={() => void warnCompany()}
                  className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                >
                  {warning ? "Saving..." : "Warn company"}
                </button>
                <Link href="/companies?tab=approved" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                  Open Companies
                </Link>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-slate-900">Blocked attempts in this chat</p>
              {data.blocked.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">None.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {data.blocked.map((b) => (
                    <li key={b._id} className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                      <p className="font-semibold">
                        {b.role === "client" ? "Customer" : "Company"} - {LOCK_REASON_LABELS[b.reason] || b.reason} - {dateTime(b.createdAt)}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words">{b.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm lg:col-span-2">
            <p className="text-sm font-bold text-slate-900">Chat (last 150 messages, read-only)</p>
            {data.messagesError && <p className="mt-2 text-sm text-red-700">{data.messagesError}</p>}
            {!data.messagesError && data.messages.length === 0 && (
              <p className="mt-2 text-sm text-slate-500">No messages.</p>
            )}
            <div className="mt-3 space-y-2">
              {data.messages.map((m) =>
                m.type === "system" ? (
                  <p key={m.id} className="text-center text-xs text-slate-400">{m.text}</p>
                ) : (
                  <div key={m.id} className={`flex ${m.senderRole === "company" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                        m.senderRole === "company" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-900"
                      }`}
                    >
                      <p className="text-[10px] font-semibold uppercase opacity-60">
                        {m.senderRole === "company" ? "Company" : "Customer"}
                        {m.type === "quote" ? " - quotation" : ""}
                        {m.createdAt ? ` - ${dateTime(m.createdAt)}` : ""}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words">{m.text}</p>
                    </div>
                  </div>
                )
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}