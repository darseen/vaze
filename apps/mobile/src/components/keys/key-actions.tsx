import type { ApiKey } from "@darseen/vaze";
import { useToast } from "heroui-native";
import { Pencil, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { formatDate } from "@/lib/format";
import { ActionGroup } from "../action-group";
import { ConfirmSheet } from "../confirm-sheet";
import { NameSheet } from "../name-sheet";
import { useServer } from "../server-context";
import { Sheet, SHEET_CLOSE_MS } from "../sheet";

type SheetName = "details" | "rename" | "delete";

/** The options sheet for an API key, plus the rename and delete it leads to. */
export function useKeyActions(onChanged: () => void) {
  const { vaze } = useServer();
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState<ApiKey | null>(null);
  const [sheet, setSheet] = useState<SheetName | null>(null);

  // a closing sheet reports false after the next one may already be open
  const closer = (name: SheetName) => (open: boolean) => {
    if (!open) setSheet((current) => (current === name ? null : current));
  };

  function open(next: ApiKey) {
    setApiKey(next);
    setSheet("details");
  }

  async function rename(name: string) {
    if (!apiKey) return null;
    const { error } = await vaze.keys.rename({ id: apiKey.id, name });
    if (error) return error.message;

    onChanged();
    return null;
  }

  async function remove() {
    if (!apiKey) return;
    const { error } = await vaze.keys.delete(apiKey.id);
    const notice = error
      ? {
          variant: "danger" as const,
          label: "Couldn't delete the key",
          description: error.message,
        }
      : { variant: "success" as const, label: `Deleted ${apiKey.name}` };

    if (!error) onChanged();
    setTimeout(() => toast.show(notice), SHEET_CLOSE_MS);
  }

  const element = (
    <>
      <Sheet
        isOpen={sheet === "details"}
        onOpenChange={closer("details")}
        title={apiKey?.name}
        description={
          apiKey ? `Created ${formatDate(apiKey.createdAt)}` : undefined
        }
      >
        <View className="gap-3">
          <ActionGroup
            actions={[
              {
                label: "Rename",
                icon: Pencil,
                onPress: () => setSheet("rename"),
              },
            ]}
          />
          <ActionGroup
            actions={[
              {
                label: "Delete key",
                icon: Trash2,
                description: "Anything using it loses access right away",
                danger: true,
                onPress: () => setSheet("delete"),
              },
            ]}
          />
        </View>
      </Sheet>
      <NameSheet
        isOpen={sheet === "rename"}
        onOpenChange={closer("rename")}
        title="Rename key"
        initialValue={apiKey?.name ?? ""}
        submitLabel="Rename"
        onSubmit={rename}
      />
      <ConfirmSheet
        isOpen={sheet === "delete"}
        onOpenChange={closer("delete")}
        title={apiKey ? `Delete ${apiKey.name}?` : "Delete key?"}
        description="Anything using this key stops working right away. This can't be undone."
        confirmLabel="Delete key"
        onConfirm={remove}
      />
    </>
  );

  return { open, element };
}
