"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Wrench,
  ClipboardList,
  Briefcase,
  Bike,
  ShoppingBag,
  Store,
  Building2,
  User as UserIcon,
  Wallet,
  Banknote,
  LifeBuoy,
  Star,
  Flag,
  ShieldAlert,
  AlertTriangle,
  FileText,
  Settings,
  Users,
  ScrollText,
  Megaphone,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ROLE_LABELS, type Permission } from "@/lib/permissions";
import VerifyEmailScreen from "@/components/VerifyEmailScreen";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
  ready: boolean; // false = page not built yet, shown greyed out with a "Soon" tag
};
type NavGroup = { label: string; items: NavItem[] };

// An item shows only for roles that have its permission.
const GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard.view", ready: true }],
  },
  {
    label: "Operations",
    items: [
      { label: "Orders", href: "/orders", icon: ShoppingBag, permission: "orders.view", ready: true },
      { label: "Client requests", href: "/requests", icon: ClipboardList, permission: "requests.view", ready: true },
      { label: "Technician jobs", href: "/jobs", icon: Briefcase, permission: "jobs.view", ready: true },
      { label: "Banners", href: "/banners", icon: Megaphone, permission: "banners.manage", ready: true },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Vendors", href: "/vendors", icon: Store, permission: "vendors.view", ready: true },
      { label: "Companies", href: "/companies", icon: Building2, permission: "companies.view", ready: true },
      { label: "Riders", href: "/riders", icon: Bike, permission: "riders.view", ready: true },
      { label: "Technicians", href: "/technicians", icon: Wrench, permission: "technicians.view", ready: true },
      { label: "Customers", href: "/customers", icon: UserIcon, permission: "customers.view", ready: true },
    ],
  },
  {
    label: "Money",
    items: [
      { label: "Wallet & Transactions", href: "/wallet", icon: Wallet, permission: "wallet.view", ready: true },
      { label: "Payouts", href: "/payouts", icon: Banknote, permission: "payouts.view", ready: true },
      { label: "Reports & Exports", href: "/reports", icon: FileText, permission: "reports.view", ready: true },
    ],
  },
  {
    label: "Support",
    items: [
      { label: "Safety alerts", href: "/safety-alerts", icon: AlertTriangle, permission: "riders.view", ready: true },
      { label: "Support & Complaints", href: "/support", icon: LifeBuoy, permission: "support.view", ready: true },
      { label: "Chat reports", href: "/chat-reports", icon: Flag, permission: "chat.moderate", ready: true },
      { label: "Blocked messages", href: "/blocked-messages", icon: ShieldAlert, permission: "chat.moderate", ready: true },
      { label: "Reviews", href: "/reviews", icon: Star, permission: "reviews.manage", ready: true },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Platform Settings", href: "/settings", icon: Settings, permission: "settings.manage", ready: true },
      { label: "Terms & Conditions", href: "/legal", icon: FileText, permission: "settings.manage", ready: true },
      { label: "Rider Home cards", href: "/home-cards", icon: Megaphone, permission: "settings.manage", ready: true },
      { label: "Rider Settings sections", href: "/rider-sections", icon: Bike, permission: "settings.manage", ready: true },
      { label: "Staff Management", href: "/staff", icon: Users, permission: "staff.manage", ready: true },
      { label: "Audit Log", href: "/audit", icon: ScrollText, permission: "audit.view", ready: true },
    ],
  },
];

const ALL_ITEMS = GROUPS.flatMap((g) => g.items);

// Pages that render outside the admin chrome entirely.
const PUBLIC_ROUTES = ["/login", "/staff-signup"];

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-sm text-slate-500">{children}</div>;
}

