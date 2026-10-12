"use client";

import { useCan } from "@/app/dashboard/_components/permissions";
import {
  pickedItems,
  useUploadActions,
} from "@/app/dashboard/_components/uploads/provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { ApiResponse } from "@repo/types";
import { ChevronDown, FileUp, FolderUp, Plus, Upload } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";
import getFolderPath from "../_utils/get-folder-path";

export default function ActionBar() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const { enqueue } = useUploadActions();
  const router = useRouter();
  const pathname = usePathname();
  const can = useCan();

  const handleFilesUpload = (event: ChangeEvent<HTMLInputElement>) => {
    enqueue(pickedItems(event.target.files ?? []), getFolderPath(pathname));
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

  if (!can("files:write")) return null;

  return (
    <>
      <div className="mb-6 flex w-full flex-col-reverse gap-4 sm:flex-row sm:justify-center">
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="flex-1 sm:flex-none">
                <Upload className="mr-2 h-4 w-4" />
                Upload
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuItem
                onClick={() => filesInputRef.current?.click()}
                className="cursor-pointer"
              >
                <FileUp className="mr-3 h-4 w-4" />
                Files
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => folderInputRef.current?.click()}
                className="cursor-pointer"
              >
                <FolderUp className="mr-3 h-4 w-4" />
                Folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <input
            type="file"
            multiple
            ref={filesInputRef}
            onChange={handleFilesUpload}
            style={{ display: "none" }}
          />
          <input
            type="file"
            ref={(node) => {
              folderInputRef.current = node;
              // React has no prop for it, so set it on the element
              if (node) node.webkitdirectory = true;
            }}
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
