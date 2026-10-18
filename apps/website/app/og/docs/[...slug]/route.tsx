import { notFound } from "next/navigation";
import { docsCard } from "@/components/og-card";
import { getPageImage, getPageSection, source } from "@/lib/source";

export const revalidate = false;

export async function GET(
  _req: Request,
  { params }: RouteContext<"/og/docs/[...slug]">,
) {
  const { slug } = await params;
  const page = source.getPage(slug.slice(0, -1));
  if (!page) notFound();

  return docsCard({
    section: getPageSection(page) ?? "Documentation",
    title: page.data.title,
    description: page.data.description,
    path: page.url,
  });
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    lang: page.locale,
    slug: getPageImage(page).segments,
  }));
}
