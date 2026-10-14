import { router } from "expo-router";
import { Image } from "expo-image";
import { Avatar, Button, ListGroup, Separator } from "heroui-native";
import { Ellipsis, Plus } from "lucide-react-native";
import { Fragment, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { AddServerSheet } from "@/components/add-server-sheet";
import { Icon } from "@/components/icon";
import { ServerActionsSheet } from "@/components/server-actions-sheet";
import { initials } from "@/lib/format";
import { hostOf } from "@/lib/server-url";
import { useServers, type Server } from "@/stores/servers";

const logo = require("../../assets/logo.png");

function openServer(server: Server) {
  router.push({ pathname: "/server/[id]", params: { id: server.id } });
}

export default function ServersScreen() {
  const servers = useServers((state) => state.servers);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Server | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);

  function showActions(server: Server) {
    setSelected(server);
    setActionsOpen(true);
  }

  return (
    <View className="flex-1 bg-background">
      {servers.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-6 px-8 pt-safe pb-safe-offset-6">
          <LogoBadge size={88} />
          <View className="items-center gap-2">
            <Text className="text-2xl font-semibold text-foreground">
              Welcome to Vaze
            </Text>
            <Text className="font-normal text-center text-base text-muted">
              Connect to your self-hosted Vaze server to browse and manage your
              files.
            </Text>
          </View>
          <Button onPress={() => setAdding(true)} className="self-stretch">
            <Icon icon={Plus} size={18} className="text-accent-foreground" />
            <Button.Label>Add a server</Button.Label>
          </Button>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerClassName="gap-6 px-5 pt-safe-offset-6 pb-6"
            contentInsetAdjustmentBehavior="automatic"
          >
            <View className="flex-row items-center gap-3">
              <LogoBadge size={44} />
              <View className="flex-1">
                <Text className="text-xl font-semibold text-foreground">
                  Vaze
                </Text>
                <Text className="font-normal text-sm text-muted">
                  File hosting &amp; storage
                </Text>
              </View>
            </View>

            <View className="gap-2">
              <Text className="px-1 text-xs font-medium uppercase text-muted">
                Servers
              </Text>
              <ListGroup className="border border-border">
                {servers.map((server, index) => (
                  <Fragment key={server.id}>
                    {index > 0 ? <Separator className="mx-4" /> : null}
                    <ListGroup.Item
                      onPress={() => openServer(server)}
                      onLongPress={() => showActions(server)}
                    >
                      <ListGroup.ItemPrefix>
                        <Avatar
                          size="sm"
                          color="accent"
                          variant="soft"
                          alt={server.name}
                        >
                          <Avatar.Fallback>
                            {initials(server.name)}
                          </Avatar.Fallback>
                        </Avatar>
                      </ListGroup.ItemPrefix>
                      <ListGroup.ItemContent>
                        <ListGroup.ItemTitle numberOfLines={1}>
                          {server.name}
                        </ListGroup.ItemTitle>
                        <ListGroup.ItemDescription numberOfLines={1}>
                          {server.account
                            ? server.account.email
                            : `Signed out · ${hostOf(server.url)}`}
                        </ListGroup.ItemDescription>
                      </ListGroup.ItemContent>
                      <ListGroup.ItemSuffix>
                        <Pressable
                          onPress={() => showActions(server)}
                          hitSlop={12}
                          accessibilityLabel={`${server.name} options`}
                        >
                          <Icon icon={Ellipsis} className="text-muted" />
                        </Pressable>
                      </ListGroup.ItemSuffix>
                    </ListGroup.Item>
                  </Fragment>
                ))}
              </ListGroup>
            </View>
          </ScrollView>

          <View className="px-5 pt-2 pb-safe-offset-4">
            <Button variant="secondary" onPress={() => setAdding(true)}>
              <Icon
                icon={Plus}
                size={18}
                className="text-accent-soft-foreground"
              />
              <Button.Label>Add a server</Button.Label>
            </Button>
          </View>
        </>
      )}

      <AddServerSheet
        isOpen={adding}
        onOpenChange={setAdding}
        onAdded={openServer}
      />
      <ServerActionsSheet
        server={selected}
        isOpen={actionsOpen}
        onOpenChange={setActionsOpen}
        onOpen={openServer}
      />
    </View>
  );
}

// the amber tile the web sidebar puts behind the logo
function LogoBadge({ size }: { size: number }) {
  return (
    <View
      className="items-center justify-center rounded-3xl border border-amber-500/25 bg-amber-400/15"
      style={{ width: size, height: size }}
    >
      <Image
        source={logo}
        style={{ width: size * 0.42, height: size * 0.57 }}
        contentFit="contain"
      />
    </View>
  );
}
