import { useToast } from "heroui-native";
import { useServer } from "@/components/server-context";
import { parentKey, useLibrary } from "@/stores/library";

type Restorable = { id: string; key: string };

const itemWord = (count: number) => (count === 1 ? "item" : "items");

/** Puts items back from Recently deleted and reloads where they land. */
export function useRestore() {
  const { server, vaze } = useServer();
  const { toast } = useToast();
  const loadFolder = useLibrary((state) => state.loadFolder);
  const loadStats = useLibrary((state) => state.loadStats);
  const loadDeleted = useLibrary((state) => state.loadDeleted);
  const forgetDeleted = useLibrary((state) => state.forgetDeleted);

  /** Resolves the ids restored, after toasting how it went. */
  async function restore(items: Restorable[]): Promise<string[]> {
    const { data, error } = await vaze.deleted.restore(
      items.map((item) => item.id),
    );
    if (!data) {
      toast.show({
        variant: "danger",
        label: "Couldn't restore",
        description: error.message,
      });
      return [];
    }

    const { restored, failed } = data;
    forgetDeleted(server.id, restored);
    const landed = items.filter((item) => restored.includes(item.id));
    for (const key of new Set(landed.map((item) => parentKey(item.key)))) {
      loadFolder(server.id, vaze, key);
    }
    loadStats(server.id, vaze);
    loadDeleted(server.id, vaze);

    if (failed.length === 0) {
      toast.show({
        variant: "success",
        label:
          items.length === 1
            ? "Restored"
            : `Restored ${restored.length} ${itemWord(restored.length)}`,
      });
    } else {
      toast.show({
        variant: restored.length > 0 ? "warning" : "danger",
        label:
          restored.length > 0
            ? `Restored ${restored.length} of ${items.length} items`
            : items.length === 1
              ? "Couldn't restore"
              : `Couldn't restore ${failed.length} ${itemWord(failed.length)}`,
        description: failed[0].message,
      });
    }
    return restored;
  }

  /** Toast options with an Undo button that restores what was just deleted. */
  function undo(items: Restorable[]) {
    return {
      // long enough to reach for the button
      duration: 8000,
      actionLabel: "Undo",
      onActionPress: ({ hide }: { hide: () => void }) => {
        hide();
        restore(items);
      },
    };
  }

  return { restore, undo };
}