// Grey pulsing placeholder of the whole admin screen, shown while the app
// checks who is signed in.
function ShellSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50" aria-busy="true">
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-[#0B1530] p-5 md:block">
        <div className="h-6 w-32 animate-pulse rounded bg-white/10" />
        <div className="mt-8 space-y-3">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded-lg bg-white/10" />
          ))}
        </div>
      </aside>
      <div className="md:pl-64">
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 md:hidden">
          <div className="h-5 w-28 animate-pulse rounded bg-slate-200" />
          <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-200" />
        </div>
        <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
          <div className="h-7 w-48 animate-pulse rounded bg-slate-200" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="h-3 w-1/2 rounded bg-slate-200" />
                <div className="mt-4 h-8 w-1/3 rounded bg-slate-200" />
                <div className="mt-3 h-3 w-2/3 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, access, accessMessage, admin, can, signOut, getIdToken, refreshAccess } = useAdminAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [newRequestCount, setNewRequestCount] = useState<number | null>(null);
  const [openSosCount, setOpenSosCount] = useState<number | null>(null);

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Not signed in: go to the login page.
  useEffect(() => {
    if (!isPublicRoute && !loading && !user && typeof window !== "undefined") {
      window.location.replace("/login");
    }
  }, [isPublicRoute, loading, user]);

  // Badge for Client requests, only for people who can see that page.
  const canSeeRequests = can("requests.view");
  const fetchBadge = useCallback(async () => {
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch("/api/admin/requests?tab=new", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      if (typeof data?.counts?.new === "number") setNewRequestCount(data.counts.new);
    } catch {
      // A missed poll isn't worth surfacing.
    }
  }, [getIdToken]);

  useEffect(() => {
    if (isPublicRoute || access !== "ok" || !canSeeRequests) return;
    fetchBadge();
    const interval = setInterval(fetchBadge, 30000);
    return () => clearInterval(interval);
  }, [isPublicRoute, access, canSeeRequests, fetchBadge]);

  // Red badge for open SOS alerts, only for people who can see that page.
  const canSeeSafety = can("riders.view");
  const fetchSosBadge = useCallback(async () => {
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch("/api/admin/safety-alerts?status=open&page=1", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      if (typeof data?.openSos === "number") setOpenSosCount(data.openSos);
    } catch {
      // A missed poll isn't worth surfacing.
    }
  }, [getIdToken]);

  useEffect(() => {
    if (isPublicRoute || access !== "ok" || !canSeeSafety) return;
    fetchSosBadge();
    const interval = setInterval(fetchSosBadge, 30000);
    return () => clearInterval(interval);
  }, [isPublicRoute, access, canSeeSafety, fetchSosBadge]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (isPublicRoute) return <>{children}</>;

  if (loading) return <ShellSkeleton />;
  if (!user || access === "signed_out") return <FullScreenMessage>Redirecting to sign in...</FullScreenMessage>;
  if (access === "loading") return <ShellSkeleton />;
  if (access === "needs_verification") return <VerifyEmailScreen />;

  if (access === "no_access" || access === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            {access === "no_access" ? "No admin access" : "Something went wrong"}
          </h1>
          <p className="text-sm text-slate-500">{accessMessage}</p>
          {user.email && (
            <p className="text-sm text-slate-500">
              Signed in as <b className="break-all text-slate-700">{user.email}</b>
            </p>
          )}
          {access === "no_access" && (
            <p className="text-xs text-slate-400">Ask a Super Admin to add this exact email as staff.</p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void refreshAccess()}
              className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-700"
            >
              Check again
            </button>
            <button
              type="button"
              onClick={signOut}
              className="flex-1 rounded-lg bg-slate-900 py-2 text-sm font-semibold text-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Is the current page one this role may not open?
  const current = [...ALL_ITEMS].sort((a, b) => b.href.length - a.href.length).find((i) => isActive(i.href));
  const blocked = !!current && !can(current.permission);

  const visibleGroups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => can(i.permission)) })).filter(
    (g) => g.items.length > 0
  );

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <span className="text-lg font-bold text-white">Crafteey</span>
        <span className="ml-1.5 text-lg font-bold text-amber-400">Admin</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        {visibleGroups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-1.5 px-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isSafety = item.href === "/safety-alerts";
                const badge = item.href === "/requests" ? newRequestCount : isSafety ? openSosCount : null;
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    {item.ready ? (
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                          active ? "bg-amber-400 text-slate-900" : "text-slate-300 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <Icon size={17} className="shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {!!badge && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              isSafety
                                ? "bg-red-600 text-white"
                                : active
                                  ? "bg-slate-900 text-white"
                                  : "bg-amber-400 text-slate-900"
                            }`}
                          >
                            {badge}
                          </span>
                        )}
                      </Link>
                    ) : (
                      <span
                        aria-disabled="true"
                        className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600"
                      >
                        <Icon size={17} className="shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                          Soon
                        </span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="mb-2 px-2">
          <p className="truncate text-sm font-semibold text-white">{admin?.name}</p>
          <p className="text-xs text-amber-400">{admin ? ROLE_LABELS[admin.role] : ""}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-400 hover:bg-white/5"
        >
          <LogOut size={17} /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop: permanent fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-[#0B1530] md:block">{sidebarContent}</aside>

      {/* Mobile: top bar with menu button */}
      <header className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 md:hidden">
        <span className="text-base font-bold text-slate-900">Crafteey Admin</span>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <Menu size={22} />
        </button>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-[#0B1530] shadow-xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 text-slate-400"
            >
              <X size={20} />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="md:pl-64">
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          {blocked ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
              <h1 className="text-lg font-bold text-slate-900">You don&apos;t have access to this page</h1>
              <p className="mt-1 text-sm text-slate-500">Ask a Super Admin if you need it.</p>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}