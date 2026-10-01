"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { HUB_CATEGORIES, HUB_CATEGORY_LABELS, TIER_LABELS, type HubCategory } from "@/lib/hubCategories";

type VendorRow = {
  _id: string;
  businessName: string;
  category: string;
  email: string;
  phone: string;
  tier?: string;
  tierRequest?: { requestedTier?: string; status?: string };
  status?: string;
  isApproved?: boolean;
};

type VendorDetail = VendorRow & {
  uid: string;
  address: string;
  description?: string;
  tagline?: string;
  verificationDocUrl?: string;
  bankDetails?: { accountName?: string; accountNumber?: string; bankName?: string };
};

type HubInfo = { categories?: string[]; lat?: number; lng?: number; isActive?: boolean; tier?: string } | null;

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "suspended", label: "Suspended" },
  { key: "tier_requests", label: "Tier requests" },
];

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  suspended: "bg-orange-50 text-orange-700",
  pending: "bg-amber-50 text-amber-700",
};

// Suggest a Hub category from the vendor's free-text category. The admin can change it.
function suggestCategories(text: string): HubCategory[] {
  const t = (text || "").toLowerCase();
  if (/groc|supermarket|mart|provision|pharm/.test(t)) return ["groceries"];
  if (/drink|bar|wine|beverage|juice|liquor/.test(t)) return ["drinks"];
  if (/restaurant|food|kitchen|cafe|bakery|eatery|grill|fast/.test(t)) return ["food"];
  return [];
}

function parseCoords(s: string): { lat: number; lng: number } | null {
  const m = s.trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
}

