"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { authMessage } from "@/lib/authMessage";

export default function StaffSignupPage() {
  const { signUp } = useAdminAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      // Creates the account and emails a verification link.
      await signUp(email.trim(), password);
      // The dashboard asks you to verify, then checks that you were invited.
      router.push("/dashboard");
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-xl font-bold text-slate-900 mb-1">Staff account</h1>
        <p className="text-sm text-slate-500 mb-6">
          Use the email address a Super Admin added for you. You&apos;ll verify it in the next step.
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <label className="block text-xs font-semibold text-slate-500 mb-1">Email</label>
        <input
          type="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full mb-4 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />

        <label className="block text-xs font-semibold text-slate-500 mb-1">Create a password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full mb-6 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>

        <p className="mt-5 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-slate-900 underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}