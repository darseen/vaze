import type { Scope } from "@repo/types";
import {
  Clapperboard,
  FileImage,
  Recycle,
  type LucideIcon,
} from "lucide-react";

export interface Tool {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface ToolGroup {
  title: string;
  /** Its own page sends visitors on to the first tool. */
  href: string;
  icon: LucideIcon;
  scope: Scope;
  tools: Tool[];
}

export const TOOL_GROUPS = {
  conversion: {
    title: "Conversion",
    href: "/dashboard/conversion",
    icon: Recycle,
    scope: "files:read",
    tools: [
      {
        slug: "video",
        title: "Video Converter",
        description:
          "Compress and convert videos to MP4, WebM, MOV, MKV or GIF, resize and trim them, or keep only their sound as an MP3.",
        icon: Clapperboard,
      },
      {
        slug: "image",
        title: "Image Converter",
        description:
          "Convert images to WebP, JPG, PNG or AVIF, resize them, and download them.",
        icon: FileImage,
      },
    ],
  },
} satisfies Record<string, ToolGroup>;

export type ToolGroupKey = keyof typeof TOOL_GROUPS;

export const toolHref = (group: ToolGroup, tool: Tool) =>
  `${group.href}/${tool.slug}`;

/** The tool a page is for; a slug the group lacks is a programming error. */
export function findTool(groupKey: ToolGroupKey, slug: string) {
  const group: ToolGroup = TOOL_GROUPS[groupKey];
  const tool = group.tools.find((tool) => tool.slug === slug);
  if (!tool) throw new Error(`No ${groupKey} tool named ${slug}`);
  return { group, tool };
}
