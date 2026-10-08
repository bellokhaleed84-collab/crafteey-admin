"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { dateTime } from "@/lib/format";

type Loaded = {
  body: string;
  defaultBody: string;
  version: number;
  isDefault: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
};

export default function TermsEditorPage() {
  const { getIdToken } = useAdminAuth();
  const [data, setData] = useState<Loaded | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getIdToken();
      const res = await fetch("/api/admin/legal/terms", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Something went wrong");
      setData(d);
      setText(d.body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the terms");
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!data || saving) return;
    if (!window.confirm("Save these terms? Customers will see the new text straight away.")) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/admin/legal/terms", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, expectedVersion: data.version }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || "Could not save");
      setSaved(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const dirty = !!data && text !== data.body;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Terms & Conditions</h1>
      <p className="mt-1 text-sm text-slate-500">
        This is what customers read under More, Terms & Conditions. Edit it here and save.
      </p>

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading && <div className="mt-4 h-96 animate-pulse rounded-2xl bg-slate-100" aria-busy="true" />}

      {data && !loading && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm lg:col-span-2">
            {data.isDefault && (
              <p className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                This is the starter text and it has not been saved yet. Customers already see it. Replace it with the
                terms from your lawyer when you have them.
              </p>
            )}
            <textarea
              value={text}
              onChange={(e) => {
                setSaved(false);
                setText(e.target.value);
              }}
              rows={26}
              maxLength={60000}
              spellCheck
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900"
            />
            {saved && <p className="mt-2 rounded-lg bg-green-50 p-2 text-xs text-green-700">Saved. Customers now see this version.</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={saving || !dirty || text.trim().length < 50}
                onClick={() => void save()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {saving ? "Saving..." : "Save terms"}
              </button>
              <button
                type="button"
                disabled={saving || !dirty}
                onClick={() => {
                  setText(data.body);
                  setSaved(false);
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-40"
              >
                Undo changes
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  if (window.confirm("Replace the text box with the starter text? Nothing changes until you press Save.")) {
                    setText(data.defaultBody);
                    setSaved(false);
                  }
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-40"
              >
                Load starter text
              </button>
              <span className="text-xs text-slate-400">{text.length} / 60000</span>
            </div>
          </section>

          <div className="space-y-4 lg:col-span-1">
            <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-slate-900">Current version</p>
              <p className="mt-1 text-xs text-slate-500">
                {data.isDefault
                  ? "Not saved yet (starter text)."
                  : `Version ${data.version}, saved by ${data.updatedBy || "an admin"}${
                      data.updatedAt ? ` on ${dateTime(data.updatedAt)}` : ""
                    }.`}
              </p>
            </section>

            <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-slate-900">How to format</p>
              <ul className="mt-2 space-y-2 text-xs text-slate-600">
                <li>
                  A heading: start the line with <b># </b>, like <b># 1. About these terms</b>
                </li>
                <li>A new paragraph: leave one empty line between paragraphs.</li>
                <li>
                  A bullet list: start every line with <b>- </b> and keep the lines together with no empty line between them.
                </li>
              </ul>
              <p className="mt-3 text-xs text-slate-500">
                To replace everything with your lawyer's version, select all the text, paste the new text over it and press Save.
              </p>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}