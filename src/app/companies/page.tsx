"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

type Tab = "pending" | "approved" | "rejected" | "suspended";
const TABS: Tab[] = ["pending", "approved", "rejected", "suspended"];

type Row = {
  _id: string;
  businessName: string;
  email: string;
  phone: string;
  trades: string[];
  areas: string[];
  status: string;
  verified?: boolean;
  agreement?: { signed?: boolean };
  createdAt: string;
};

type Detail = {
  _id: string;
  businessName: string;
  email: string;
  phone: string;
  trades: string[];
  areas: string[];
  description?: string;
  yearsOperating: number;
  technicianCount: number;
  priceRange: string;
  address: string;
  photos: string[];
  status: string;
  statusReason?: string;
  documents?: {
    businessRegistrationUrl?: string;
    idCardUrl?: string;
    certificationUrls?: string[];
    otherUrls?: string[];
  };
  agreement?: {
    signed?: boolean;
    version?: string;
    signedAt?: string;
    recordedByName?: string;
    notes?: string;
  };
};

const PRICE_LABELS: Record<string, string> = {
  low: "Affordable",
  mid: "Mid-range",
  high: "High-end",
};

const pretty = (s: string) => s.replace(/_/g, " ");

function RowSkeletons() {
  return (
    <div className="space-y-3" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="animate-pulse rounded-xl border border-slate-100 bg-white p-5">
          <div className="h-4 w-1/3 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-2/3 rounded bg-slate-100" />
          <div className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
          <div className="mt-3 h-3 w-1/4 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="mt-4 animate-pulse space-y-3 border-t border-slate-100 pt-4" aria-busy="true">
      <div className="h-3 w-3/4 rounded bg-slate-100" />
      <div className="h-3 w-2/3 rounded bg-slate-100" />
      <div className="flex gap-2">
        <div className="h-20 w-20 rounded-lg bg-slate-100" />
        <div className="h-20 w-20 rounded-lg bg-slate-100" />
      </div>
      <div className="h-24 w-full rounded-lg bg-slate-100" />
    </div>
  );
}

