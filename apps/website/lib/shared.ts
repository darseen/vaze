export const appName = "Vaze";
export const docsRoute = "/docs";
export const privacyRoute = "/privacy";
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

export const repoUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

export const installCommand = `curl -fsSL https://raw.githubusercontent.com/${gitConfig.user}/${gitConfig.repo}/${gitConfig.branch}/scripts/install.sh | sh`;

export const contactEmail = "darseen.dev@gmail.com";
