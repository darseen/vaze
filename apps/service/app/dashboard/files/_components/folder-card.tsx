"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/utils";
import type { ApiResponse, Folder } from "@repo/types";
import { Edit, FolderIcon, MoreVertical, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  folder: Folder;
}

export default function FolderCard({ folder }: Props) {
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const pathname = usePathname();

  const handleDelete = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/folders`, {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });

      const { error } = (await response.json()) as ApiResponse<null>;

      if (error) return toast.error(error.message);

      toast.success("Folder deleted successfully");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
      router.refresh();
    }
  };

  const handleRename = async (id: string, name: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/folders`, {
        method: "PUT",
        body: JSON.stringify({ id, name }),
      });
      const { error } = (await response.json()) as ApiResponse<null>;
      if (error) return toast.error(error.message);
      toast.success("Folder renamed successfully");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
      router.refresh();
    }
  };

  return (
    <>
      <Card
        key={folder.id}
        className="group border-border/50 bg-card/50 hover:border-border hover:bg-card relative cursor-pointer overflow-hidden border backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/5"
        onClick={() =>
          router.push(`${pathname}/${encodeURIComponent(folder.name)}`)
        }
      >
        <CardContent className="p-0">
          {/* Folder Preview Area */}
          <div className="relative flex h-32 items-center justify-center bg-linear-to-br from-blue-50/30 to-blue-100/60 dark:from-blue-950/30 dark:to-blue-900/60">
            <div className="relative">
              <FolderIcon className="h-12 w-12 fill-current text-blue-500 transition-colors group-hover:text-blue-600" />
            </div>

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/5" />

            <div className="absolute top-2 right-2 z-10 opacity-70 transition-opacity group-hover:opacity-100">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="bg-background/80 border-border/50 hover:bg-background h-8 w-8 border p-0 shadow-sm backdrop-blur-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingFolder(folder);
                      setNewFolderName(folder.name);
                    }}
                    className="cursor-pointer"
                  >
                    <Edit className="mr-3 h-4 w-4" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem
                        onSelect={(e) => e.preventDefault()}
                        onClick={(e) => e.stopPropagation()}
                        className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                      >
                        <Trash2 className="mr-3 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Delete {folder.name}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {`This action cannot be undone. This will permanently
                            delete "${folder.name}" and all its contents from your storage.`}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(folder.id);
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Folder Info */}
          <div className="space-y-2 p-4">
            <div className="min-w-0">
              <h3 className="text-foreground group-hover:text-primary line-clamp-2 text-sm leading-tight font-semibold transition-colors">
                {folder.name}
              </h3>
              <div className="mt-1 flex items-center gap-1">
                <span className="text-muted-foreground text-xs font-medium">
                  Folder
                </span>
              </div>
              <div className="absolute right-4 bottom-2 flex items-center gap-1">
                <span className="text-muted-foreground text-xs font-medium">
                  {formatDate(folder.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rename Folder Dialog */}
      <Dialog
        open={!!editingFolder}
        onOpenChange={() => setEditingFolder(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Rename Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-muted-foreground text-sm font-medium">
                Current name: {editingFolder?.name}
              </label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter new name"
                className="w-full"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setEditingFolder(null)}
                className="min-w-20"
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  editingFolder && handleRename(editingFolder.id, newFolderName)
                }
                disabled={
                  !newFolderName.trim() ||
                  newFolderName === editingFolder?.name ||
                  loading
                }
                className="min-w-20"
              >
                {loading ? "Renaming..." : "Rename"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
