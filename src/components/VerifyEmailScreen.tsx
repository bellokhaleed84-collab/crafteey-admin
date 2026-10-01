"use client";

import { useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

export default function VerifyEmailScreen() {
  const { user, resendVerification, refreshAccess, signOut } = useAdminAuth();
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function resend() {
    setError(null);
    setMessage(null);
    try {
      await resendVerification();
      setCooldown(60);
      setMessage(`We sent a link to ${user?.email}. Check your inbox and your spam folder.`);
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      setError(
        code === "auth/too-many-requests"
          ? "Too many requests. Wait a few minutes before trying again."
          : "Couldn't send the email. Try again shortly."
      );
    }
  }

  async function checked() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const state = await refreshAccess();
      if (state === "needs_verification") {
        setError("We still don't see your email as verified. Open the link in the email, then try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Verify your email</h1>
        <p className="text-sm text-slate-500">
          We sent a verification link to <b className="break-all text-slate-700">{user?.email}</b>. Open it, then come
          back here. It may be in your spam folder.
        </p>

        {message && <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{message}</p>}
        {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}

        <button
          type="button"
          onClick={checked}
          disabled={busy}
          className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Checking…" : "I've verified my email"}
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0}
          className="w-full rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
        </button>
        <button type="button" onClick={signOut} className="text-sm font-semibold text-slate-500 underline">
          Sign out
        </button>
      </div>
    </main>
  );
}