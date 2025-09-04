"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { File } from "@/db";
import { FileIcon } from "lucide-react";
import { useEffect, useState } from "react";
import ActionBar from "./_components/action-bar";
import FilesList from "./_components/files-list";

export default function Dashboard() {
  const [files, setFiles] = useState<File[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [editingFile, setEditingFile] = useState<File | null>(null);
  const [newFileName, setNewFileName] = useState("");

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleRename = (id: string, newName: string) => {
    setFiles(
      files.map((file) => (file.id === id ? { ...file, name: newName } : file)),
    );
    setEditingFile(null);
    setNewFileName("");
  };

  useEffect(() => {
    const fetchFiles = async () => {
      const result = await fetch("/api/files", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const { data } = await result.json();
      setFiles(data.files);
    };
    fetchFiles();
  }, []);

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-6">
        <ActionBar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />

        <FilesList
          filteredFiles={filteredFiles}
          viewMode={viewMode}
          setEditingFile={setEditingFile}
          setNewFileName={setNewFileName}
        />
        {filteredFiles.length === 0 && (
          <div className="py-12 text-center">
            <FileIcon className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <h3 className="text-foreground mb-2 text-lg font-medium">
              No files found
            </h3>
            <p className="text-muted-foreground">
              {searchTerm
                ? "Try adjusting your search terms"
                : "Upload your first file to get started"}
            </p>
          </div>
        )}
      </div>

      {/* Rename Dialog */}
      <Dialog open={!!editingFile} onOpenChange={() => setEditingFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename {editingFile?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="Enter new name"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingFile(null)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  editingFile && handleRename(editingFile.id, newFileName)
                }
                disabled={!newFileName.trim()}
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
