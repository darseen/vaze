import { router, useRootNavigationState } from "expo-router";
import { Image } from "expo-image";
import { Avatar, Button, ListGroup, Separator } from "heroui-native";
import { Ellipsis, Plus } from "lucide-react-native";
import { Fragment, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { AddServerSheet } from "@/components/add-server-sheet";
import { Icon } from "@/components/icon";
import { ServerActionsSheet } from "@/components/server-actions-sheet";
import { initials } from "@/lib/format";
import { hostOf } from "@/lib/server-url";
import { useServers, type Server } from "@/stores/servers";

const logo = require("../../assets/logo.png");

// only the first visit after launch reopens the last dashboard
let resumed = false;

function openServer(server: Server) {
  router.push({ pathname: "/server/[id]", params: { id: server.id } });
}

export default function ServersScreen() {
  const servers = useServers((state) => state.servers);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Server | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const navigationReady = Boolean(useRootNavigationState()?.key);

  useEffect(() => {
    // a push before the navigator is ready is silently dropped
    if (resumed || !navigationReady) return;
    resumed = true;
    const { activeId, servers: saved } = useServers.getState();
    const last = saved.find((server) => server.id === activeId);
    if (last) openServer(last);
  }, [navigationReady]);

  function showActions(server: Server) {
    setSelected(server);
    setActionsOpen(true);
  }

  return (
    <View className="flex-1 bg-background">
      {servers.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-6 px-8 pt-safe pb-safe-offset-6">
          <Image
            source={logo}
            style={{ width: 72, height: 98 }}
            contentFit="contain"
          />
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
              <Image
                source={logo}
                style={{ width: 26, height: 35 }}
                contentFit="contain"
              />
              <View>
                <Text className="text-2xl font-semibold text-foreground">
                  Vaze
                </Text>
                <Text className="font-normal text-sm text-muted">
                  Pick a server to open
                </Text>
              </View>
            </View>

            <ListGroup>
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
