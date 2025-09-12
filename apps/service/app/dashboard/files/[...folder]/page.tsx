import { Metadata } from "next";

import ActionBar from "./_components/action-bar";
import FilesList from "./_components/files-list";
import fetchFolder from "./_utils/fetch-folder";

export const metadata: Metadata = {
  title: "Files",
  description: "Vaze | Files page",
};

export default async function Page({
  params,
}: {
  params: Promise<{ folder: string[] }>;
}) {
  const folderPath = (await params).folder.slice(1).join("/");

  const { data, error } = await fetchFolder({ path: folderPath });

  if (error) throw new Error(error.message);

  const { files, folders } = data;
  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-6">
        <ActionBar />

        <FilesList files={files} folders={folders} />
      </div>
    </div>
  );
}
