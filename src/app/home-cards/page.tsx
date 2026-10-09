"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import RiderCardView from "@/components/RiderCardView";
import {
  CARD_COLORS,
  CARD_COLOR_LABELS,
  CARD_ICONS,
  CARD_ICON_LABELS,
  DAY_LABELS,
  isCardActive,
} from "@/lib/riderContent";

type Row = {
  _id: string;
  title: string;
  message: string;
  icon: string;
  color: string;
  order: number;
  enabled: boolean;
  schedule: { always: boolean; days: number[]; start: string; end: string };
  startsAt: string | null;
  endsAt: string | null;
};

type FormState = {
  id?: string;
  title: string;
  message: string;
  icon: string;
  color: string;
  enabled: boolean;
  always: boolean;
  days: number[];
  start: string;
  end: string;
  startsAt: string;
  endsAt: string;
};

const EMPTY: FormState = {
  title: "",
  message: "",
  icon: "info",
  color: "orange",
  enabled: true,
  always: true,
  days: [],
  start: "17:00",
  end: "21:00",
  startsAt: "",
  endsAt: "",
};

const PEAK_STARTER: FormState = {
  ...EMPTY,
  title: "Peak hours",
  message: "Demand is highest in the evenings. Stay online to get more delivery requests.",
  icon: "flame",
  color: "orange",
  always: false,
  days: [0, 1, 2, 3, 4, 5, 6],
  start: "17:00",
  end: "21:00",
};

const INPUT = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function toIso(local: string): string {
  return local ? new Date(local).toISOString() : "";
}

function statusOf(r: Row): { label: string; cls: string } {
  const now = Date.now();
  if (!r.enabled) return { label: "Off", cls: "bg-slate-100 text-slate-600" };
  if (r.startsAt && Date.parse(r.startsAt) > now) return { label: "Scheduled", cls: "bg-amber-100 text-amber-800" };
  if (r.endsAt && Date.parse(r.endsAt) < now) return { label: "Expired", cls: "bg-red-100 text-red-700" };
  if (isCardActive(r, now)) return { label: "Showing now", cls: "bg-emerald-100 text-emerald-700" };
  return { label: "Waiting for its time", cls: "bg-blue-100 text-blue-700" };
}

function describe(r: Row): string {
  if (r.schedule.always) return "Shows all the time while switched on";
  return `${r.schedule.days.map((d) => DAY_LABELS[d]).join(", ")}, ${r.schedule.start} to ${r.schedule.end} (Lagos time)`;
}

