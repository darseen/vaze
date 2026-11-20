import { isToolSectionEnabled } from "@/lib/tool-sections";
import { authorize } from "@/utils/auth";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { findTool, type ToolGroupKey } from "./tools";

export function toolMetadata(group: ToolGroupKey, slug: string): Metadata {
  const { tool } = findTool(group, slug);
  return { title: tool.title, description: `Vaze | ${tool.description}` };
}

/** A tool's page, with its heading, for those whose scopes allow the tool. */
export default async function ToolPage({
  group: groupKey,
  slug,
  children,
}: {
  group: ToolGroupKey;
  slug: string;
  children: ReactNode;
}) {
  await connection();
  if (!isToolSectionEnabled(groupKey)) notFound();

  const { group, tool } = findTool(groupKey, slug);
  const { error } = await authorize(group.scope);
  if (error) redirect("/dashboard");

  const Icon = tool.icon;

  return (
    <main className="mx-auto w-full max-w-4xl">
      <div className="mb-8">
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <Icon className="text-primary h-8 w-8" />
            <h1 className="text-foreground text-3xl font-bold">{tool.title}</h1>
          </div>
          <p className="text-muted-foreground text-balance">
            {tool.description}
          </p>
        </div>

        {children}
      </div>
    </main>
  );
}
