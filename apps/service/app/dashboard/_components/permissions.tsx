"use client";

import type { Scope } from "@repo/types";
import { createContext, useCallback, useContext, type ReactNode } from "react";

// hides what the server would refuse anyway; it is not the access check itself
const PermissionsContext = createContext<Scope[]>([]);

export function PermissionsProvider({
  scopes,
  children,
}: {
  scopes: Scope[];
  children: ReactNode;
}) {
  return (
    <PermissionsContext.Provider value={scopes}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function useCan() {
  const scopes = useContext(PermissionsContext);
  return useCallback((scope: Scope) => scopes.includes(scope), [scopes]);
}
