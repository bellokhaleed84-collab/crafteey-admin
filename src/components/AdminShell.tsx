"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

type NavItem = {
  label: string;
  href: string;
  ready: boolean; // false = page not built yet, shown greyed out with a "Soon" tag
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

// Flip `ready` to true as each page gets built. Grouped so related
// sections read together instead of one long flat list.
const GROUPS: NavGroup[] = [
  {
    label: "Requests",
    items: [
      { label: "Applications", href: "/dashboard", ready: true },
      { label: "Client requests", href: "/requests", ready: true },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Technician jobs", href: "/jobs", ready: true },
      { label: "Riders", href: "/riders", ready: true },
    ],
  },
  {
    label: "Directory",
    items: [{ label: "Technicians", href: "/technicians", ready: false }],
  },
];

// Routes that render outside the admin chrome entirely — no sidebar, no
// mobile top bar, just the page itself.
const PUBLIC_ROUTES = ["/login"];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, getIdToken } = useAdminAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Live badge for Client requests — reuses the count this endpoint
  // already returns for its own tabs. There's no equivalent endpoint yet
  // for Applications, so that item has no badge for now rather than
  // guessing at a URL that might not exist.
  const [newRequestCount, setNewRequestCount] = useState<number | null>(null);

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

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
      // A missed poll isn't worth surfacing — the badge just keeps
      // whatever number it last had.
    }
  }, [getIdToken]);

  useEffect(() => {
    if (isPublicRoute) return;
    fetchBadge();
    const interval = setInterval(fetchBadge, 30000);
    return () => clearInterval(interval);
  }, [isPublicRoute, fetchBadge]);

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (isPublicRoute) {
    return <>{children}</>;
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  async function handleSignOut() {
    setMobileOpen(false);
    await signOut();
    router.push("/login");
  }

  function badgeFor(href: string): number | null {
    if (href === "/requests") return newRequestCount;
    return null;
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <span className="text-lg font-bold text-white">Crafteey Admin</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3">
        {GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-1.5 px-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const badge = badgeFor(item.href);
                return (
                  <li key={item.href}>
                    {item.ready ? (
                      <Link
                        href={item.href}
                        aria-current={isActive(item.href) ? "page" : undefined}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition ${
                          isActive(item.href)
                            ? "bg-white text-slate-900"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                        }`}
                      >
                        {item.label}
                        {!!badge && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              isActive(item.href) ? "bg-slate-900 text-white" : "bg-amber-400 text-slate-900"
                            }`}
                          >
                            {badge}
                          </span>
                        )}
                      </Link>
                    ) : (
                      <span
                        aria-disabled="true"
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 cursor-not-allowed"
                      >
                        {item.label}
                        <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
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
      <div className="border-t border-slate-800 p-3">
        <button
          type="button"
          onClick={handleSignOut}
          className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-400 hover:bg-slate-800"
        >
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop: permanent fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-slate-900 md:block">{sidebarContent}</aside>

      {/* Mobile: top bar with hamburger */}
      <header className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 md:hidden">
        <span className="text-base font-bold text-slate-900">Crafteey Admin</span>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* Mobile: slide-in drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-xl">{sidebarContent}</aside>
        </div>
      )}

      {/* Page content — offset for the desktop sidebar */}
      <div className="md:pl-64">
        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}