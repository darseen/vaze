import type { Tools } from "@darseen/vaze";
import { Clapperboard, FileImage, type LucideIcon } from "lucide-react-native";

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
        slug: "image",
        title: "Image converter",
        description: "To WebP, JPG, PNG or AVIF, and resize",
        icon: FileImage,
        available: (tools) => tools.image,
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