export default function HomeCardsPage() {
  const { getIdToken } = useAdminAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const api = useCallback(
    async (url: string, method = "GET", body?: unknown) => {
      const token = await getIdToken();
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (body !== undefined) headers["Content-Type"] = "application/json";
      const res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Something went wrong");
      return d;
    },
    [getIdToken]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await api("/api/admin/rider-cards");
      setRows(d.cards);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the cards");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  function openNew(preset?: FormState) {
    setNotice("");
    setError("");
    setForm({ ...(preset ?? EMPTY) });
  }

  function openEdit(r: Row) {
    setNotice("");
    setError("");
    setForm({
      id: r._id,
      title: r.title,
      message: r.message,
      icon: r.icon,
      color: r.color,
      enabled: r.enabled,
      always: r.schedule.always,
      days: r.schedule.days,
      start: r.schedule.start,
      end: r.schedule.end,
      startsAt: toLocalInput(r.startsAt),
      endsAt: toLocalInput(r.endsAt),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function toggleDay(d: number) {
    setForm((f) =>
      f ? { ...f, days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort() } : f
    );
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        title: form.title,
        message: form.message,
        icon: form.icon,
        color: form.color,
        enabled: form.enabled,
        schedule: { always: form.always, days: form.days, start: form.start, end: form.end },
        startsAt: toIso(form.startsAt),
        endsAt: toIso(form.endsAt),
      };
      if (form.id) await api(`/api/admin/rider-cards/${form.id}`, "PATCH", payload);
      else await api("/api/admin/rider-cards", "POST", payload);
      setNotice(form.id ? "Card saved." : "Card added.");
      setForm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(r: Row) {
    setBusyId(r._id);
    setError("");
    setNotice("");
    try {
      await api(`/api/admin/rider-cards/${r._id}`, "PATCH", { enabled: !r.enabled });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setBusyId(null);
    }
  }

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const ids = rows.map((r) => r._id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setBusyId(rows[i]._id);
    setError("");
    try {
      await api("/api/admin/rider-cards", "PUT", { ids });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change the order.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(r: Row) {
    if (!window.confirm(`Delete "${r.title}"? Switching it off instead keeps it for later.`)) return;
    setBusyId(r._id);
    setError("");
    setNotice("");
    try {
      await api(`/api/admin/rider-cards/${r._id}`, "DELETE");
      setNotice("Card deleted.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete that.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rider Home cards</h1>
          <p className="mt-1 text-sm text-slate-500">
            The cards under the map on the rider app's Home screen. Use them for peak hours, safety tips, promotions or any
            notice. Riders only see a card while it is switched on and inside its time window.
          </p>
        </div>
        {!form && (
          <button
            type="button"
            onClick={() => openNew()}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus size={16} /> Add card
          </button>
        )}
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{notice}</p>}

      {form && (
        <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-bold text-slate-900">{form.id ? "Edit card" : "New card"}</h2>

          <div className="mt-3 max-w-sm">
            <p className="mb-1 text-xs font-semibold text-slate-500">Live preview</p>
            <RiderCardView title={form.title} message={form.message} icon={form.icon} color={form.color} />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-600 sm:col-span-2">
              Title (max 40)
              <input className={`${INPUT} mt-1`} maxLength={40} value={form.title} onChange={(e) => set("title", e.target.value)} />
            </label>
            <label className="block text-xs font-semibold text-slate-600 sm:col-span-2">
              Message (max 300)
              <textarea
                className={`${INPUT} mt-1`}
                rows={3}
                maxLength={300}
                value={form.message}
                onChange={(e) => set("message", e.target.value)}
              />
            </label>

            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-slate-600">Icon</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {CARD_ICONS.map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => set("icon", i)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                      form.icon === i ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {CARD_ICON_LABELS[i]}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-slate-600">Colour</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {CARD_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set("color", c)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                      form.color === c ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {CARD_COLOR_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-slate-600">When riders see it</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => set("always", true)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    form.always ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  All the time
                </button>
                <button
                  type="button"
                  onClick={() => set("always", false)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    !form.always ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  Only at set times
                </button>
              </div>
            </div>

            {!form.always && (
              <>
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold text-slate-600">Days</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {DAY_LABELS.map((label, d) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => toggleDay(d)}
                        className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                          form.days.includes(d)
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block text-xs font-semibold text-slate-600">
                  From (Lagos time)
                  <input type="time" className={`${INPUT} mt-1`} value={form.start} onChange={(e) => set("start", e.target.value)} />
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  Until (Lagos time)
                  <input type="time" className={`${INPUT} mt-1`} value={form.end} onChange={(e) => set("end", e.target.value)} />
                </label>
              </>
            )}

            <label className="block text-xs font-semibold text-slate-600">
              Show from date (optional)
              <input type="datetime-local" className={`${INPUT} mt-1`} value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Show until date (optional)
              <input type="datetime-local" className={`${INPUT} mt-1`} value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
            </label>

            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
              <input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} />
              Switched on
            </label>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={saving || !form.title.trim()}
              onClick={() => void save()}
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save card"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setForm(null)}
              className="rounded-lg border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {loading ? (
          <div className="space-y-3 p-4" aria-busy="true">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <p className="text-sm text-slate-500">
              No cards yet, so riders see nothing under the map. Add one, or start with the Peak hours card.
            </p>
            <button
              type="button"
              onClick={() => openNew(PEAK_STARTER)}
              className="mt-3 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900"
            >
              Start with a Peak hours card
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r, i) => {
              const busy = busyId === r._id;
              const st = statusOf(r);
              return (
                <li key={r._id} className="flex flex-wrap items-center gap-4 px-4 py-4">
                  <div className="w-full max-w-xs shrink-0">
                    <RiderCardView title={r.title} message={r.message} icon={r.icon} color={r.color} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                    <p className="mt-1 text-xs text-slate-500">{describe(r)}</p>
                    {(r.startsAt || r.endsAt) && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        {r.startsAt ? `From ${new Date(r.startsAt).toLocaleString()}` : ""}
                        {r.startsAt && r.endsAt ? " - " : ""}
                        {r.endsAt ? `Until ${new Date(r.endsAt).toLocaleString()}` : ""}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy || i === 0}
                      onClick={() => void move(i, -1)}
                      aria-label="Move up"
                      className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-30"
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      type="button"
                      disabled={busy || i === rows.length - 1}
                      onClick={() => void move(i, 1)}
                      aria-label="Move down"
                      className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-30"
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void toggle(r)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                        r.enabled ? "border border-slate-200 text-slate-600" : "bg-emerald-600 text-white"
                      }`}
                    >
                      {r.enabled ? "Switch off" : "Switch on"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => openEdit(r)}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void remove(r)}
                      aria-label="Delete card"
                      className="rounded-lg border border-red-200 p-2 text-red-600 disabled:opacity-50"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}