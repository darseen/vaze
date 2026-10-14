import type Vaze from "@darseen/vaze";
import type { File, Folder, Stats } from "@darseen/vaze";
import { create } from "zustand";

type Loadable<T> = { data: T | null; loading: boolean; error: string | null };

export type FolderContents = { files: File[]; folders: Folder[] };

type LibraryState = {
  folders: Record<string, Loadable<FolderContents>>;
  stats: Record<string, Loadable<Stats>>;
  loadFolder: (serverId: string, vaze: Vaze, key: string) => Promise<void>;
  loadStats: (serverId: string, vaze: Vaze) => Promise<void>;
  clear: (serverId: string) => void;
};

export const folderCacheKey = (serverId: string, key: string) =>
  `${serverId}:${key}`;

const EMPTY = { data: null, loading: false, error: null };

// keeps the last data while a reload is in flight
function patch<T>(
  map: Record<string, Loadable<T>>,
  id: string,
  next: Partial<Loadable<T>>,
) {
  return { ...map, [id]: { ...(map[id] ?? EMPTY), ...next } };
}

export const useLibrary = create<LibraryState>()((set) => ({
  folders: {},
  stats: {},

  loadFolder: async (serverId, vaze, key) => {
    const id = folderCacheKey(serverId, key);
    set((state) => ({
      folders: patch(state.folders, id, { loading: true, error: null }),
    }));

    const { data, error } = await vaze.folders.get(key ? { key } : undefined);

    set((state) => ({
      folders: patch(state.folders, id, {
        loading: false,
        error: error?.message ?? null,
        ...(data ? { data } : {}),
      }),
    }));
  },

  loadStats: async (serverId, vaze) => {
    set((state) => ({
      stats: patch(state.stats, serverId, { loading: true, error: null }),
    }));

    const { data, error } = await vaze.stats();

    set((state) => ({
      stats: patch(state.stats, serverId, {
        loading: false,
        error: error?.message ?? null,
        ...(data ? { data } : {}),
      }),
    }));
  },

  clear: (serverId) =>
    set((state) => ({
      folders: Object.fromEntries(
        Object.entries(state.folders).filter(
          ([id]) => !id.startsWith(`${serverId}:`),
        ),
      ),
      stats: Object.fromEntries(
        Object.entries(state.stats).filter(([id]) => id !== serverId),
      ),
    })),
}));

export function parentKey(key: string) {
  const index = key.lastIndexOf("/");
  return index === -1 ? "" : key.slice(0, index);
}

export function joinKey(parent: string, name: string) {
  return parent ? `${parent}/${name}` : name;
}
