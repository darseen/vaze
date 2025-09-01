import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Filter, Grid3X3, List, Plus, Search, Upload } from "lucide-react";
import { Dispatch, SetStateAction } from "react";

interface Props {
  setSearchTerm: Dispatch<SetStateAction<string>>;
  searchTerm: string;
  viewMode: string;
  setViewMode: Dispatch<SetStateAction<"grid" | "list">>;
}

export default function ActionBar({
  searchTerm,
  setSearchTerm,
  viewMode,
  setViewMode,
}: Props) {
  const handleUpload = () => {};

  const handleCreateFolder = () => {};

  return (
    <div className="mb-6 flex w-full flex-col-reverse gap-4 sm:flex-row sm:justify-center">
      <div className="flex gap-2">
        <Button onClick={handleUpload} className="flex-1 sm:flex-none">
          <Upload className="mr-2 h-4 w-4" />
          Upload
        </Button>
        <Button
          variant="outline"
          onClick={handleCreateFolder}
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

        <div className="flex gap-1">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grid")}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
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
  );
}
