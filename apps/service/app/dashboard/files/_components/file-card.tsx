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
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatBytes, formatDate } from "@/utils";
import { copyToClipboard } from "@/utils/clipboard";
import { ApiResponse, FileWithUrl } from "@repo/types";
import {
  Clock,
  Download,
  Edit,
  FileText,
  Globe,
  Link as LinkIcon,
  Lock,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  file: FileWithUrl;
  selected?: boolean;
  /** `shiftKey` lets the list extend the selection from the last click. */
  onSelectedChange?: (checked: boolean, shiftKey: boolean) => void;
}

export default function FileCard({ file, selected, onSelectedChange }: Props) {
  const [editingFile, setEditingFile] = useState<FileWithUrl | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const isPrivate = file.visibility === "private";

  const handleRename = async (id: string, name: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/files`, {
        method: "PUT",
        body: JSON.stringify({ id, name }),
      });
      const { error } = (await response.json()) as ApiResponse<null>;
      if (error) return toast.error(error.message);
      toast.success("File renamed successfully");
      setEditingFile(null);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
      router.refresh();
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/files`, {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });

      const { error } = (await response.json()) as ApiResponse<null>;

      if (error) return toast.error(error.message);

      toast.success("File deleted successfully");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
      router.refresh();
    }
  };

  const handleCopyLink = async () => {
    // `file.url` is the relative `api/hosting/<name>`; resolve it against the
    // current origin so the copied link is a full, shareable URL.
    const hostingUrl = new URL(file.url, window.location.origin).href;
    const success = await copyToClipboard(hostingUrl);
    if (success) toast.success("Link copied to clipboard");
    else toast.error("Failed to copy link");
  };

  const handleToggleVisibility = async () => {
    const visibility = isPrivate ? "public" : "private";

    try {
      setLoading(true);
      const response = await fetch(`/api/files`, {
        method: "PUT",
        body: JSON.stringify({ id: file.id, visibility }),
      });

      const { error } = (await response.json()) as ApiResponse<null>;

      if (error) return toast.error(error.message);

      toast.success(
        visibility === "private" ? "File is now private" : "File is now public",
      );
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
      router.refresh();
    }
  };

  const handleCopySignedLink = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/files/sign`, {
        method: "POST",
        body: JSON.stringify({ id: file.id }),
      });

      const { data, error } = (await response.json()) as ApiResponse<{
        url: string;
        expiresAt: string;
      }>;

      if (error) return toast.error(error.message);

      const signedUrl = new URL(data.url, window.location.origin).href;
      const success = await copyToClipboard(signedUrl);

      if (success) {
        toast.success("Signed link copied", {
          description: `Expires ${formatDate(data.expiresAt)}`,
        });
      } else {
        toast.error("Failed to copy link");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const getFileExtension = (filename: string) => {
    return filename.split(".").pop()?.toUpperCase() || "";
  };

  return (
    <>
      <Card
        key={file.id}
        data-selected={selected ? "" : undefined}
        className="group border-border/50 bg-card/50 hover:border-border hover:bg-card data-selected:border-primary data-selected:ring-primary/40 relative overflow-hidden border backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/5 data-selected:ring-2"
      >
        <CardContent className="p-0">
          {/* File Preview Area */}
          <div className="from-muted/30 to-muted/60 relative flex h-32 items-center justify-center bg-linear-to-br">
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

            {onSelectedChange && (
              <div
                className={`absolute top-2 left-2 z-10 transition-opacity ${
                  selected
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                }`}
              >
                <Checkbox
                  checked={!!selected}
                  onClick={(e) => onSelectedChange(!selected, e.shiftKey)}
                  aria-label={`Select ${file.name}`}
                  className="bg-background/80 border-border/50 size-5 shadow-sm backdrop-blur-sm"
                />
              </div>
            )}

            {isPrivate && (
              <div className="bg-background/80 border-border/50 text-muted-foreground absolute bottom-2 left-2 z-10 flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium shadow-sm backdrop-blur-sm">
                <Lock className="h-3 w-3" />
                Private
              </div>
            )}

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
                  <DropdownMenuItem
                    onClick={handleCopyLink}
                    className="cursor-pointer"
                  >
                    <LinkIcon className="mr-3 h-4 w-4" />
                    Copy link
                  </DropdownMenuItem>
                  {isPrivate && (
                    <DropdownMenuItem
                      onClick={handleCopySignedLink}
                      disabled={loading}
                      className="cursor-pointer"
                    >
                      <Clock className="mr-3 h-4 w-4" />
                      Copy signed link
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={handleToggleVisibility}
                    disabled={loading}
                    className="cursor-pointer"
                  >
                    {isPrivate ? (
                      <Globe className="mr-3 h-4 w-4" />
                    ) : (
                      <Lock className="mr-3 h-4 w-4" />
                    )}
                    {isPrivate ? "Make public" : "Make private"}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer" asChild>
                    <a
                      href={`/api/files/download/${file.id}`}
                      download
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Download className="mr-3 h-4 w-4" />
                      Download
                    </a>
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
                        <AlertDialogTitle>Delete {file.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {`This action cannot be undone. This will permanently
                            delete "${file.name}" from your storage.`}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(file.id)}
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
                {file.size > 0 && (
                  <span className="text-muted-foreground text-xs font-medium">
                    {formatBytes(file.size)}
                  </span>
                )}
              </div>
              <div className="absolute right-4 bottom-2 flex items-center gap-1">
                <span className="text-muted-foreground text-xs font-medium">
                  {formatDate(file.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rename File Dialog */}
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
                onClick={() =>
                  editingFile && handleRename(editingFile.id, newFileName)
                }
                disabled={
                  !newFileName.trim() ||
                  newFileName === editingFile?.name ||
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
