"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ROLE_LABELS, type Permission } from "@/lib/permissions";

type Overview = {
  technicians?: { pending: number; approved: number };
  riders?: { pending: number; approved: number; online: number };
};

function StatCard({ label, value, hint, href }: { label: string; value: number | string; hint?: string; href?: string }) {
  const body = (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:shadow">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

const ACTIONS: { label: string; href: string; permission: Permission }[] = [
  { label: "Review technician applications", href: "/technicians", permission: "technicians.review" },
  { label: "Review rider applications", href: "/riders", permission: "riders.review" },
  { label: "Handle client requests", href: "/requests", permission: "requests.manage" },
  { label: "Manage staff", href: "/staff", permission: "staff.manage" },
  { label: "View the audit log", href: "/audit", permission: "audit.view" },
];

export default function DashboardPage() {
  const { admin, can, getIdToken } = useAdminAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getIdToken();
        if (!token) return;
        const res = await fetch("/api/admin/overview", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Couldn't load the overview.");
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load the overview.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getIdToken]);

  const actions = ACTIONS.filter((a) => can(a.permission));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {admin?.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          You&apos;re signed in as <span className="font-semibold text-slate-700">{admin ? ROLE_LABELS[admin.role] : ""}</span>.
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {data && (data.technicians || data.riders) && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {data.technicians && (
            <>
              <StatCard
                label="Technician applications"
                value={data.technicians.pending}
                hint="waiting for review"
                href="/technicians"
              />
              <StatCard label="Approved technicians" value={data.technicians.approved} />
            </>
          )}
          {data.riders && (
            <>
              <StatCard label="Rider applications" value={data.riders.pending} hint="waiting for review" href="/riders" />
              <StatCard label="Riders online" value={data.riders.online} hint={`${data.riders.approved} approved in total`} href="/riders" />
            </>
          )}
        </div>
      )}

      {actions.length > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-slate-900">Quick actions</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {actions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="rounded-lg border border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}