function StatusBadge({ status }: { status?: string }) {
  const s = status && STATUS_STYLE[status] ? status : "pending";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ${STATUS_STYLE[s]}`}>{s}</span>
  );
}

export default function VendorsPage() {
  const { getIdToken, can } = useAdminAuth();
  const [tab, setTab] = useState("pending");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const token = await getIdToken();
      const res = await fetch(path, {
        ...init,
        headers: {
          ...(init?.headers || {}),
          Authorization: `Bearer ${token}`,
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
        },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Something went wrong");
      return data;
    },
    [getIdToken]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api(`/api/admin/vendors?tab=${tab}&page=${page}&q=${encodeURIComponent(search)}`);
      setRows(data.vendors);
      setCounts(data.counts || {});
      setPages(data.pages || 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load vendors");
    } finally {
      setLoading(false);
    }
  }, [api, tab, page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Vendors</h1>
      <p className="mt-1 text-sm text-slate-500">Approve stores, manage status and review tier changes.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setPage(1);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              tab === t.key ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"
            }`}
          >
            {t.label}
            {typeof counts[t.key] === "number" && <span className="ml-1.5 opacity-70">{counts[t.key]}</span>}
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setPage(1);
              setSearch(q);
            }
          }}
          placeholder="Search name, email or phone"
          className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            setPage(1);
            setSearch(q);
          }}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Search
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No vendors here.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((v) => (
              <li key={v._id}>
                <button
                  type="button"
                  onClick={() => setOpenId(v._id)}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{v.businessName}</p>
                    <p className="truncate text-xs text-slate-500">
                      {v.category} · {v.email}
                    </p>
                  </div>
                  <span className="text-xs font-semibold capitalize text-slate-500">{v.tier || "no tier"}</span>
                  {v.tierRequest?.status === "pending" && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                      Wants {v.tierRequest.requestedTier}
                    </span>
                  )}
                  {v.status === "approved" && !v.isApproved && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">
                      Out of sync
                    </span>
                  )}
                  <StatusBadge status={v.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-slate-500">
            Page {page} of {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {openId && (
        <VendorPanel
          id={openId}
          api={api}
          canReview={can("vendors.review")}
          onClose={() => setOpenId(null)}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}

function VendorPanel({
  id,
  api,
  canReview,
  onClose,
  onChanged,
}: {
  id: string;
  api: (path: string, init?: RequestInit) => Promise<any>;
  canReview: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [hub, setHub] = useState<HubInfo>(null);
  const [cats, setCats] = useState<HubCategory[]>([]);
  const [coords, setCoords] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const fetchDetail = useCallback(async () => {
    try {
      const d = await api(`/api/admin/vendors/${id}`);
      setVendor(d.vendor);
      setHub(d.hubVendor);
      const existing = (d.hubVendor?.categories || []).filter((c: string) =>
        (HUB_CATEGORIES as readonly string[]).includes(c)
      ) as HubCategory[];
      setCats(existing.length ? existing : suggestCategories(d.vendor.category));
      if (typeof d.hubVendor?.lat === "number" && typeof d.hubVendor?.lng === "number") {
        setCoords(`${d.hubVendor.lat}, ${d.hubVendor.lng}`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load vendor");
    }
  }, [api, id]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  async function run(path: string, body: unknown, okMsg: string) {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      await api(path, { method: "PATCH", body: JSON.stringify(body) });
      setMsg(okMsg);
      await fetchDetail();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  function approve() {
    const parsed = parseCoords(coords);
    if (cats.length === 0) return setErr("Pick at least one Hub category.");
    if (!parsed) return setErr("Enter coordinates like 6.5244, 3.3792 (latitude, longitude).");
    void run(`/api/admin/vendors/${id}`, { action: "approve", categories: cats, lat: parsed.lat, lng: parsed.lng }, "Vendor approved and live in the Hub.");
  }

  function confirmAction(action: "reject" | "suspend") {
    const word = action === "reject" ? "reject" : "suspend";
    if (window.confirm(`Are you sure you want to ${word} this vendor? Their Hub store will be hidden.`)) {
      void run(`/api/admin/vendors/${id}`, { action }, action === "reject" ? "Vendor rejected." : "Vendor suspended.");
    }
  }

  const mapsUrl = vendor ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vendor.address || "")}` : "#";
  const status = vendor?.status && STATUS_STYLE[vendor.status] ? vendor.status : "pending";
  const approveLabel = status === "approved" ? "Save & re-sync" : status === "pending" ? "Approve" : "Approve / reinstate";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 text-sm font-semibold text-slate-500">
          Close
        </button>

        {!vendor ? (
          <p className="text-sm text-slate-500">{err || "Loading…"}</p>
        ) : (
          <div className="space-y-5">
            <div>
              <h2 className="pr-12 text-xl font-bold text-slate-900">{vendor.businessName}</h2>
              <div className="mt-1 flex items-center gap-2">
                <StatusBadge status={vendor.status} />
                <span className="text-xs capitalize text-slate-500">Tier: {vendor.tier || "none"}</span>
              </div>
              {vendor.status === "approved" && !vendor.isApproved && (
                <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
                  Status says approved but the approval switch is off. Use &quot;Save &amp; re-sync&quot; below to fix it.
                </p>
              )}
            </div>

            <dl className="space-y-1 text-sm">
              <Row label="Category (vendor typed)" value={vendor.category} />
              <Row label="Email" value={vendor.email} />
              <Row label="Phone" value={vendor.phone} />
              <Row label="Address" value={vendor.address} />
              {vendor.tagline && <Row label="Tagline" value={vendor.tagline} />}
            </dl>

            {canReview && (
              <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
                <p className="text-xs font-bold uppercase text-slate-400">Verification and bank</p>
                {vendor.verificationDocUrl ? (
                  <a href={vendor.verificationDocUrl} target="_blank" rel="noreferrer" className="font-semibold text-blue-600 underline">
                    Open verification document
                  </a>
                ) : (
                  <p className="text-slate-500">No document uploaded.</p>
                )}
                {vendor.bankDetails?.accountNumber ? (
                  <p className="text-slate-700">
                    {vendor.bankDetails.bankName} · {vendor.bankDetails.accountNumber} · {vendor.bankDetails.accountName}
                  </p>
                ) : (
                  <p className="text-slate-500">No bank details yet.</p>
                )}
              </div>
            )}

            {vendor.tierRequest?.status === "pending" && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm">
                <p className="font-semibold text-blue-900">
                  Tier change requested: {vendor.tier || "none"} to {vendor.tierRequest.requestedTier}
                  {vendor.tierRequest.requestedTier && TIER_LABELS[vendor.tierRequest.requestedTier as keyof typeof TIER_LABELS]
                    ? ` (${TIER_LABELS[vendor.tierRequest.requestedTier as keyof typeof TIER_LABELS]})`
                    : ""}
                </p>
                {canReview && (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(`/api/admin/vendors/${id}/tier`, { decision: "approve" }, "Tier change approved.")}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                    >
                      Approve tier change
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(`/api/admin/vendors/${id}/tier`, { decision: "reject" }, "Tier change rejected.")}
                      className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            )}

            {hub && (
              <p className="text-xs text-slate-500">
                Hub store: {hub.isActive ? "live" : "hidden"} · {(hub.categories || []).join(", ") || "no categories"}
              </p>
            )}

            {canReview && (
              <div className="space-y-4 rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-bold text-slate-900">Hub listing</p>

                <div>
                  <p className="mb-1.5 text-xs font-semibold text-slate-600">Hub categories</p>
                  <div className="flex flex-wrap gap-2">
                    {HUB_CATEGORIES.map((c) => {
                      const on = cats.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCats((prev) => (on ? prev.filter((x) => x !== c) : [...prev, c]))}
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            on ? "bg-amber-400 text-slate-900" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {HUB_CATEGORY_LABELS[c]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-semibold text-slate-600">Location (latitude, longitude)</p>
                  <input
                    value={coords}
                    onChange={(e) => setCoords(e.target.value)}
                    placeholder="6.5244, 3.3792"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    <a href={mapsUrl} target="_blank" rel="noreferrer" className="font-semibold text-blue-600 underline">
                      Find this address on Google Maps
                    </a>
                    , right-click the exact spot, and click the numbers at the top of the menu to copy them.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={approve}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {approveLabel}
                  </button>
                  {status !== "rejected" && status !== "suspended" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => confirmAction(status === "approved" ? "suspend" : "reject")}
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-600 disabled:opacity-50"
                    >
                      {status === "approved" ? "Suspend" : "Reject"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {msg && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}
            {err && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value || "-"}</dd>
    </div>
  );
}