"use client";

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
import { Filter, Plus, Search, Upload } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";
import getFolderPath from "../_utils/get-folder-path";

export default function ActionBar() {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();
  const pathname = usePathname();

  const handleFilesUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    try {
      setLoading(true);

      const files = event.target.files;
      if (!files) return;
      const formData = new FormData();

      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }

      const folder = getFolderPath(pathname);
      formData.append("folder", folder);

      const response = await fetch("/api/files", {
        method: "POST",
        body: formData,
      });
      const { error } = (await response.json()) as ApiResponse<null>;
      if (error) return toast.error(error.message);

      toast.success("Files uploaded successfully");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
      event.target.value = "";
    }
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
            disabled={loading}
            className="flex-1 sm:flex-none"
          >
            <Upload className="mr-2 h-4 w-4" />
            {loading ? "Uploading..." : "Upload"}
          </Button>

          <input
            type="file"
            multiple
            disabled={loading}
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

        <div className="flex gap-2">
          <div className="relative max-w-md flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
            <Input
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 lg:min-w-md"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>All Files</DropdownMenuItem>
              <DropdownMenuItem>Documents</DropdownMenuItem>
              <DropdownMenuItem>Images</DropdownMenuItem>
              <DropdownMenuItem>Shared</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
