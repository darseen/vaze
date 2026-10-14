import { Button } from "heroui-native";
import { ArrowRight, LogOut, Pencil, Trash2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { forgetServer, getClients } from "@/lib/clients";
import { hostOf } from "@/lib/server-url";
import { useLibrary } from "@/stores/library";
import { useServers, type Server } from "@/stores/servers";
import { ActionGroup } from "./action-group";
import { Sheet } from "./sheet";
import { SheetInput } from "./sheet-input";

type Mode = "menu" | "rename" | "remove";

type ServerActionsSheetProps = {
  server: Server | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOpen: (server: Server) => void;
};

export function ServerActionsSheet({
  server,
  isOpen,
  onOpenChange,
  onOpen,
}: ServerActionsSheetProps) {
  const update = useServers((state) => state.update);
  const remove = useServers((state) => state.remove);
  const clearLibrary = useLibrary((state) => state.clear);

  const [mode, setMode] = useState<Mode>("menu");
  const [name, setName] = useState("");

  useEffect(() => {
    if (isOpen) setMode("menu");
  }, [isOpen]);

  // stays mounted so the sheet can animate in once a server is picked
  if (!server)
    return (
      <Sheet isOpen={false} onOpenChange={onOpenChange}>
        {null}
      </Sheet>
    );

  const close = () => onOpenChange(false);

  async function signOut(target: Server) {
    close();
    update(target.id, { account: null });
    clearLibrary(target.id);
    await getClients(target)
      .auth.signOut()
      .catch(() => undefined);
  }

  async function removeServer(target: Server) {
    close();
    remove(target.id);
    clearLibrary(target.id);
    await forgetServer(target);
  }

  function saveName(target: Server) {
    const trimmed = name.trim();
    if (trimmed) update(target.id, { name: trimmed });
    close();
  }

  const titles: Record<Mode, { title: string; description: string }> = {
    menu: { title: server.name, description: hostOf(server.url) },
    rename: {
      title: "Rename server",
      description: "Only changes how it shows up on this device.",
    },
    remove: {
      title: `Remove ${server.name}?`,
      description:
        "You'll be signed out on this device. Nothing on the server is deleted.",
    },
  };

  return (
    <Sheet isOpen={isOpen} onOpenChange={onOpenChange} {...titles[mode]}>
      {mode === "menu" ? (
        <View className="gap-3">
          <ActionGroup
            actions={[
              {
                label: "Open",
                icon: ArrowRight,
                onPress: () => {
                  close();
                  onOpen(server);
                },
              },
              {
                label: "Rename",
                icon: Pencil,
                onPress: () => {
                  setName(server.name);
                  setMode("rename");
                },
              },
              {
                label: "Sign out",
                icon: LogOut,
                description: server.account?.email,
                hidden: !server.account,
                onPress: () => signOut(server),
              },
            ]}
          />
          <ActionGroup
            actions={[
              {
                label: "Remove server",
                icon: Trash2,
                danger: true,
                onPress: () => setMode("remove"),
              },
            ]}
          />
        </View>
      ) : null}

      {mode === "rename" ? (
        <View className="gap-4">
          <SheetInput
            value={name}
            onChangeText={setName}
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={() => saveName(server)}
          />
          <Button onPress={() => saveName(server)} isDisabled={!name.trim()}>
            Save
          </Button>
        </View>
      ) : null}

      {mode === "remove" ? (
        <View className="gap-3">
          <Button variant="danger" onPress={() => removeServer(server)}>
            Remove
          </Button>
          <Button variant="tertiary" onPress={() => setMode("menu")}>
            Cancel
          </Button>
        </View>
      ) : null}
    </Sheet>
  );
}
