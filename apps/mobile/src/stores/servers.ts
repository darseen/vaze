import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Server = {
  id: string;
  url: string;
  name: string;
  /** The account last signed in here, shown on the server list. */
  account: { name: string; email: string } | null;
  addedAt: number;
};

type ServersState = {
  servers: Server[];
  /** The dashboard open when the app was last closed, reopened on launch. */
  activeId: string | null;
  add: (server: Server) => void;
  update: (id: string, patch: Partial<Omit<Server, "id">>) => void;
  remove: (id: string) => void;
  setActive: (id: string | null) => void;
};

export const useServers = create<ServersState>()(
  persist(
    (set) => ({
      servers: [],
      activeId: null,
      add: (server) =>
        set((state) => ({ servers: [...state.servers, server] })),
      update: (id, patch) =>
        set((state) => ({
          servers: state.servers.map((server) =>
            server.id === id ? { ...server, ...patch } : server,
          ),
        })),
      remove: (id) =>
        set((state) => ({
          servers: state.servers.filter((server) => server.id !== id),
          activeId: state.activeId === id ? null : state.activeId,
        })),
      setActive: (activeId) => set({ activeId }),
    }),
    {
      name: "vaze.servers",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ servers, activeId }) => ({ servers, activeId }),
    },
  ),
);

export function newServerId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
