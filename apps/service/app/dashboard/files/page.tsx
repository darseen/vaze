import { Metadata } from "next";
import { notFound } from "next/navigation";

import { fetchFolderByKey } from "@/app/api/_utils";
import ActionBar from "./_components/action-bar";
import FilesList from "./_components/files-list";

export const metadata: Metadata = {
  title: "Files",
  description: "Vaze | Files page",
};

export default async function Page() {
  // the root folder's key is the empty string
  const { data, error } = await fetchFolderByKey("");

  if (error || !data) notFound();

  const { files, folders } = data;
  return (
    <div className="mx-auto w-full max-w-7xl">
      <ActionBar />
      <FilesList files={files} folders={folders} />
    </div>
  );
}
