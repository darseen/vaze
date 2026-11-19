import { redirect } from "next/navigation";
import { TOOL_GROUPS, toolHref } from "../_components/tools";

// the group itself has no page, so links to it land on its first tool
export default function Page() {
  const group = TOOL_GROUPS.pdf;
  redirect(toolHref(group, group.tools[0]));
}
