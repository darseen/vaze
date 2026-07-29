import { Metadata } from "next";
import { notFound } from "next/navigation";

import { fetchFolderByPath } from "@/app/api/_utils";
import ActionBar from "./_components/action-bar";
import FilesList from "./_components/files-list";

export const metadata: Metadata = {
  title: "Files",
  description: "Vaze | Files page",
};

export default async function Page({
  params,
}: {
  params: Promise<{ folder: string[] }>;
}) {
  // The first segment is the fixed "uploads" root; the rest is the path within it.
  const folderPath = (await params).folder.slice(1).join("/");

  const { data, error } = await fetchFolderByPath(folderPath);

  if (error || !data) notFound();

  const { files, folders } = data;
  return (
    <div className="mx-auto w-full max-w-7xl">
      <ActionBar />
      <FilesList files={files} folders={folders} />
    </div>
  );
}
