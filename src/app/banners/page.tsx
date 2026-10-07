"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import BannerSlideView from "@/components/BannerSlideView";
import { BANNER_THEMES, BANNER_THEME_LABELS } from "@/lib/bannerThemes";

type Row = {
  _id: string;
  title: string;
  subtitle: string;
  buttonText: string;
  link: string;
  art: string;
  emoji: string;
  theme: string;
  order: number;
  enabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

type FormState = {
  id?: string;
  title: string;
  subtitle: string;
  buttonText: string;
  link: string;
  art: string;
  emoji: string;
  theme: string;
  enabled: boolean;
  startsAt: string;
  endsAt: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  subtitle: "",
  buttonText: "",
  link: "/dashboard",
  art: "",
  emoji: "",
  theme: "navy",
  enabled: true,
  startsAt: "",
  endsAt: "",
};

const QUICK_LINKS = [
  { label: "Home", value: "/dashboard" },
  { label: "Crafteey Hub", value: "/dashboard/hub" },
  { label: "Rides", value: "/dashboard/rider" },
  { label: "Technicians", value: "/dashboard/technicians" },
  { label: "Wallet", value: "/dashboard/hub/wallet" },
  { label: "History", value: "/dashboard/history" },
];

const INPUT = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900";
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

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
  return { label: "Live", cls: "bg-emerald-100 text-emerald-700" };
}

