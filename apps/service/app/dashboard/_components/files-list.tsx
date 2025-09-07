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
import { File } from "@/db";
import { ApiResponse } from "@/types";
import { formatDate } from "@/utils";
import {
  Download,
  Edit,
  FileText,
  MoreVertical,
  Share,
  Trash2,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  files: File[];
}

export default function FilesList({ files }: Props) {
  const [editingFile, setEditingFile] = useState<File | null>(null);
  const [newFileName, setNewFileName] = useState("");

  const router = useRouter();
  const pathname = usePathname();

  const handleRename = async () => {};

  const handleDelete = async (name: string) => {
    try {
      // get folders from pathname
      const folders = pathname.split("/").slice(2);
      const folder = folders.length > 0 ? folders.slice(0, -1).join("/") : ".";

      const response = await fetch(`/api/files`, {
        method: "DELETE",
        body: JSON.stringify({ name, folder }),
      });

      const { error } = (await response.json()) as ApiResponse<null>;

      if (error) {
        toast.error(error.message);
        return router.refresh();
      }

      toast.success("File deleted successfully");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    }
  };

  const formatSize = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    if (mb < 1) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const getFileExtension = (filename: string) => {
    return filename.split(".").pop()?.toUpperCase() || "";
  };

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {files.map((file) => (
        <Card
          key={file.id}
          className="group border-border/50 bg-card/50 hover:border-border hover:bg-card relative overflow-hidden border backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/5"
        >
          <CardContent className="p-0">
            {/* File Preview Area */}
            <div className="from-muted/30 to-muted/60 relative flex h-32 items-center justify-center bg-gradient-to-br">
              <div className="relative">
                <FileText className="text-muted-foreground/60 group-hover:text-muted-foreground/80 h-12 w-12 transition-colors" />
                {getFileExtension(file.name) && (
                  <div className="bg-primary/90 text-primary-foreground absolute -right-2 -bottom-2 rounded-md px-1.5 py-0.5 text-xs font-medium shadow-sm">
                    {getFileExtension(file.name)}
                  </div>
                )}
              </div>

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/5" />

              {/* Action button */}
              <div className="absolute top-2 right-2 z-10 opacity-70 transition-opacity group-hover:opacity-100">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="bg-background/80 border-border/50 hover:bg-background h-8 w-8 border p-0 shadow-sm backdrop-blur-sm"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() => {
                        setEditingFile(file);
                        setNewFileName(file.name);
                      }}
                      className="cursor-pointer"
                    >
                      <Edit className="mr-3 h-4 w-4" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer" asChild>
                      <a
                        href={`/api/files/download/${file.id}`}
                        download
                        target="_blank"
                      >
                        <Download className="mr-3 h-4 w-4" />
                        Download
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer">
                      <Share className="mr-3 h-4 w-4" />
                      Share
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                          onSelect={(e) => e.preventDefault()}
                          className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                        >
                          <Trash2 className="mr-3 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete {file.name}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {`This action cannot be undone. This will permanently
                            delete "${file.name}" from your storage.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(file.name)}
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

            {/* File Info */}
            <div className="space-y-2 p-4">
              <div className="min-w-0">
                <h3 className="text-foreground group-hover:text-primary line-clamp-2 text-sm leading-tight font-semibold transition-colors">
                  {file.name}
                </h3>
                <div className="mt-1 flex items-center gap-1">
                  {file.size && (
                    <span className="text-muted-foreground text-xs font-medium">
                      {formatSize(file.size)}
                    </span>
                  )}
                </div>
                <div className="absolute right-4 bottom-2 flex items-center gap-1">
                  <span className="text-muted-foreground text-xs font-medium">
                    {formatDate(file.created_at)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Rename Dialog */}
      <Dialog open={!!editingFile} onOpenChange={() => setEditingFile(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Rename File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-muted-foreground text-sm font-medium">
                Current name: {editingFile?.name}
              </label>
              <Input
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="Enter new name"
                className="w-full"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setEditingFile(null)}
                className="min-w-20"
              >
                Cancel
              </Button>
              <Button
                onClick={() => editingFile && handleRename()}
                disabled={
                  !newFileName.trim() || newFileName === editingFile?.name
                }
                className="min-w-20"
              >
                Rename
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
