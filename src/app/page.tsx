import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Link
        href="/login"
        className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white"
      >
        Go to admin login
      </Link>
    </div>
  );
}
