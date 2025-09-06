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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { File } from "@/db";
import { Download, Edit, MoreVertical, Share, Trash2 } from "lucide-react";
import { Dispatch, SetStateAction } from "react";

interface Props {
  filteredFiles: File[];
  setEditingFile: Dispatch<SetStateAction<File | null>>;
  setNewFileName: Dispatch<SetStateAction<string>>;
  viewMode: string;
}

export default function FilesList({
  filteredFiles,
  setEditingFile,
  setNewFileName,
  viewMode,
}: Props) {
  return (
    <div
      className={
        viewMode === "grid"
          ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          : "space-y-2"
      }
    >
      {filteredFiles.map((file) => (
        <Card key={file.id} className="group transition-shadow hover:shadow-md">
          <CardContent
            className={`p-4 ${viewMode === "list" ? "flex items-center justify-between" : ""}`}
          >
            <div
              className={`flex items-center gap-3 ${viewMode === "list" ? "flex-1" : "mb-3"}`}
            >
              {/* <div className="flex-shrink-0">
                {file.type === "folder" ? (
                  <Folder className="text-accent h-8 w-8" />
                ) : (
                  <FileIcon className="text-muted-foreground h-8 w-8" />
                )}
              </div> */}
              <div className="min-w-0 flex-1">
                <h3 className="text-foreground truncate font-medium text-balance">
                  {file.name}
                </h3>
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  {file.size && (
                    <>
                      <span>•</span>
                      <span>{file.size}</span>
                    </>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    Shared
                  </Badge>
                </div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setEditingFile(file);
                    setNewFileName(file.name);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Share className="mr-2 h-4 w-4" />
                  Share
                </DropdownMenuItem>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {file.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently
                        delete {file.name}.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {}}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
