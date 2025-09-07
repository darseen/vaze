import { FileIcon } from "lucide-react";
import { Metadata } from "next";
import { connection } from "next/server";

import ActionBar from "./_components/action-bar";
import FilesList from "./_components/files-list";
import fetchFiles from "./_utils/fetch-files";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Vaze | Dashboard page",
};

export default async function Dashboard() {
  await connection();

  const { data, error } = await fetchFiles();

  if (error) throw new Error(error.message);

  const { files } = data;

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-6">
        <ActionBar />

        {files.length === 0 ? (
          <div className="py-12 text-center">
            <FileIcon className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <h3 className="text-foreground mb-2 text-lg font-medium">
              No files found
            </h3>
            {/* <p className="text-muted-foreground">
              {searchTerm
                ? "Try adjusting your search terms"
                : "Upload your first file to get started"}
            </p> */}
          </div>
        ) : (
          <FilesList files={files} />
        )}
      </div>
    </div>
  );
}
