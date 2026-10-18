import { docs } from "collections/server";
import { loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";
import { docsContentRoute, docsImageRoute, docsRoute } from "./shared";

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  baseUrl: docsRoute,
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

type Page = (typeof source)["$inferPage"];

/** The sidebar section a page sits in, like "SDK", or null for top-level pages. */
export function getPageSection(page: Page): string | null {
  for (const node of source.getPageTree().children) {
    if (node.type !== "folder" || typeof node.name !== "string") continue;
    const inFolder =
      node.index?.url === page.url ||
      node.children.some(
        (child) => child.type === "page" && child.url === page.url,
      );
    if (inFolder) return node.name;
  }
  return null;
}

// "Files" is a page in both the SDK and the API reference
const titleCounts = new Map<string, number>();
for (const page of source.getPages()) {
  titleCounts.set(page.data.title, (titleCounts.get(page.data.title) ?? 0) + 1);
}

/** The page title, prefixed with its section when another page shares it. */
export function getPageTitle(page: Page): string {
  const { title } = page.data;
  const section = getPageSection(page);
  return (titleCounts.get(title) ?? 0) > 1 && section
    ? `${section}: ${title}`
    : title;
}

export function getPageImage(page: (typeof source)["$inferPage"]) {
  const segments = [...page.slugs, "image.png"];

  return {
    segments,
    url: `${docsImageRoute}/${segments.join("/")}`,
  };
}

export function getPageMarkdownUrl(page: (typeof source)["$inferPage"]) {
  const segments = [...page.slugs, "content.md"];

  return {
    segments,
    url: `${docsContentRoute}/${segments.join("/")}`,
  };
}

export async function getLLMText(page: (typeof source)["$inferPage"]) {
  const processed = await page.data.getText("processed");

  return `# ${page.data.title} (${page.url})

${processed}`;
}
