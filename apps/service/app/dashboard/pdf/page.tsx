import { isToolSectionEnabled } from "@/lib/tool-sections";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { TOOL_GROUPS, toolHref } from "../_components/tools";

// the group itself has no page, so links to it land on its first tool
export default async function Page() {
  await connection();
  if (!isToolSectionEnabled("pdf")) notFound();

  const group = TOOL_GROUPS.pdf;
  redirect(toolHref(group, group.tools[0]));
}
