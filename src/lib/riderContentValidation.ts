import { CARD_COLORS, CARD_ICONS, toMinutes } from "@/lib/riderContent";

// Slugs the rider app already uses. New sections may not take these.
export const BUILTIN_SLUGS = [
  "availability", "delivery-requests", "navigation", "payments", "safety", "profile", "vehicle",
  "notifications", "communication", "privacy", "appearance", "help", "promotions", "legal", "about",
];

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function parseDate(v: unknown): Date | null | "invalid" {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string") return "invalid";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}

// ---------- Home cards ----------

export interface CardInput {
  title: string;
  message: string;
  icon: string;
  color: string;
  enabled: boolean;
  schedule: { always: boolean; days: number[]; start: string; end: string };
  startsAt: Date | null;
  endsAt: Date | null;
}

type CardResult = { ok: true; data: CardInput } | { ok: false; error: string };

export function parseCardBody(body: Record<string, unknown>): CardResult {
  const title = str(body.title, 40);
  if (!title) return { ok: false, error: "Give the card a title." };

  const message = typeof body.message === "string" ? body.message.replace(/\r\n/g, "\n").trim().slice(0, 300) : "";

  const icon = typeof body.icon === "string" ? body.icon : "info";
  if (!(CARD_ICONS as readonly string[]).includes(icon)) return { ok: false, error: "Pick a valid icon." };
  const color = typeof body.color === "string" ? body.color : "orange";
  if (!(CARD_COLORS as readonly string[]).includes(color)) return { ok: false, error: "Pick a valid colour." };

  const sched = (body.schedule && typeof body.schedule === "object" ? body.schedule : {}) as Record<string, unknown>;
  const always = sched.always !== false;
  const rawDays = Array.isArray(sched.days) ? sched.days : [];
  const days = [...new Set<number>(rawDays.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
  const start = typeof sched.start === "string" ? sched.start : "17:00";
  const end = typeof sched.end === "string" ? sched.end : "21:00";
  if (!always) {
    if (days.length === 0) return { ok: false, error: "Pick at least one day, or choose Always." };
    if (toMinutes(start) === null || toMinutes(end) === null) {
      return { ok: false, error: "Start and end times must look like 17:00." };
    }
  }

  const startsAt = parseDate(body.startsAt);
  const endsAt = parseDate(body.endsAt);
  if (startsAt === "invalid" || endsAt === "invalid") return { ok: false, error: "A date is not valid." };
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    return { ok: false, error: "The end date must be after the start date." };
  }

  return {
    ok: true,
    data: {
      title,
      message,
      icon,
      color,
      enabled: body.enabled !== false,
      schedule: {
        always,
        days: always ? [] : days,
        start: toMinutes(start) !== null ? start : "17:00",
        end: toMinutes(end) !== null ? end : "21:00",
      },
      startsAt,
      endsAt,
    },
  };
}

type CardLike = {
  _id: unknown;
  title: string;
  message?: string;
  icon?: string;
  color?: string;
  order?: number;
  enabled?: boolean;
  schedule?: { always?: boolean; days?: number[]; start?: string; end?: string } | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
};

export function serializeCard(c: CardLike) {
  return {
    _id: String(c._id),
    title: c.title,
    message: c.message ?? "",
    icon: c.icon ?? "info",
    color: c.color ?? "orange",
    order: c.order ?? 0,
    enabled: c.enabled !== false,
    schedule: {
      always: c.schedule?.always !== false,
      days: Array.from(c.schedule?.days ?? []),
      start: c.schedule?.start ?? "17:00",
      end: c.schedule?.end ?? "21:00",
    },
    startsAt: c.startsAt ? new Date(c.startsAt).toISOString() : null,
    endsAt: c.endsAt ? new Date(c.endsAt).toISOString() : null,
  };
}

// ---------- Settings sections ----------

export interface SectionInput {
  title: string;
  description: string;
  icon: string;
  group: "core" | "more";
  body: string;
  enabled: boolean;
}

type SectionResult = { ok: true; data: SectionInput } | { ok: false; error: string };

export function parseSectionBody(body: Record<string, unknown>): SectionResult {
  const title = str(body.title, 40);
  if (!title) return { ok: false, error: "Give the section a title." };
  const text = typeof body.body === "string" ? body.body.replace(/\r\n/g, "\n").trim().slice(0, 20000) : "";
  if (!text) return { ok: false, error: "Write something for the section." };
  const group = body.group === "core" ? "core" : "more";
  return {
    ok: true,
    data: {
      title,
      description: str(body.description, 100),
      icon: str(body.icon, 8) || "\uD83D\uDCCC",
      group,
      body: text,
      enabled: body.enabled !== false,
    },
  };
}

type SectionLike = {
  _id: unknown;
  slug: string;
  title: string;
  description?: string;
  icon?: string;
  group?: string;
  body?: string;
  order?: number;
  enabled?: boolean;
};

export function serializeSection(s: SectionLike) {
  return {
    _id: String(s._id),
    slug: s.slug,
    title: s.title,
    description: s.description ?? "",
    icon: s.icon ?? "\uD83D\uDCCC",
    group: s.group === "core" ? "core" : "more",
    body: s.body ?? "",
    order: s.order ?? 0,
    enabled: s.enabled !== false,
  };
}

export function makeSlug(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
  return s || "section";
}