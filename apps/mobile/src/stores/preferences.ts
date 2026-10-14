import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type SortBy = "name" | "createdAt" | "size";
export type SortDirection = "ASC" | "DESC";
export type ThemePreference = "system" | "light" | "dark";
export type FileView = "grid" | "list";

type PreferencesState = {
  sortBy: SortBy;
  sortDirection: SortDirection;
  theme: ThemePreference;
  fileView: FileView;
  setSort: (sortBy: SortBy, sortDirection: SortDirection) => void;
  setTheme: (theme: ThemePreference) => void;
  setFileView: (fileView: FileView) => void;
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      sortBy: "name",
      sortDirection: "ASC",
      theme: "system",
      fileView: "grid",
      setSort: (sortBy, sortDirection) => set({ sortBy, sortDirection }),
      setTheme: (theme) => set({ theme }),
      setFileView: (fileView) => set({ fileView }),
    }),
    {
      name: "vaze.preferences",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ sortBy, sortDirection, theme, fileView }) => ({
        sortBy,
        sortDirection,
        theme,
        fileView,
      }),
    },
  ),
);
