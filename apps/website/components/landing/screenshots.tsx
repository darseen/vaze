import Image from "next/image";
import type { ReactNode } from "react";

type Kind = "web" | "mobile";

// every screenshot of a kind is exported at the same size
const SIZES: Record<Kind, { width: number; height: number }> = {
  web: { width: 2400, height: 1500 },
  mobile: { width: 1080, height: 2400 },
};

interface ScreenshotProps {
  kind: Kind;
  /** File name under public/screenshots/<kind>, without the theme suffix. */
  name: string;
  alt: string;
  sizes: string;
  eager?: boolean;
  /** Only false for screens that look the same in both themes. */
  themed?: boolean;
}

/** A product screenshot that follows the site's light or dark theme. */
export function Screenshot({
  kind,
  name,
  alt,
  sizes,
  eager,
  themed = true,
}: ScreenshotProps) {
  const shared = {
    ...SIZES[kind],
    sizes,
    loading: eager ? ("eager" as const) : undefined,
    className: "block h-auto w-full",
  };

  if (!themed) {
    return (
      <Image src={`/screenshots/${kind}/${name}.webp`} alt={alt} {...shared} />
    );
  }

  return (
    <>
      <Image
        src={`/screenshots/${kind}/${name}-light.webp`}
        alt={alt}
        {...shared}
        className={`${shared.className} dark:hidden`}
      />
      <Image
        src={`/screenshots/${kind}/${name}-dark.webp`}
        alt={alt}
        {...shared}
        className={`${shared.className} hidden dark:block`}
      />
    </>
  );
}

export function BrowserFrame({
  address,
  children,
}: {
  address: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-fd-border bg-fd-card shadow-2xl shadow-black/10 dark:shadow-black/50">
      <div className="flex h-8 items-center gap-3 border-b border-fd-border px-3 sm:h-9">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-fd-muted-foreground/30" />
          <span className="size-2.5 rounded-full bg-fd-muted-foreground/30" />
          <span className="size-2.5 rounded-full bg-fd-muted-foreground/30" />
        </div>
        <div className="mx-auto truncate rounded-md bg-fd-muted px-3 py-0.5 text-[11px] text-fd-muted-foreground sm:px-6 sm:text-xs">
          {address}
        </div>
        <div className="w-[42px]" aria-hidden />
      </div>
      {children}
    </div>
  );
}

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[1.4rem] bg-neutral-900 p-[5px] shadow-2xl shadow-black/25 ring-1 ring-black/10 sm:rounded-[2.2rem] sm:p-2 dark:bg-neutral-800 dark:shadow-black/60 dark:ring-white/10">
      <div className="overflow-hidden rounded-[1.1rem] sm:rounded-[1.75rem]">
        {children}
      </div>
    </div>
  );
}
