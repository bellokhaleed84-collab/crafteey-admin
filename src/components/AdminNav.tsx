"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

type NavItem = {
  label: string;
  href: string;
  ready: boolean; // false = page not built yet, shown greyed out with a "Soon" tag
};

// Sideways tabs across the top. Flip `ready` to true as each page gets built.
const TABS: NavItem[] = [
  { label: "Applications", href: "/dashboard", ready: true },
  { label: "Client requests", href: "/requests", ready: true },
  { label: "Technician jobs", href: "/jobs", ready: true },
  { label: "Riders", href: "/riders", ready: true },
];

// Lives behind the three-dot menu.
const MORE: NavItem[] = [
  { label: "Technicians", href: "/technicians", ready: false },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAdminAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the three-dot menu on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    router.push("/login");
  }

  return (
    <header className="bg-white border-b border-slate-100">
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
        <span className="font-bold text-lg text-slate-900 shrink-0">Crafteey Admin</span>

        {/* Tabs scroll sideways on small phones. The three-dot button sits outside this
            scroller so its dropdown is never clipped. */}
        <nav aria-label="Admin sections" className="flex-1 min-w-0 overflow-x-auto [scrollbar-width:none]">
          <ul className="flex items-center gap-1 text-sm font-semibold whitespace-nowrap">
            {TABS.map((item) => (
              <li key={item.href}>
                {item.ready ? (
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={`inline-block rounded-lg px-3 py-2 ${
                      isActive(item.href)
                        ? "bg-slate-900 text-white"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-slate-300 cursor-not-allowed"
                  >
                    {item.label}
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                      Soon
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="More"
            aria-haspopup="menu"
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>

          {open && (
            <div
              role="menu"
              className="absolute right-0 top-full z-20 mt-2 w-48 rounded-xl border border-slate-100 bg-white p-1 shadow-lg"
            >
              {MORE.map((item) =>
                item.ready ? (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <div
                    key={item.href}
                    role="menuitem"
                    aria-disabled="true"
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-300 cursor-not-allowed"
                  >
                    {item.label}
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                      Soon
                    </span>
                  </div>
                )
              )}
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
