import { callApi } from "@/utils/api";
import { toast } from "sonner";

type BatchResult<K extends string> = Record<K, string[]> & {
  failed: { id: string; message: string }[];
};

const itemWord = (count: number) => (count === 1 ? "item" : "items");

/** Put items back from Recently deleted, toasting how it went. Resolves the ids restored. */
export async function restoreDeleted(ids: string[]): Promise<string[]> {
  try {
    const { data, error } = await callApi<BatchResult<"restored">>(
      "/api/deleted/restore",
      "POST",
      { ids },
    );
    if (error) {
      toast.error(error.message);
      return [];
    }

    const { restored, failed } = data;
    if (failed.length === 0) {
      toast.success(
        ids.length === 1
          ? "Restored"
          : `Restored ${restored.length} ${itemWord(restored.length)}`,
      );
    } else if (restored.length === 0) {
      toast.error(failed[0].message, {
        description:
          failed.length > 1
            ? `${failed.length - 1} more could not be restored`
            : undefined,
      });
    } else {
      toast.warning(`Restored ${restored.length} of ${ids.length} items`, {
        description: failed[0].message,
      });
    }
    return restored;
  } catch {
    toast.error("Something went wrong");
    return [];
  }
}

/** Delete items in Recently deleted for good. Resolves the ids removed. */
export async function purgeDeleted(
  target: { ids: string[] } | { all: true },
): Promise<string[]> {
  try {
    const { data, error } = await callApi<BatchResult<"deleted">>(
      "/api/deleted",
      "DELETE",
      target,
    );
    if (error) {
      toast.error(error.message);
      return [];
    }

    const { deleted, failed } = data;
    if (failed.length > 0) {
      toast.warning(
        `Deleted ${deleted.length} of ${deleted.length + failed.length} items`,
        { description: failed[0].message },
      );
    } else if ("all" in target) {
      toast.success("Recently deleted emptied");
    } else {
      toast.success(
        `Deleted ${deleted.length} ${itemWord(deleted.length)} for good`,
      );
    }
    return deleted;
  } catch {
    toast.error("Something went wrong");
    return [];
  }
}

/** A toast action that takes a delete back, then refreshes the page. */
export function undoDelete(ids: string[], refresh: () => void) {
  return {
    label: "Undo",
    onClick: async () => {
      if ((await restoreDeleted(ids)).length > 0) refresh();
    },
  };
}
