import type { Tools } from "@darseen/vaze";
import {
  Clapperboard,
  Combine,
  FileImage,
  FilePen,
  FileType,
  FileVideo,
  Images,
  Scissors,
  type LucideIcon,
} from "lucide-react-native";

export type Tool = {
  /** The server's name for it, as in the dashboard's URLs. */
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Whether a server offers it, from `vaze.tools()`. */
  available: (tools: Tools) => boolean;
};

/** The Tools tab's sections, in the dashboard's order. */
export const TOOL_GROUPS = {
  conversion: {
    title: "Conversion",
    tools: [
      {
        slug: "video",
        title: "Video converter",
        description: "Compress, convert and trim videos",
        icon: Clapperboard,
        available: (tools) => tools.video,
      },
      {
        slug: "video-to-audio",
        title: "Video to audio",
        description: "Extract a video's sound as an MP3",
        icon: FileVideo,
        available: (tools) => tools.videoToAudio,
      },
      {
        slug: "image",
        title: "Image converter",
        description: "To WebP, JPG, PNG or AVIF, and resize",
        icon: FileImage,
        available: (tools) => tools.image,
      },
    ],
  },
  pdf: {
    title: "PDF tools",
    tools: [
      {
        slug: "merge",
        title: "Merge PDFs",
        description: "Join PDFs into one, in your order",
        icon: Combine,
        available: (tools) => tools.pdf,
      },
      {
        slug: "split",
        title: "Split PDF",
        description: "Cut a PDF into parts",
        icon: Scissors,
        available: (tools) => tools.pdf,
      },
      {
        slug: "edit",
        title: "Edit pages",
        description: "Move, turn and remove pages",
        icon: FilePen,
        available: (tools) => tools.pdf,
      },
      {
        slug: "from-images",
        title: "Images to PDF",
        description: "One image on each page",
        icon: Images,
        available: (tools) => tools.pdf,
      },
      {
        slug: "from-document",
        title: "Document to PDF",
        description: "Word, Excel, PowerPoint and more",
        icon: FileType,
        available: (tools) => tools.pdf,
      },
    ],
  },
} satisfies Record<string, { title: string; tools: Tool[] }>;

export type ToolGroupKey = keyof typeof TOOL_GROUPS;

export const findTool = (group: ToolGroupKey, slug: string): Tool | undefined =>
  TOOL_GROUPS[group].tools.find((tool) => tool.slug === slug);

/** Whether a server offers any tool at all, which decides if the tab shows. */
export const hasAnyTool = (tools: Tools) =>
  Object.values(TOOL_GROUPS).some((group) =>
    group.tools.some((tool) => tool.available(tools)),
  );