function Skeletons() {
  return (
    <div className="space-y-3 p-4" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="animate-pulse rounded-xl border border-slate-100 p-4">
          <div className="h-24 w-full max-w-xs rounded-xl bg-slate-200" />
          <div className="mt-3 h-3 w-1/3 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export default function BannersPage() {
  const { getIdToken } = useAdminAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [seeding, setSeeding] = useState(false);

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
      const d = await api("/api/admin/banners");
      setRows(d.banners);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load banners");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  function openNew() {
    setNotice("");
    setError("");
    setForm({ ...EMPTY_FORM });
  }

  function openEdit(r: Row) {
    setNotice("");
    setError("");
    setForm({
      id: r._id,
      title: r.title,
      subtitle: r.subtitle,
      buttonText: r.buttonText,
      link: r.link,
      art: r.art,
      emoji: r.emoji,
      theme: r.theme,
      enabled: r.enabled,
      startsAt: toLocalInput(r.startsAt),
      endsAt: toLocalInput(r.endsAt),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        title: form.title,
        subtitle: form.subtitle,
        buttonText: form.buttonText,
        link: form.link,
        art: form.art,
        emoji: form.emoji,
        theme: form.theme,
        enabled: form.enabled,
        startsAt: toIso(form.startsAt),
        endsAt: toIso(form.endsAt),
      };
      if (form.id) await api(`/api/admin/banners/${form.id}`, "PATCH", payload);
      else await api("/api/admin/banners", "POST", payload);
      setNotice(form.id ? "Banner saved." : "Banner added.");
      setForm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadArt(file: File) {
    if (file.size > MAX_IMAGE_BYTES) {
      setError("That image is too big. Keep it under 3 MB.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const sig = await api("/api/admin/banners/actions", "POST", { action: "signature" });
      const fd = new FormData();
      fd.append("file", file);
      fd.append("api_key", sig.apiKey);
      fd.append("timestamp", String(sig.timestamp));
      fd.append("signature", sig.signature);
      fd.append("folder", sig.folder);
      const up = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
        method: "POST",
        body: fd,
      });
      const ud = await up.json().catch(() => ({}));
      if (!up.ok || !ud.secure_url) throw new Error(ud?.error?.message || "Upload failed");
      set("art", ud.secure_url as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function toggle(r: Row) {
    setBusyId(r._id);
    setError("");
    setNotice("");
    try {
      await api(`/api/admin/banners/${r._id}`, "PATCH", { enabled: !r.enabled });
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
    setNotice("");
    try {
      await api("/api/admin/banners/actions", "POST", { action: "reorder", ids });
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
      await api(`/api/admin/banners/${r._id}`, "DELETE");
      setNotice("Banner deleted.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete that.");
    } finally {
      setBusyId(null);
    }
  }

  async function seed() {
    setSeeding(true);
    setError("");
    setNotice("");
    try {
      await api("/api/admin/banners/actions", "POST", { action: "seed" });
      setNotice("Starter banners added.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add them.");
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Banners</h1>
          <p className="mt-1 text-sm text-slate-500">
            The swiping banners at the top of the client app Home. They show in the order below.
          </p>
        </div>
        {!form && (
          <button
            type="button"
            onClick={openNew}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus size={16} /> Add banner
          </button>
        )}
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">{notice}</p>}

      {form && (
        <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-bold text-slate-900">{form.id ? "Edit banner" : "New banner"}</h2>

          <div className="mt-3 max-w-sm">
            <p className="mb-1 text-xs font-semibold text-slate-500">Live preview</p>
            <BannerSlideView banner={form} />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-600">
              Title (max 60)
              <input className={`${INPUT} mt-1`} maxLength={60} value={form.title} onChange={(e) => set("title", e.target.value)} />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Button text (max 24, leave empty for no button)
              <input className={`${INPUT} mt-1`} maxLength={24} value={form.buttonText} onChange={(e) => set("buttonText", e.target.value)} />
            </label>
            <label className="block text-xs font-semibold text-slate-600 sm:col-span-2">
              Subtitle (max 120)
              <input className={`${INPUT} mt-1`} maxLength={120} value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
            </label>

            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-slate-600">Where it goes when tapped</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <select
                  className={`${INPUT} max-w-[200px]`}
                  value=""
                  onChange={(e) => e.target.value && set("link", e.target.value)}
                >
                  <option value="">Pick an app page...</option>
                  {QUICK_LINKS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <input
                  className={`${INPUT} min-w-[220px] flex-1`}
                  maxLength={300}
                  value={form.link}
                  onChange={(e) => set("link", e.target.value)}
                  placeholder="/dashboard/hub or https://..."
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                In-app pages start with /. Other websites must start with https://
              </p>
            </div>

            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-slate-600">Art on the right (transparent PNG or WebP, under 3 MB)</p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                  <Upload size={15} />
                  {uploading ? "Uploading..." : form.art ? "Replace image" : "Upload image"}
                  <input
                    type="file"
                    accept="image/png,image/webp"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadArt(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {form.art && (
                  <button type="button" onClick={() => set("art", "")} className="text-sm font-semibold text-red-600">
                    Remove image
                  </button>
                )}
                <label className="text-xs font-semibold text-slate-600">
                  Emoji instead (used when there is no image)
                  <input
                    className={`${INPUT} mt-1 w-24`}
                    maxLength={8}
                    value={form.emoji}
                    onChange={(e) => set("emoji", e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-slate-600">Colour</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {BANNER_THEMES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("theme", t)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                      form.theme === t ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {BANNER_THEME_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            <label className="block text-xs font-semibold text-slate-600">
              Show from (optional)
              <input type="datetime-local" className={`${INPUT} mt-1`} value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Show until (optional)
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
              disabled={saving || uploading || !form.title.trim()}
              onClick={() => void save()}
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save banner"}
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
          <Skeletons />
        ) : rows.length === 0 ? (
          <div className="p-6">
            <p className="text-sm text-slate-500">
              No banners yet. The client app shows its plain default promo until you add some.
            </p>
            <button
              type="button"
              disabled={seeding}
              onClick={() => void seed()}
              className="mt-3 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50"
            >
              {seeding ? "Adding..." : "Add the 5 starter banners"}
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
                    <BannerSlideView banner={r} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">{r.title}</p>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="mt-1 break-all text-xs text-slate-500">Goes to: {r.link}</p>
                    {(r.startsAt || r.endsAt) && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        {r.startsAt ? `From ${new Date(r.startsAt).toLocaleString()}` : ""}
                        {r.startsAt && r.endsAt ? " \u00B7 " : ""}
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
                      aria-label="Delete banner"
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