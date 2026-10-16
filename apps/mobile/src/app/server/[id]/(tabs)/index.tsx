import { router, useFocusEffect } from "expo-router";
import { Avatar, Button, Spinner, useThemeColor } from "heroui-native";
import {
  ChevronDown,
  FileText,
  Folder,
  KeyRound,
  LayoutDashboard,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useEntryActions } from "@/components/files/entry-actions";
import { Icon } from "@/components/icon";
import {
  FileListCard,
  RequestsChart,
  StatTile,
  StorageCard,
  TypeBreakdown,
} from "@/components/overview-cards";
import { useServer } from "@/components/server-context";
import { ServerSwitcherSheet } from "@/components/server-switcher-sheet";
import { initials } from "@/lib/format";
import { hostOf } from "@/lib/server-url";
import { useLibrary } from "@/stores/library";

export default function OverviewScreen() {
  const { server, vaze, me } = useServer();
  const actions = useEntryActions();
  const muted = useThemeColor("muted");
  const [switching, setSwitching] = useState(false);
  const [pulling, setPulling] = useState(false);

  const stats = useLibrary((state) => state.stats[server.id]);
  const loadStats = useLibrary((state) => state.loadStats);

  const refresh = useCallback(
    () => loadStats(server.id, vaze),
    [loadStats, server.id, vaze],
  );

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const filesHref = {
    pathname: "/server/[id]/files",
    params: { id: server.id },
  } as const;

  const data = stats?.data;
  const firstName = me.user.name.split(" ")[0];

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="gap-4 px-5 pt-safe-offset-4 pb-8"
        contentInsetAdjustmentBehavior="never"
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            tintColor={muted}
            onRefresh={async () => {
              setPulling(true);
              await refresh();
              setPulling(false);
            }}
          />
        }
      >
        <View className="flex-row items-center justify-between pb-2">
          <Pressable
            onPress={() => setSwitching(true)}
            className="flex-1 gap-0.5"
            accessibilityLabel="Switch server"
          >
            <View className="flex-row items-center gap-1">
              <Text
                numberOfLines={1}
                className="shrink text-2xl font-semibold text-foreground"
              >
                {server.name}
              </Text>
              <Icon icon={ChevronDown} size={20} className="text-muted" />
            </View>
            <Text numberOfLines={1} className="font-normal text-sm text-muted">
              {server.name === hostOf(server.url)
                ? `Hi ${firstName}`
                : `Hi ${firstName} · ${hostOf(server.url)}`}
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              router.navigate({
                pathname: "/server/[id]/settings",
                params: { id: server.id },
              })
            }
            hitSlop={8}
            accessibilityLabel="Settings"
          >
            <Avatar size="md" color="accent" variant="soft" alt={me.user.name}>
              <Avatar.Fallback>{initials(me.user.name)}</Avatar.Fallback>
            </Avatar>
          </Pressable>
        </View>

        {!data ? (
          stats?.error ? (
            <View className="items-center gap-4 py-16">
              <Text className="font-normal text-center text-sm text-muted">
                {stats.error}
              </Text>
              <Button variant="secondary" onPress={refresh}>
                Try again
              </Button>
            </View>
          ) : (
            <View className="items-center py-16">
              <Spinner />
            </View>
          )
        ) : !data.files && !data.apiKeys ? (
          <View className="items-center gap-3 px-6 py-16">
            <View className="size-14 items-center justify-center rounded-full bg-default">
              <Icon icon={LayoutDashboard} size={26} className="text-muted" />
            </View>
            <Text className="text-lg font-semibold text-foreground">
              Nothing to show yet
            </Text>
            <Text className="font-normal text-center text-sm text-muted">
              Your account can't see files or use API keys. Ask an admin for
              access.
            </Text>
          </View>
        ) : (
          <>
            {data.files ? <StorageCard storage={data.files.storage} /> : null}

            <View className="flex-row gap-3">
              {data.files ? (
                <>
                  <StatTile
                    icon={FileText}
                    label="Files"
                    value={data.files.total}
                    onPress={() => router.navigate(filesHref)}
                  />
                  <StatTile
                    icon={Folder}
                    label="Folders"
                    value={data.files.folders}
                    onPress={() => router.navigate(filesHref)}
                  />
                </>
              ) : null}
              {data.apiKeys ? (
                <StatTile
                  icon={KeyRound}
                  label="API keys"
                  value={data.apiKeys.total}
                  onPress={() =>
                    router.push({
                      pathname: "/server/[id]/settings/keys",
                      params: { id: server.id },
                    })
                  }
                />
              ) : null}
            </View>

            {data.files ? (
              <>
                <FileListCard
                  title="Recent files"
                  description="Latest uploaded files"
                  files={data.files.recent}
                  detail="time"
                  onOpen={(file) => actions.open({ type: "file", file })}
                />
                <TypeBreakdown types={data.files.types} />
                <FileListCard
                  title="Largest files"
                  description="Files using the most space"
                  files={data.files.largest}
                  detail="size"
                  onOpen={(file) => actions.open({ type: "file", file })}
                />
              </>
            ) : null}

            {data.apiKeys ? <RequestsChart apiKeys={data.apiKeys} /> : null}
          </>
        )}
      </ScrollView>
      <View className="absolute inset-x-0 top-0 pt-safe bg-background" />

      {actions.element}
      <ServerSwitcherSheet isOpen={switching} onOpenChange={setSwitching} />
    </View>
  );
}