export default function CompaniesPage() {
  const { getIdToken } = useAdminAuth();
  const [tab, setTab] = useState<Tab>("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/companies?tab=${tab}&page=${page}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't load companies.");
      setRows(Array.isArray(data.companies) ? data.companies : []);
      setCounts(data.counts || {});
      setPages(data.pages || 1);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load companies.");
    } finally {
      setLoading(false);
    }
  }, [getIdToken, tab, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-slate-900">Companies</h1>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setPage(1);
              setOpenId(null);
            }}
            className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${
              tab === t ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"
            }`}
          >
            {t} {typeof counts[t] === "number" ? `(${counts[t]})` : ""}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <RowSkeletons />
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">No {tab} companies.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => (
            <div key={c._id} className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">
                    {c.businessName}
                    {c.verified && <span className="ml-2 text-xs font-semibold text-emerald-600">Verified</span>}
                  </p>
                  <p className="text-sm text-slate-500">
                    {c.email} · {c.phone}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {c.trades.map(pretty).join(", ")} · {c.areas.join(", ")}
                  </p>
                  <p
                    className={`mt-1 text-xs font-semibold ${
                      c.agreement?.signed ? "text-emerald-600" : "text-amber-600"
                    }`}
                  >
                    {c.agreement?.signed ? "Agreement signed" : "Agreement not yet signed"}
                  </p>
                </div>
                <button
                  onClick={() => setOpenId(openId === c._id ? null : c._id)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  {openId === c._id ? "Close" : "Review"}
                </button>
              </div>
              {openId === c._id && <ReviewPanel id={c._id} onChanged={load} />}
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-6 flex items-center gap-3">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-slate-500">
            Page {page} of {pages}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function ReviewPanel({ id, onChanged }: { id: string; onChanged: () => void }) {
  const { getIdToken } = useAdminAuth();
  const [company, setCompany] = useState<Detail | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [version, setVersion] = useState("v1");
  const [signedDate, setSignedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");

  const loadDetail = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/companies/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't load this company.");
      setCompany(data.company);
      setCanReview(!!data.canReview);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this company.");
    }
  }, [getIdToken, id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    const token = await getIdToken();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/companies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't save that.");
      setReason("");
      await loadDetail();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  if (!company) {
    return error ? (
      <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
    ) : (
      <PanelSkeleton />
    );
  }

  const signed = !!company.agreement?.signed;
  const docs = company.documents;
  const docLinks: { label: string; url: string }[] = [];
  if (docs?.businessRegistrationUrl) docLinks.push({ label: "Business registration", url: docs.businessRegistrationUrl });
  if (docs?.idCardUrl) docLinks.push({ label: "ID card", url: docs.idCardUrl });
  (docs?.certificationUrls || []).forEach((u, i) => docLinks.push({ label: `Certification ${i + 1}`, url: u }));
  (docs?.otherUrls || []).forEach((u, i) => docLinks.push({ label: `Other document ${i + 1}`, url: u }));

  return (
    <div className="mt-4 space-y-4 border-t border-slate-100 pt-4 text-sm text-slate-700">
      {error && <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}

      <div className="space-y-1">
        <p>
          <span className="font-semibold">Address:</span> {company.address}
        </p>
        <p>
          <span className="font-semibold">Operating:</span> {company.yearsOperating} years ·{" "}
          {company.technicianCount} technicians · {PRICE_LABELS[company.priceRange] || company.priceRange}
        </p>
        {company.description && (
          <p>
            <span className="font-semibold">About:</span> {company.description}
          </p>
        )}
        {company.statusReason && (
          <p className="text-red-600">
            <span className="font-semibold">Reason:</span> {company.statusReason}
          </p>
        )}
      </div>

      {company.photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {company.photos.map((p) => (
            <a key={p} href={p} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt="Company photo" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
            </a>
          ))}
        </div>
      )}

      {canReview && docLinks.length > 0 && (
        <div>
          <p className="mb-1 font-semibold">Documents</p>
          <ul className="space-y-1">
            {docLinks.map((d) => (
              <li key={d.url}>
                <a href={d.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                  {d.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canReview && (
        <div className="rounded-lg bg-slate-50 p-4">
          <p className="mb-2 font-semibold">Office onboarding agreement</p>
          {signed && (
            <p className="mb-3 text-emerald-700">
              Signed: version {company.agreement?.version}
              {company.agreement?.signedAt
                ? ` on ${new Date(company.agreement.signedAt).toLocaleDateString()}`
                : ""}
              {company.agreement?.recordedByName ? ` (recorded by ${company.agreement.recordedByName})` : ""}
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-medium text-slate-600">
              Agreement version
              <input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="mt-1 block w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Date signed
              <input
                type="date"
                value={signedDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setSignedDate(e.target.value)}
                className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex-1 text-xs font-medium text-slate-600">
              Notes (optional)
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={300}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              disabled={busy}
              onClick={() =>
                act("record_agreement", {
                  version,
                  signedAt: signedDate ? new Date(signedDate).toISOString() : undefined,
                  notes,
                })
              }
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {signed ? "Update agreement record" : "Save agreement record"}
            </button>
          </div>
        </div>
      )}

      {canReview && (
        <div className="space-y-3">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="Reason (needed to reject or suspend)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            {company.status !== "approved" && (
              <button
                disabled={busy || !signed}
                onClick={() => act("approve")}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                {company.status === "pending" ? "Approve" : "Reinstate"}
              </button>
            )}
            {company.status === "pending" && (
              <button
                disabled={busy}
                onClick={() => act("reject", { reason })}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
              >
                Reject
              </button>
            )}
            {company.status === "approved" && (
              <button
                disabled={busy}
                onClick={() => act("suspend", { reason })}
                className="rounded-lg border border-red-300 px-4 py-2 text-xs font-semibold text-red-600 disabled:opacity-50"
              >
                Suspend
              </button>
            )}
          </div>
          {!signed && company.status !== "approved" && (
            <p className="text-xs text-amber-600">Save the agreement record first. Approve stays off until then.</p>
          )}
        </div>
      )}
    </div>
  );
}