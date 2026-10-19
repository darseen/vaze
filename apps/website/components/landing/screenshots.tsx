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
  /** File name under public/screenshots/<kind>, without the extension. */
  name: string;
  alt: string;
  sizes: string;
  eager?: boolean;
}

/** A product screenshot, always taken in dark mode. */
export function Screenshot({ kind, name, alt, sizes, eager }: ScreenshotProps) {
  return (
    <Image
      src={`/screenshots/${kind}/${name}.webp`}
      alt={alt}
      {...SIZES[kind]}
      sizes={sizes}
      loading={eager ? "eager" : undefined}
      className="block h-auto w-full"
    />
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
