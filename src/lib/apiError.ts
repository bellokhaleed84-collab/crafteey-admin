import { NextResponse } from "next/server";

/**
 * One place that turns a thrown error into a JSON response.
 * It does not import AuthError, so it works with whatever your middleware throws
 * as long as the error carries a 4xx `status` (or `statusCode`) number.
 */
export function apiError(err: unknown, label: string) {
  const e = err as { message?: string; status?: number; statusCode?: number } | null;
  const status = e?.status ?? e?.statusCode;

  if (typeof status === "number" && status >= 400 && status < 500) {
    return NextResponse.json({ error: e?.message || "Not allowed" }, { status });
  }

  console.error(`${label} failed:`, err);
  return NextResponse.json({ error: "Server error" }, { status: 500 });
}
