import type { Visibility } from "@darseen/vaze";
import * as Clipboard from "expo-clipboard";
import { useToast } from "heroui-native";
import { useState } from "react";
import { shareFile } from "@/lib/transfer";
import { parentKey, useLibrary } from "@/stores/library";
import { ConfirmSheet } from "../confirm-sheet";
import { NameSheet } from "../name-sheet";
import { useServer } from "../server-context";
import { SHEET_CLOSE_MS } from "../sheet";
import type { Entry } from "./entry-row";
import { EntrySheet, type EntryAction } from "./entry-sheet";
import { MoveSheet } from "./move-sheet";

type SheetName = "details" | "rename" | "move" | "delete";

export const NO_SLASH = "Names can't contain a slash.";

const keyOf = (entry: Entry) =>
  entry.type === "file" ? entry.file.key : entry.folder.key;
const nameOf = (entry: Entry) =>
  entry.type === "file" ? entry.file.name : entry.folder.name;

/** The details sheet for a file or folder, plus every action it leads to. */
export function useEntryActions() {
  const { server, vaze } = useServer();
  const { toast } = useToast();
  const loadFolder = useLibrary((state) => state.loadFolder);
  const loadStats = useLibrary((state) => state.loadStats);

  const [entry, setEntry] = useState<Entry | null>(null);
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [busy, setBusy] = useState<EntryAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = (...keys: string[]) => {
    for (const key of new Set(keys)) loadFolder(server.id, vaze, key);
    loadStats(server.id, vaze);
  };

  const fail = (message: string, detail?: string) => {
    setError(detail ? `${message}: ${detail}` : message);
  };

  const notifyAfterClose = (
    variant: "success" | "danger",
    label: string,
    description?: string,
  ) => {
    setTimeout(
      () => toast.show({ variant, label, description }),
      SHEET_CLOSE_MS,
    );
  };

  // a closing sheet reports false after the next one may already be open
  const closer = (name: SheetName) => (open: boolean) => {
    if (!open) setSheet((current) => (current === name ? null : current));
  };

  function open(next: Entry) {
    setEntry(next);
    setError(null);
    setSheet("details");
  }

  async function setVisibility(target: Entry, visibility: Visibility) {
    setBusy(visibility === "private" ? "make-private" : "make-public");
    setError(null);
    const { error } =
      target.type === "file"
        ? await vaze.files.setVisibility({ id: target.file.id, visibility })
        : await vaze.folders.setVisibility({
            id: target.folder.id,
            visibility,
          });
    setBusy(null);

    if (error) return fail("Couldn't change visibility", error.message);

    if (target.type === "file")
      setEntry({ type: "file", file: { ...target.file, visibility } });
    refresh(
      parentKey(keyOf(target)),
      ...(target.type === "folder" ? [target.folder.key] : []),
    );
  }

  async function handle(action: EntryAction) {
    if (!entry) return;

    switch (action) {
      case "share": {
        if (entry.type !== "file") return;
        setBusy("share");
        setError(null);
        try {
          await shareFile(vaze, entry.file);
        } catch (error) {
          fail(
            "Couldn't share the file",
            error instanceof Error ? error.message : undefined,
          );
        } finally {
          setBusy(null);
        }
        return;
      }

      case "copy-link": {
        if (entry.type !== "file") return;
        let url = entry.file.url;

        if (entry.file.visibility === "private") {
          setBusy("copy-link");
          setError(null);
          const { data, error } = await vaze.files.sign({ id: entry.file.id });
          setBusy(null);
          if (!data) return fail("Couldn't create a link", error?.message);
          url = data.url;
        }

        await Clipboard.setStringAsync(url);
        setSheet(null);
        notifyAfterClose("success", "Link copied");
        return;
      }

      case "make-private":
      case "make-public":
        return setVisibility(
          entry,
          action === "make-private" ? "private" : "public",
        );

      case "rename":
      case "move":
      case "delete":
        setSheet(action);
    }
  }

  async function rename(name: string) {
    if (!entry) return null;
    if (name.includes("/")) return NO_SLASH;
    const { error } =
      entry.type === "file"
        ? await vaze.files.rename({ id: entry.file.id, name })
        : await vaze.folders.rename({ id: entry.folder.id, name });
    if (error) return error.message;

    refresh(parentKey(keyOf(entry)));
    return null;
  }

  async function move(destination: string) {
    if (!entry) return null;
    // an empty folder key is the root
    const { error } =
      entry.type === "file"
        ? await vaze.files.move({ id: entry.file.id, folder: destination })
        : await vaze.folders.move({ id: entry.folder.id, folder: destination });
    if (error) return error.message;

    refresh(parentKey(keyOf(entry)), destination);
    notifyAfterClose(
      "success",
      `Moved to ${destination.split("/").pop() || "All files"}`,
    );
    return null;
  }

  async function remove() {
    if (!entry) return;
    const { error } =
      entry.type === "file"
        ? await vaze.files.delete(entry.file.id)
        : await vaze.folders.delete(entry.folder.id);
    if (error)
      return notifyAfterClose("danger", "Couldn't delete", error.message);

    refresh(parentKey(keyOf(entry)));
    notifyAfterClose("success", `Deleted ${nameOf(entry)}`);
  }

  const element = (
    <>
      <EntrySheet
        entry={entry}
        isOpen={sheet === "details"}
        onOpenChange={closer("details")}
        onAction={handle}
        busy={busy}
        error={error}
      />
      <NameSheet
        isOpen={sheet === "rename"}
        onOpenChange={closer("rename")}
        title={entry?.type === "folder" ? "Rename folder" : "Rename file"}
        initialValue={entry ? nameOf(entry) : ""}
        submitLabel="Rename"
        onSubmit={rename}
      />
      <MoveSheet
        entry={entry}
        isOpen={sheet === "move"}
        onOpenChange={closer("move")}
        onMove={move}
      />
      <ConfirmSheet
        isOpen={sheet === "delete"}
        onOpenChange={closer("delete")}
        title={entry ? `Delete ${nameOf(entry)}?` : "Delete?"}
        description={
          entry?.type === "folder"
            ? "Everything inside it is deleted too. This can't be undone."
            : "This can't be undone."
        }
        confirmLabel="Delete"
        onConfirm={remove}
      />
    </>
  );

  return { open, element };
}
