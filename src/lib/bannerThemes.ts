export const BANNER_THEMES = ["navy", "yellow", "white", "purple", "orange"] as const;
export type BannerTheme = (typeof BANNER_THEMES)[number];

export const BANNER_THEME_LABELS: Record<BannerTheme, string> = {
  navy: "Navy",
  yellow: "Yellow",
  white: "White",
  purple: "Purple",
  orange: "Orange",
};

export const BANNER_THEME_CLASSES: Record<
  BannerTheme,
  { box: string; title: string; sub: string; button: string }
> = {
  navy: {
    box: "bg-[#0B1530]",
    title: "text-white",
    sub: "text-white/75",
    button: "bg-[#F5C542] text-[#0B1530]",
  },
  yellow: {
    box: "bg-[#F5C542]",
    title: "text-[#0B1530]",
    sub: "text-[#0B1530]/70",
    button: "bg-[#0B1530] text-white",
  },
  white: {
    box: "bg-white border border-slate-200",
    title: "text-[#0B1530]",
    sub: "text-slate-500",
    button: "bg-[#0B1530] text-white",
  },
  purple: {
    box: "bg-[#5B2EBF]",
    title: "text-white",
    sub: "text-white/80",
    button: "bg-white text-[#5B2EBF]",
  },
  orange: {
    box: "bg-[#F97316]",
    title: "text-white",
    sub: "text-white/85",
    button: "bg-white text-[#C2410C]",
  },
};

export function isBannerTheme(value: unknown): value is BannerTheme {
  return typeof value === "string" && (BANNER_THEMES as readonly string[]).includes(value);
}