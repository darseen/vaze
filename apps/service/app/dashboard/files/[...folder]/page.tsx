import { Metadata } from "next";
import { notFound } from "next/navigation";

import { fetchFolderByKey } from "@/app/api/_utils";
import ActionBar from "../_components/action-bar";
import DropZone from "../_components/drop-zone";
import FilesList from "../_components/files-list";

export const metadata: Metadata = {
  title: "Files",
  description: "Vaze | Files page",
};

export default async function Page({
  params,
}: {
  params: Promise<{ folder: string[] }>;
}) {
  // the URL below /dashboard/files maps 1:1 onto the folder key
  let folderKey: string;
  try {
    folderKey = (await params).folder
      .map((segment) => decodeURIComponent(segment))
      .join("/");
  } catch {
    notFound();
  }

  const { data, error } = await fetchFolderByKey(folderKey);

  if (error || !data) notFound();

  const { files, folders } = data;
  return (
    <DropZone>
      <ActionBar />
      <FilesList files={files} folders={folders} />
    </DropZone>
  );
}
