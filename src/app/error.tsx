"use client";

// Shows the real error message on screen instead of the blank "Application error" page.
// Any page that crashes will now display what went wrong.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h1 className="mb-2 font-bold text-slate-900">Something broke on this page</h1>
        <p className="mb-3 text-sm text-slate-500">Send this message to your developer:</p>
        <pre className="mb-4 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-100 p-3 text-xs text-red-700">
          {error.message || "Unknown error"}
        </pre>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
