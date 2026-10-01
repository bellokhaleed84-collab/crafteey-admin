"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, type AdminRole } from "@/lib/permissions";

type Status = "invited" | "active" | "deactivated";

type StaffRow = {
  _id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: Status;
  lastLoginAt: string | null;
  createdAt: string;
  isYou: boolean;
  isProtected: boolean;
};

const STATUS_STYLE: Record<Status, string> = {
  invited: "bg-amber-50 text-amber-700",
  active: "bg-emerald-50 text-emerald-700",
  deactivated: "bg-slate-100 text-slate-500",
};
const STATUS_LABEL: Record<Status, string> = {
  invited: "Waiting to sign up",
  active: "Active",
  deactivated: "Deactivated",
};

function when(iso: string | null) {
  if (!iso) return "Never";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Lagos",
  }).format(new Date(iso));
}

export default function StaffPage() {
  const { getIdToken } = useAdminAuth();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("support");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [justInvited, setJustInvited] = useState<{ email: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const call = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = await getIdToken();
      if (!token) throw new Error("You need to be signed in.");
      const res = await fetch(path, {
        ...init,
        cache: "no-store",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers || {}) },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Request failed.");
      return data;
    },
    [getIdToken]
  );

  const load = useCallback(async () => {
    try {
      const data = await call("/api/admin/staff");
      setStaff(data.staff ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load staff.");
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => {
    load();
  }, [load]);

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);
    try {
      await call("/api/admin/staff", {
        method: "POST",
        body: JSON.stringify({ name, email, role }),
      });
      setJustInvited({ email: email.trim().toLowerCase(), link: `${window.location.origin}/staff-signup` });
      setCopied(false);
      setName("");
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add this person.");
    } finally {
      setAdding(false);
    }
  }

  async function patch(row: StaffRow, body: { role?: AdminRole; status?: "active" | "deactivated" }) {
    setError(null);
    setBusyId(row._id);
    try {
      await call(`/api/admin/staff/${row._id}`, { method: "PATCH", body: JSON.stringify(body) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update this person.");
    } finally {
      setBusyId(null);
    }
  }

  function changeRole(row: StaffRow, next: AdminRole) {
    if (next === row.role) return;
    if (next === "super_admin" && !confirm("Super Admins can do everything, including managing staff. Continue?")) return;
    void patch(row, { role: next });
  }

  function deactivate(row: StaffRow) {
    if (!confirm(`Remove ${row.name}'s access? They will be signed out of the admin on their next action.`)) return;
    void patch(row, { status: "deactivated" });
  }

  async function removeInvite(row: StaffRow) {
    if (!confirm(`Remove the invite for ${row.email}?`)) return;
    setError(null);
    setBusyId(row._id);
    try {
      await call(`/api/admin/staff/${row._id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove this invite.");
    } finally {
      setBusyId(null);
    }
  }

  async function copyLink() {
    if (!justInvited) return;
    try {
      await navigator.clipboard.writeText(justInvited.link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Staff Management</h1>
        <p className="mt-1 text-sm text-slate-500">Add people and choose what each role can see and do.</p>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <form onSubmit={addStaff} className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">Add staff</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            required
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            required
            type="email"
            autoCapitalize="none"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AdminRole)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-slate-400">{ROLE_DESCRIPTIONS[role]}</p>
        <button
          type="submit"
          disabled={adding}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {adding ? "Adding…" : "Add staff member"}
        </button>

        {justInvited && (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            <p>
              <b>{justInvited.email}</b> was added. Ask them to create their account with that exact email here, then
              verify it:
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="break-all rounded bg-white px-2 py-1 text-xs">{justInvited.link}</code>
              <button type="button" onClick={copyLink} className="rounded-lg border border-emerald-300 px-2.5 py-1 text-xs font-semibold">
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          </div>
        )}
      </form>

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : staff.length === 0 ? (
          <p className="text-sm text-slate-400">No staff yet.</p>
        ) : (
          staff.map((s) => {
            const locked = s.isYou || s.isProtected;
            const busy = busyId === s._id;
            return (
              <div key={s._id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">
                      {s.name}
                      {s.isYou && <span className="ml-2 text-xs font-semibold text-slate-400">(you)</span>}
                    </p>
                    <p className="break-all text-sm text-slate-500">{s.email}</p>
                    <p className="mt-1 text-xs text-slate-400">Last sign-in: {when(s.lastLoginAt)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[s.status]}`}>
                    {STATUS_LABEL[s.status]}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <select
                    value={s.role}
                    disabled={locked || busy}
                    onChange={(e) => changeRole(s, e.target.value as AdminRole)}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>

                  {s.isProtected && <span className="text-xs text-slate-400">Set in server settings</span>}

                  {!locked && s.status !== "deactivated" && s.status !== "invited" && (
                    <button
                      onClick={() => deactivate(s)}
                      disabled={busy}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-50"
                    >
                      Deactivate
                    </button>
                  )}
                  {!locked && s.status === "deactivated" && (
                    <button
                      onClick={() => patch(s, { status: "active" })}
                      disabled={busy}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                    >
                      Reactivate
                    </button>
                  )}
                  {!locked && s.status === "invited" && (
                    <button
                      onClick={() => removeInvite(s)}
                      disabled={busy}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                    >
                      Remove invite
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-slate-900">What each role can do</h2>
        <ul className="space-y-2 text-sm">
          {ROLES.map((r) => (
            <li key={r}>
              <span className="font-semibold text-slate-800">{ROLE_LABELS[r]}:</span>{" "}
              <span className="text-slate-500">{ROLE_DESCRIPTIONS[r]}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}