import type Vaze from "@darseen/vaze";
import type { FileReference } from "@darseen/vaze";
import { create } from "zustand";
import { useLibrary } from "./library";

export type Upload = {
  id: string;
  batch: string;
  serverId: string;
  folderKey: string;
  name: string;
  status: "queued" | "uploading" | "done" | "failed";
  error?: string;
};

type UploadsState = {
  uploads: Upload[];
  /** Uploads one file per request so each finishes, or fails, on its own. */
  start: (
    serverId: string,
    vaze: Vaze,
    folderKey: string,
    files: FileReference[],
  ) => Promise<{ uploaded: number; failed: Upload[] }>;
};

let counter = 0;

export const useUploads = create<UploadsState>()((set, get) => ({
  uploads: [],

  start: async (serverId, vaze, folderKey, files) => {
    const batch = `${Date.now()}-${counter++}`;
    const queued: Upload[] = files.map((file, index) => ({
      id: `${batch}-${index}`,
      batch,
      serverId,
      folderKey,
      name: file.name,
      status: "queued",
    }));

    const setStatus = (id: string, next: Partial<Upload>) =>
      set((state) => ({
        uploads: state.uploads.map((upload) =>
          upload.id === id ? { ...upload, ...next } : upload,
        ),
      }));

    set((state) => ({ uploads: [...state.uploads, ...queued] }));

    for (const [index, file] of files.entries()) {
      const { id } = queued[index];
      setStatus(id, { status: "uploading" });

      const { error } = await vaze.files.upload({
        files: [file],
        ...(folderKey ? { folder: folderKey } : {}),
      });

      setStatus(
        id,
        error ? { status: "failed", error: error.message } : { status: "done" },
      );
      if (!error) useLibrary.getState().loadFolder(serverId, vaze, folderKey);
    }

    const finished = get().uploads.filter((upload) => upload.batch === batch);
    set((state) => ({
      uploads: state.uploads.filter((upload) => upload.batch !== batch),
    }));

    return {
      uploaded: finished.filter((upload) => upload.status === "done").length,
      failed: finished.filter((upload) => upload.status === "failed"),
    };
  },
}));
