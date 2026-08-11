"use client";

import { useUploadActions } from "@/app/dashboard/_components/uploads/provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ApiResponse } from "@repo/types";
import { Plus, Upload } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";
import getFolderPath from "../_utils/get-folder-path";

export default function ActionBar() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { enqueue } = useUploadActions();
  const router = useRouter();
  const pathname = usePathname();

  const handleFilesUpload = (event: ChangeEvent<HTMLInputElement>) => {
    enqueue(Array.from(event.target.files ?? []), getFolderPath(pathname));
    // let the same file be picked again after it finishes
    event.target.value = "";
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      toast.error("Please enter a folder name");
      return;
    }

    try {
      setCreatingFolder(true);

      const currentFolder = getFolderPath(pathname);
      const folderPath = currentFolder
        ? `${currentFolder}/${folderName}`
        : folderName;

      const response = await fetch("/api/folders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folder: folderPath,
        }),
      });

      const { error } = (await response.json()) as ApiResponse<null>;
      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Folder created successfully");
      setIsDialogOpen(false);
      setFolderName("");
      router.refresh();
    } catch {
      toast.error("Failed to create folder");
    } finally {
      setCreatingFolder(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex w-full flex-col-reverse gap-4 sm:flex-row sm:justify-center">
        <div className="flex gap-2">
          <Button
            onClick={() => inputRef.current?.click()}
            className="flex-1 sm:flex-none"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>

          <input
            type="file"
            multiple
            ref={inputRef}
            onChange={handleFilesUpload}
            style={{ display: "none" }}
          />
          <Button
            variant="outline"
            onClick={() => {
              setIsDialogOpen(true);
              setFolderName("");
            }}
            className="flex-1 bg-transparent sm:flex-none"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Folder
          </Button>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-106.25">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Enter a name for your new folder. You can organize your files by
              creating folders.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              placeholder="Folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={creatingFolder}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={creatingFolder || !folderName.trim()}
            >
              {creatingFolder ? "Creating..." : "Create Folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
