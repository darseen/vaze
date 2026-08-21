export const appName = "Vaze";
export const docsRoute = "/docs";
export const docsImageRoute = "/og/docs";
export const docsContentRoute = "/llms.mdx/docs";

// Canonicals, OG images, sitemap, and robots all need absolute URLs.
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

export function absoluteUrl(path: string) {
  return new URL(path, siteUrl).toString();
}

export const gitConfig = {
  user: "darseen",
  repo: "vaze",
  branch: "main",
};
