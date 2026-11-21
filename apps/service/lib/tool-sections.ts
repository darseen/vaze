/** The dashboard's tool sections, each of which an environment variable can turn off. */
export type ToolSection = "conversion";

export const TOOL_SECTION_ENV: Record<ToolSection, string> = {
  conversion: "ENABLE_CONVERSION",
};

/** On unless its variable is set to false. */
export const isToolSectionEnabled = (section: ToolSection) =>
  process.env[TOOL_SECTION_ENV[section]]?.trim().toLowerCase() !== "false";

export const enabledToolSections = (): Record<ToolSection, boolean> => ({
  conversion: isToolSectionEnabled("conversion"),
});

const API_PREFIXES: Record<ToolSection, string> = {
  conversion: "/api/conversion/",
};

/** The section an API path belongs to, if any. */
export function toolSectionOfApi(pathname: string): ToolSection | null {
  for (const [section, prefix] of Object.entries(API_PREFIXES)) {
    if (pathname.startsWith(prefix)) return section as ToolSection;
  }
  return null;
}
