import type Vaze from "@darseen/vaze";
import type { DeletedItem, File, Folder, Stats } from "@darseen/vaze";
import { create } from "zustand";

type Loadable<T> = { data: T | null; loading: boolean; error: string | null };

export type FolderContents = { files: File[]; folders: Folder[] };

export type DeletedContents = { items: DeletedItem[]; retentionDays: number };

type LibraryState = {
  folders: Record<string, Loadable<FolderContents>>;
  stats: Record<string, Loadable<Stats>>;
  /** `supported` is false on servers that predate Recently deleted. */
  deleted: Record<string, Loadable<DeletedContents> & { supported?: boolean }>;
  loadFolder: (serverId: string, vaze: Vaze, key: string) => Promise<void>;
  loadStats: (serverId: string, vaze: Vaze) => Promise<void>;
  loadDeleted: (serverId: string, vaze: Vaze) => Promise<void>;
  /** Drops items restored or purged, ahead of the reload. */
  forgetDeleted: (serverId: string, ids: string[]) => void;
  clear: (serverId: string) => void;
};

export const folderCacheKey = (serverId: string, key: string) =>
  `${serverId}:${key}`;

const EMPTY = { data: null, loading: false, error: null };

// keeps the last data while a reload is in flight
function patch<V extends Loadable<unknown>>(
  map: Record<string, V>,
  id: string,
  next: Partial<V>,
) {
  return { ...map, [id]: { ...(map[id] ?? EMPTY), ...next } as V };
}

export const useLibrary = create<LibraryState>()((set) => ({
  folders: {},
  stats: {},
  deleted: {},

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

  loadDeleted: async (serverId, vaze) => {
    set((state) => ({
      deleted: patch(state.deleted, serverId, { loading: true, error: null }),
    }));

    const { data, error } = await vaze.deleted.getAll();

    set((state) => ({
      deleted: patch(state.deleted, serverId, {
        loading: false,
        error: error?.message ?? null,
        ...(data ? { data } : {}),
        // an older server has no such route; any other answer means it does
        ...(data || (error && error.status !== undefined)
          ? { supported: error?.status !== 404 }
          : {}),
      }),
    }));
  },

  forgetDeleted: (serverId, ids) =>
    set((state) => {
      const current = state.deleted[serverId]?.data;
      if (!current) return state;
      const gone = new Set(ids);
      return {
        deleted: patch(state.deleted, serverId, {
          data: {
            ...current,
            items: current.items.filter((item) => !gone.has(item.id)),
          },
        }),
      };
    }),

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
      deleted: Object.fromEntries(
        Object.entries(state.deleted).filter(([id]) => id !== serverId),
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
