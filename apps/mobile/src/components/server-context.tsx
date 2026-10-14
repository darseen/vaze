import type Vaze from "@darseen/vaze";
import type { Me, Scope } from "@darseen/vaze";
import { createContext, useContext } from "react";
import type { AuthClient } from "@/lib/clients";
import type { Server } from "@/stores/servers";

export type ServerContextValue = {
  server: Server;
  vaze: Vaze;
  auth: AuthClient;
  me: Me;
  /** Auth headers for image loaders and downloads that bypass the SDK's fetch. */
  headers: Record<string, string>;
  can: (scope: Scope) => boolean;
  signOut: () => Promise<void>;
};

export const ServerContext = createContext<ServerContextValue | null>(null);

export function useServer() {
  const value = useContext(ServerContext);
  if (!value) throw new Error("useServer must be used inside a server screen");
  return value;
}
