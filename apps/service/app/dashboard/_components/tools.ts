import type { Scope } from "@repo/types";
import {
  Clapperboard,
  Combine,
  FilePen,
  FileImage,
  FileStack,
  FileType,
  FileVideo,
  Images,
  Recycle,
  Scissors,
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
          "Compress and convert videos to MP4, WebM, MOV, MKV or GIF, resize and trim them, and download them.",
        icon: Clapperboard,
      },
      {
        slug: "video-to-audio",
        title: "Video to Audio",
        description: "Convert video files to audio, and download them.",
        icon: FileVideo,
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
  pdf: {
    title: "PDF Tools",
    href: "/dashboard/pdf",
    icon: FileStack,
    scope: "files:read",
    tools: [
      {
        slug: "merge",
        title: "Merge PDFs",
        description: "Join several PDFs into one, in the order you choose.",
        icon: Combine,
      },
      {
        slug: "split",
        title: "Split PDF",
        description: "Cut a PDF into parts, by page or by ranges.",
        icon: Scissors,
      },
      {
        slug: "edit",
        title: "Edit Pages",
        description:
          "Move, turn and remove a PDF's pages, number them, and give it a title.",
        icon: FilePen,
      },
      {
        slug: "from-images",
        title: "Images to PDF",
        description:
          "Put images on pages of their own size, or on A4 or Letter.",
        icon: Images,
      },
      {
        slug: "from-document",
        title: "Document to PDF",
        description:
          "Turn Word, Excel, PowerPoint and OpenDocument files into PDFs.",
        icon: FileType,
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
