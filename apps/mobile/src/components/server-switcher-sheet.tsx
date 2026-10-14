import { router } from "expo-router";
import { Avatar, ListGroup, Separator } from "heroui-native";
import { Check, Server as ServerIcon } from "lucide-react-native";
import { Fragment } from "react";
import { View } from "react-native";
import { initials } from "@/lib/format";
import { hostOf } from "@/lib/server-url";
import { useServers } from "@/stores/servers";
import { ActionGroup } from "./action-group";
import { Icon } from "./icon";
import { useServer } from "./server-context";
import { Sheet } from "./sheet";

type ServerSwitcherSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ServerSwitcherSheet({
  isOpen,
  onOpenChange,
}: ServerSwitcherSheetProps) {
  const { server: current } = useServer();
  const servers = useServers((state) => state.servers);

  function choose(id: string) {
    onOpenChange(false);
    if (id !== current.id)
      router.replace({ pathname: "/server/[id]", params: { id } });
  }

  return (
    <Sheet isOpen={isOpen} onOpenChange={onOpenChange} title="Servers">
      <View className="gap-3">
        <ListGroup variant="secondary">
          {servers.map((server, index) => (
            <Fragment key={server.id}>
              {index > 0 ? <Separator className="mx-4" /> : null}
              <ListGroup.Item onPress={() => choose(server.id)}>
                <ListGroup.ItemPrefix>
                  <Avatar
                    size="sm"
                    color="accent"
                    variant="soft"
                    alt={server.name}
                  >
                    <Avatar.Fallback>{initials(server.name)}</Avatar.Fallback>
                  </Avatar>
                </ListGroup.ItemPrefix>
                <ListGroup.ItemContent>
                  <ListGroup.ItemTitle numberOfLines={1}>
                    {server.name}
                  </ListGroup.ItemTitle>
                  <ListGroup.ItemDescription numberOfLines={1}>
                    {server.account?.email ?? hostOf(server.url)}
                  </ListGroup.ItemDescription>
                </ListGroup.ItemContent>
                {server.id === current.id ? (
                  <ListGroup.ItemSuffix>
                    <Icon
                      icon={Check}
                      size={18}
                      className="text-accent-soft-foreground"
                    />
                  </ListGroup.ItemSuffix>
                ) : null}
              </ListGroup.Item>
            </Fragment>
          ))}
        </ListGroup>
        <ActionGroup
          actions={[
            {
              label: "Manage servers",
              icon: ServerIcon,
              onPress: () => {
                onOpenChange(false);
                router.dismissTo("/");
              },
            },
          ]}
        />
      </View>
    </Sheet>
  );
}
