"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { dateTime } from "@/lib/format";
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_STYLE } from "@/lib/supportLabels";

type Msg = { id: string; senderRole: "client" | "admin"; senderName: string; text: string; createdAt: string };
type Ticket = {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  category: string;
  subject: string;
  status: string;
  createdAt: string;
  fixedAt: string | null;
  fixedBy: string | null;
  messages: Msg[];
};

const POLL_MS = 5000;

export default function SupportTicketPage() {
  const { id } = useParams<{ id: string }>();
  const { getIdToken, can } = useAdminAuth();
  const canManage = can("support.manage");

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loadError, setLoadError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const loadedRef = useRef(false);
  const statusRef = useRef("open");

  const load = useCallback(async () => {
    if (!id || inFlight.current) return;
    inFlight.current = true;
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/admin/support/tickets/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!loadedRef.current) setLoadError(d?.error || "Could not load this report");
        return;
      }
      loadedRef.current = true;
      statusRef.current = d.ticket?.status ?? "open";
      setTicket(d.ticket);
      setLoadError("");
    } catch (e) {
      if (!loadedRef.current) setLoadError(e instanceof Error ? e.message : "Could not load this report");
    } finally {
      inFlight.current = false;
    }
  }, [getIdToken, id]);

  // Refresh every few seconds while open (stops once fixed).
  useEffect(() => {
    void load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && statusRef.current !== "fixed") void load();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const count = ticket?.messages.length ?? 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [count]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setActionError("");
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/admin/support/tickets/${id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Could not send");
      setText("");
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not send");
      void load();
    } finally {
      setSending(false);
    }
  }

  async function setStatus(status: "in_progress" | "fixed") {
    if (busy) return;
    if (
      status === "fixed" &&
      !window.confirm("Mark this problem as fixed? The chat closes right away and the customer can no longer reply.")
    ) {
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/admin/support/tickets/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Could not save");
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  const fixed = ticket?.status === "fixed";

  return (
    <div>
      <Link href="/support" className="text-sm font-semibold text-slate-500 hover:text-slate-900">
        Back to support
      </Link>

      {loadError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{loadError}</p>}
      {!ticket && !loadError && (
        <div className="mt-4 animate-pulse space-y-3" aria-busy="true">
          <div className="h-24 rounded-2xl bg-slate-100" />
          <div className="h-64 rounded-2xl bg-slate-100" />
        </div>
      )}

      {ticket && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-1">
            <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase text-slate-400">Report</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{CATEGORY_LABELS[ticket.category] || ticket.category}</p>
              <p className="mt-1 text-sm text-slate-700">{ticket.subject}</p>
              <dl className="mt-3 space-y-1 text-xs text-slate-500">
                <div>
                  Customer: <span className="font-semibold text-slate-700">{ticket.clientName || "Unknown"}</span>
                </div>
                {ticket.clientEmail && (
                  <div>
                    Email: <span className="break-all font-semibold text-slate-700">{ticket.clientEmail}</span>
                  </div>
                )}
                {ticket.clientPhone && (
                  <div>
                    Phone: <span className="font-semibold text-slate-700">{ticket.clientPhone}</span>
                  </div>
                )}
                <div>Sent {dateTime(ticket.createdAt)}</div>
                <div>
                  Status:{" "}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[ticket.status] || ""}`}>
                    {STATUS_LABELS[ticket.status] || ticket.status}
                  </span>
                </div>
                {fixed && ticket.fixedAt && (
                  <div>
                    Fixed {dateTime(ticket.fixedAt)}
                    {ticket.fixedBy ? ` by ${ticket.fixedBy}` : ""}
                  </div>
                )}
              </dl>
            </section>

            {canManage && !fixed && (
              <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-sm font-bold text-slate-900">Status</p>
                <p className="mt-1 text-xs text-slate-500">
                  Replying moves the report to In progress. Mark it fixed when the problem is solved. That closes the chat.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ticket.status === "open" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void setStatus("in_progress")}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40"
                    >
                      Mark in progress
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void setStatus("fixed")}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    {busy ? "Saving..." : "Mark fixed"}
                  </button>
                </div>
              </section>
            )}

            {actionError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{actionError}</p>}
          </div>

          <section className="flex flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-sm lg:col-span-2">
            <p className="text-sm font-bold text-slate-900">Chat</p>
            <div className="mt-3 h-[55vh] space-y-2 overflow-y-auto pr-1">
              {ticket.messages.map((m) => {
                const mine = m.senderRole === "admin";
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                        mine ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-900"
                      }`}
                    >
                      <p className="text-[10px] font-semibold uppercase opacity-60">
                        {mine ? m.senderName || "Support" : ticket.clientName || "Customer"} - {dateTime(m.createdAt)}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words">{m.text}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {fixed ? (
              <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                This problem is fixed and the chat is closed.
              </p>
            ) : canManage ? (
              <form onSubmit={send} className="mt-3 flex items-end gap-2">
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write a reply to the customer"
                  className="min-h-12 flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                />
                <button
                  type="submit"
                  disabled={sending || !text.trim()}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {sending ? "..." : "Send"}
                </button>
              </form>
            ) : (
              <p className="mt-3 text-xs text-slate-500">You can read this chat, but your role can't reply.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}