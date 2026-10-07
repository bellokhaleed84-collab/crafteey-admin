import { BANNER_THEME_STYLES, isBannerTheme } from "@/lib/bannerThemes";

export interface BannerView {
  title: string;
  subtitle?: string;
  buttonText?: string;
  art?: string;
  emoji?: string;
  theme: string;
}

// The look of one banner. Used by the client Home carousel and the admin live preview.
export default function BannerSlideView({ banner }: { banner: BannerView }) {
  const t = BANNER_THEME_STYLES[isBannerTheme(banner.theme) ? banner.theme : "navy"];

  return (
    <div
      className="relative flex w-full items-center overflow-hidden rounded-2xl"
      style={{
        aspectRatio: "2 / 1",
        backgroundColor: t.bg,
        border: `1px solid ${t.border}`,
        boxShadow: "0 4px 14px rgba(11,21,48,0.12)",
      }}
    >
      <div className="relative z-10 flex w-[60%] flex-col items-start gap-2 py-3 pl-5 pr-1">
        <p className="line-clamp-2 text-lg font-extrabold leading-tight" style={{ color: t.title }}>
          {banner.title || "Banner title"}
        </p>
        {banner.subtitle ? (
          <p className="line-clamp-2 text-xs font-medium leading-snug" style={{ color: t.sub }}>
            {banner.subtitle}
          </p>
        ) : null}
        {banner.buttonText ? (
          <span
            className="mt-1 inline-block rounded-full px-4 py-2 text-xs font-bold"
            style={{ backgroundColor: t.buttonBg, color: t.buttonText }}
          >
            {banner.buttonText}
          </span>
        ) : null}
      </div>

      {banner.art ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={banner.art}
          alt=""
          className="absolute bottom-0 right-2 h-[92%] w-auto max-w-[42%] object-contain object-bottom"
        />
      ) : banner.emoji ? (
        <span
          className="absolute right-5 top-1/2 -translate-y-1/2 text-7xl leading-none"
          aria-hidden="true"
        >
          {banner.emoji}
        </span>
      ) : null}
    </div>
  );
}