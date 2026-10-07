import { isBannerTheme } from "@/lib/bannerThemes";

export interface BannerInput {
  title: string;
  subtitle: string;
  buttonText: string;
  link: string;
  art: string;
  emoji: string;
  theme: string;
  placement: string;
  enabled: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}

type ParseResult = { ok: true; data: BannerInput } | { ok: false; error: string };

const PLACEMENTS = ["home", "hub", "both"];

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function parseDate(v: unknown): Date | null | "invalid" {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string") return "invalid";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}

/** Checks a full banner (create, or edit form). Order is handled separately. */
export function parseBannerBody(body: Record<string, unknown>): ParseResult {
  const title = str(body.title, 60);
  if (!title) return { ok: false, error: "Give the banner a title." };

  const link = str(body.link, 300);
  const linkOk = link === "/" || (link.startsWith("/") && !link.startsWith("//")) || link.startsWith("https://");
  if (!linkOk) {
    return { ok: false, error: "Link must be an in-app page starting with / (like /dashboard/hub) or a full https:// address." };
  }

  const art = str(body.art, 500);
  if (art && !art.startsWith("https://")) return { ok: false, error: "Art image must be an https:// address." };

  const theme = typeof body.theme === "string" ? body.theme : "navy";
  if (!isBannerTheme(theme)) return { ok: false, error: "Pick a valid colour theme." };

  const placement = typeof body.placement === "string" ? body.placement : "home";
  if (!PLACEMENTS.includes(placement)) return { ok: false, error: "Pick where the banner shows: Home, Hub or Both." };

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
      subtitle: str(body.subtitle, 120),
      buttonText: str(body.buttonText, 24),
      link,
      art,
      emoji: str(body.emoji, 8),
      theme,
      placement,
      enabled: body.enabled !== false,
      startsAt,
      endsAt,
    },
  };
}

type BannerLike = {
  _id: unknown;
  title: string;
  subtitle?: string;
  buttonText?: string;
  link?: string;
  art?: string;
  emoji?: string;
  theme?: string;
  placement?: string;
  order?: number;
  enabled?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
};

export function serializeBanner(b: BannerLike) {
  return {
    _id: String(b._id),
    title: b.title,
    subtitle: b.subtitle ?? "",
    buttonText: b.buttonText ?? "",
    link: b.link ?? "",
    art: b.art ?? "",
    emoji: b.emoji ?? "",
    theme: b.theme ?? "navy",
    placement: b.placement ?? "home",
    order: b.order ?? 0,
    enabled: b.enabled !== false,
    startsAt: b.startsAt ? new Date(b.startsAt).toISOString() : null,
    endsAt: b.endsAt ? new Date(b.endsAt).toISOString() : null,
  };
}