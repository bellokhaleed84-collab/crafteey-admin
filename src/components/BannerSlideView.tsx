import { BANNER_THEME_CLASSES, isBannerTheme } from "@/lib/bannerThemes";

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
  const t = BANNER_THEME_CLASSES[isBannerTheme(banner.theme) ? banner.theme : "navy"];

  return (
    <div className={`relative flex aspect-[11/5] w-full items-center overflow-hidden rounded-2xl ${t.box}`}>
      <div className="relative z-10 flex w-[62%] flex-col items-start gap-1.5 pl-4 pr-1">
        <p className={`line-clamp-2 text-base font-extrabold leading-tight ${t.title}`}>
          {banner.title || "Banner title"}
        </p>
        {banner.subtitle ? (
          <p className={`line-clamp-2 text-xs leading-snug ${t.sub}`}>{banner.subtitle}</p>
        ) : null}
        {banner.buttonText ? (
          <span className={`mt-1 inline-block rounded-full px-3 py-1.5 text-[11px] font-bold ${t.button}`}>
            {banner.buttonText}
          </span>
        ) : null}
      </div>

      {banner.art ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={banner.art}
          alt=""
          className="absolute bottom-0 right-2 h-[90%] w-auto max-w-[40%] object-contain object-bottom"
        />
      ) : banner.emoji ? (
        <span className="absolute bottom-2 right-4 text-6xl leading-none" aria-hidden="true">
          {banner.emoji}
        </span>
      ) : null}
    </div>
  );
}