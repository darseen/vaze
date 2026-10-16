import { useMemo } from "react";
import type { Entry } from "@/components/files/entry-row";
import { folderCacheKey, useLibrary } from "@/stores/library";
import { usePreferences, type SortBy } from "@/stores/preferences";

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });

function compareFiles(by: SortBy) {
  return (a: Entry & { type: "file" }, b: Entry & { type: "file" }) => {
    if (by === "size") return a.file.size - b.file.size;
    // timestamps are zero-padded, so string order is time order
    if (by === "createdAt")
      return a.file.createdAt.localeCompare(b.file.createdAt);
    return byName(a.file, b.file);
  };
}

/** A folder's cached contents whose names match `query`, folders first, in the user's sort order. */
export function useFolderEntries(
  serverId: string,
  folderKey: string,
  query = "",
) {
  const contents = useLibrary(
    (state) => state.folders[folderCacheKey(serverId, folderKey)],
  );
  const sortBy = usePreferences((state) => state.sortBy);
  const sortDirection = usePreferences((state) => state.sortDirection);
  const needle = query.trim().toLowerCase();

  const entries = useMemo<Entry[]>(() => {
    if (!contents?.data) return [];
    const direction = sortDirection === "ASC" ? 1 : -1;
    const matches = (item: { name: string }) =>
      item.name.toLowerCase().includes(needle);

    const folders = contents.data.folders
      .filter(matches)
      .sort((a, b) => byName(a, b) * (sortBy === "name" ? direction : 1))
      .map((folder): Entry => ({ type: "folder", folder }));
    const files = contents.data.files
      .filter(matches)
      .map((file) => ({ type: "file" as const, file }))
      .sort((a, b) => compareFiles(sortBy)(a, b) * direction);

    return [...folders, ...files];
  }, [contents?.data, sortBy, sortDirection, needle]);

  return { contents, entries };
}
