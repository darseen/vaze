import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

const withMDX = createMDX();

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default function config(phase: string) {
  // canonical URLs, the sitemap and link previews would all point at localhost
  if (
    phase === PHASE_PRODUCTION_BUILD &&
    (process.env.NETLIFY || process.env.CI) &&
    !process.env.NEXT_PUBLIC_SITE_URL
  ) {
    throw new Error(
      "Set NEXT_PUBLIC_SITE_URL to the site's public origin, e.g. https://vaze.darseen.dev",
    );
  }

  return withMDX(nextConfig);
}
