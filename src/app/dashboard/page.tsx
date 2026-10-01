"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ROLE_LABELS, type AdminRole, type Permission } from "@/lib/permissions";
import { naira, dateTime } from "@/lib/format";
import { statusLabel, statusStyle } from "@/lib/orderStatus";

type RecentOrder = { _id: string; orderNumber: string; vendorName: string; status: string; totalKobo: number; createdAt: string };

type Overview = {
  technicians?: { pending: number; approved: number };
  requests?: { waiting: number; unreviewed: number };
  riders?: { pending: number; approved: number; online: number; suspended: number };
  riderMoney?: { debtKobo: number; walletKobo: number; overAlert: number; debtSuspended: number };
  vendors?: { pending: number; approved: number; tierRequests: number };
  orders?: {
    live: number;
    today: number;
    deliveredToday: number;
    cancelledToday: number;
    revenueTodayKobo?: number;
    recent: RecentOrder[];
  };
  payouts?: { pending: number; processing: number; failed: number; pendingKobo: number };
  customers?: { total: number; newThisWeek: number };
};

type Card = { label: string; value: number | string; hint?: string; href?: string; alert?: boolean };
type SectionKey = "orders" | "approvals" | "requests" | "riders" | "riderMoney" | "payouts" | "customers";
type Section = { title: string; cards: Card[] };

// What each role sees first. A section only appears if the role's data includes it.
const ORDER: Record<AdminRole, SectionKey[]> = {
  super_admin: ["orders", "approvals", "requests", "riders", "riderMoney", "payouts", "customers"],
  operations: ["orders", "requests", "riders", "customers"],
  onboarding: ["approvals", "riders"],
  rider_management: ["riders", "approvals", "riderMoney"],
  finance: ["orders", "payouts", "riderMoney", "customers"],
  support: ["orders", "customers"],
};

function buildSections(d: Overview): Partial<Record<SectionKey, Section>> {
  const s: Partial<Record<SectionKey, Section>> = {};

  if (d.orders) {
    const cards: Card[] = [
      { label: "Live orders", value: d.orders.live, hint: "paid, not yet delivered", href: "/orders" },
      { label: "Orders today", value: d.orders.today },
      { label: "Delivered today", value: d.orders.deliveredToday },
      { label: "Cancelled today", value: d.orders.cancelledToday },
    ];
    if (d.orders.revenueTodayKobo !== undefined) {
      cards.push({ label: "Order value today", value: naira(d.orders.revenueTodayKobo), hint: "paid, not cancelled" });
    }
    s.orders = { title: "Orders", cards };
  }

  const approvals: Card[] = [];
  if (d.vendors) {
    approvals.push({ label: "Vendor applications", value: d.vendors.pending, hint: "waiting for review" });
    approvals.push({ label: "Tier requests", value: d.vendors.tierRequests, hint: "vendors asking to change tier" });
  }
  if (d.riders) approvals.push({ label: "Rider applications", value: d.riders.pending, hint: "waiting for review", href: "/riders" });
  if (d.technicians) {
    approvals.push({ label: "Technician applications", value: d.technicians.pending, hint: "waiting for review", href: "/technicians" });
  }
  if (approvals.length) s.approvals = { title: "Approvals", cards: approvals };

  if (d.requests) {
    s.requests = {
      title: "Client requests",
      cards: [
        { label: "Waiting for dispatch", value: d.requests.waiting, href: "/requests" },
        { label: "Not yet reviewed", value: d.requests.unreviewed, href: "/requests", alert: d.requests.unreviewed > 0 },
      ],
    };
  }

  if (d.riders) {
    s.riders = {
      title: "Riders",
      cards: [
        { label: "Riders online", value: d.riders.online, hint: `${d.riders.approved} approved in total`, href: "/riders" },
        { label: "Suspended riders", value: d.riders.suspended, href: "/riders" },
      ],
    };
  }

  if (d.riderMoney) {
    s.riderMoney = {
      title: "Rider money",
      cards: [
        { label: "Total rider debt", value: naira(d.riderMoney.debtKobo), hint: "owed to Crafteey from cash rides" },
        { label: "Riders over ₦5,000 debt", value: d.riderMoney.overAlert, alert: d.riderMoney.overAlert > 0 },
        { label: "Blocked for debt", value: d.riderMoney.debtSuspended, hint: "cannot go online" },
        { label: "Rider wallet balances", value: naira(d.riderMoney.walletKobo), hint: "Hub earnings not yet withdrawn" },
      ],
    };
  }

  if (d.payouts) {
    s.payouts = {
      title: "Rider payouts",
      cards: [
        { label: "Pending or processing", value: d.payouts.pending + d.payouts.processing, hint: naira(d.payouts.pendingKobo) },
        { label: "Failed payouts", value: d.payouts.failed, alert: d.payouts.failed > 0 },
      ],
    };
  }

  if (d.customers) {
    s.customers = {
      title: "Customers",
      cards: [
        { label: "Customers", value: d.customers.total },
        { label: "New this week", value: d.customers.newThisWeek },
      ],
    };
  }

  return s;
}

function StatCard({ label, value, hint, href, alert }: Card) {
  const body = (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow ${
        alert ? "border-amber-300" : "border-slate-100"
      }`}
    >
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

const ACTIONS: { label: string; href: string; permission: Permission }[] = [
  { label: "View orders", href: "/orders", permission: "orders.view" },
  { label: "Handle client requests", href: "/requests", permission: "requests.manage" },
  { label: "Review technician applications", href: "/technicians", permission: "technicians.review" },
  { label: "Review rider applications", href: "/riders", permission: "riders.review" },
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

  const sections = data ? buildSections(data) : {};
  const keys = admin ? ORDER[admin.role].filter((k) => sections[k]) : [];
  const actions = ACTIONS.filter((a) => can(a.permission));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {admin?.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          You&apos;re signed in as{" "}
          <span className="font-semibold text-slate-700">{admin ? ROLE_LABELS[admin.role] : ""}</span>.
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!data && !error && <p className="text-sm text-slate-400">Loading…</p>}

      {keys.map((key) => {
        const section = sections[key]!;
        return (
          <section key={key}>
            <h2 className="mb-3 text-sm font-bold text-slate-900">{section.title}</h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {section.cards.map((c) => (
                <StatCard key={c.label} {...c} />
              ))}
            </div>

            {key === "orders" && data?.orders && data.orders.recent.length > 0 && (
              <div className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white shadow-sm">
                {data.orders.recent.map((o) => (
                  <Link
                    key={o._id}
                    href={`/orders/${o._id}`}
                    className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {o.orderNumber} <span className="font-normal text-slate-500">· {o.vendorName}</span>
                      </p>
                      <p className="text-xs text-slate-400">{dateTime(o.createdAt)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-semibold text-slate-700">{naira(o.totalKobo)}</span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${statusStyle(o.status)}`}
                      >
                        {statusLabel(o.status)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        );
      })}

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