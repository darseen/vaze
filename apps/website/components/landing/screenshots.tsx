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
  /** Above the fold: load at once. "lcp" also raises its fetch priority. */
  eager?: boolean | "lcp";
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
      fetchPriority={eager === "lcp" ? "high" : undefined}
      className="block h-auto w-full"
    />
  );
}

/** Browser chrome around a web screenshot, dark like the screenshot inside it. */
export function BrowserFrame({
  address,
  children,
}: {
  address: string;
  children: ReactNode;
}) {
  return (
    <div className="dark overflow-hidden rounded-xl border border-fd-border bg-fd-card text-fd-foreground shadow-frame scheme-dark">
      <div className="border-b border-fd-border px-3.5 py-2 sm:px-4">
        <p className="truncate font-mono text-[0.6875rem] text-fd-muted-foreground sm:text-xs">
          {address}
        </p>
      </div>
      {children}
    </div>
  );
}

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[1.4rem] bg-neutral-900 p-[5px] shadow-frame ring-1 ring-black/10 sm:rounded-[2.2rem] sm:p-2 dark:bg-neutral-800 dark:ring-white/10">
      <div className="overflow-hidden rounded-[1.1rem] sm:rounded-[1.75rem]">
        {children}
      </div>
    </div>
  );
}
