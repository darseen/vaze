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
  add: (server: Server) => void;
  update: (id: string, patch: Partial<Omit<Server, "id">>) => void;
  remove: (id: string) => void;
};

export const useServers = create<ServersState>()(
  persist(
    (set) => ({
      servers: [],
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
        })),
    }),
    {
      name: "vaze.servers",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ servers }) => ({ servers }),
    },
  ),
);

export function newServerId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
