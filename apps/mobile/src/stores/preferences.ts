import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type SortBy = "name" | "createdAt" | "size";
export type SortDirection = "ASC" | "DESC";
export type ThemePreference = "system" | "light" | "dark";

type PreferencesState = {
  sortBy: SortBy;
  sortDirection: SortDirection;
  theme: ThemePreference;
  setSort: (sortBy: SortBy, sortDirection: SortDirection) => void;
  setTheme: (theme: ThemePreference) => void;
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      sortBy: "name",
      sortDirection: "ASC",
      theme: "system",
      setSort: (sortBy, sortDirection) => set({ sortBy, sortDirection }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: "vaze.preferences",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ sortBy, sortDirection, theme }) => ({
        sortBy,
        sortDirection,
        theme,
      }),
    },
  ),
);
