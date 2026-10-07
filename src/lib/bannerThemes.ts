export const BANNER_THEMES = ["navy", "yellow", "white", "purple", "orange"] as const;
export type BannerTheme = (typeof BANNER_THEMES)[number];

export const BANNER_THEME_LABELS: Record<BannerTheme, string> = {
  navy: "Navy",
  yellow: "Yellow",
  white: "White",
  purple: "Purple",
  orange: "Orange",
};

// Colours are applied directly (inline) so they always show,
// whatever Tailwind does or does not scan.
export const BANNER_THEME_STYLES: Record<
  BannerTheme,
  { bg: string; border: string; title: string; sub: string; buttonBg: string; buttonText: string }
> = {
  navy: {
    bg: "#0B1530",
    border: "transparent",
    title: "#FFFFFF",
    sub: "rgba(255,255,255,0.8)",
    buttonBg: "#F5C542",
    buttonText: "#0B1530",
  },
  yellow: {
    bg: "#F5C542",
    border: "transparent",
    title: "#0B1530",
    sub: "rgba(11,21,48,0.75)",
    buttonBg: "#0B1530",
    buttonText: "#FFFFFF",
  },
  white: {
    bg: "#FFFFFF",
    border: "#E2E8F0",
    title: "#0B1530",
    sub: "#64748B",
    buttonBg: "#0B1530",
    buttonText: "#FFFFFF",
  },
  purple: {
    bg: "#5B2EBF",
    border: "transparent",
    title: "#FFFFFF",
    sub: "rgba(255,255,255,0.85)",
    buttonBg: "#FFFFFF",
    buttonText: "#5B2EBF",
  },
  orange: {
    bg: "#F97316",
    border: "transparent",
    title: "#FFFFFF",
    sub: "rgba(255,255,255,0.9)",
    buttonBg: "#FFFFFF",
    buttonText: "#C2410C",
  },
};

export function isBannerTheme(value: unknown): value is BannerTheme {
  return typeof value === "string" && (BANNER_THEMES as readonly string[]).includes(value);
}