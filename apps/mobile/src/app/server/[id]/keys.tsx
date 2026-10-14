import type { ApiKey } from "@darseen/vaze";
import { useFocusEffect } from "expo-router";
import { Button, Spinner, useThemeColor } from "heroui-native";
import { KeyRound, Plus } from "lucide-react-native";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { GenerateKeySheet } from "@/components/keys/generate-key-sheet";
import { useKeyActions } from "@/components/keys/key-actions";
import { KeyCard } from "@/components/keys/key-card";
import { useServer } from "@/components/server-context";
import { isKeyActive } from "@/lib/scopes";
import { useLibrary } from "@/stores/library";

export default function KeysScreen() {
  const { server, vaze } = useServer();
  const muted = useThemeColor("muted");
  const loadStats = useLibrary((state) => state.loadStats);
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await vaze.keys.getAll();
    if (data) {
      setKeys(data.keys);
      setError(null);
    } else {
      setError(error.message);
    }
  }, [vaze]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // the dashboard counts keys, so its stats change too
  const changed = useCallback(() => {
    load();
    loadStats(server.id, vaze);
  }, [load, loadStats, server.id, vaze]);

  const actions = useKeyActions(changed);
  const active = keys?.filter((key) => isKeyActive(key.lastUsed)).length ?? 0;

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="grow gap-4 px-5 pt-safe-offset-4 pb-8"
        contentInsetAdjustmentBehavior="never"
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            tintColor={muted}
            onRefresh={async () => {
              setPulling(true);
              await load();
              setPulling(false);
            }}
          />
        }
      >
        <View className="flex-row items-center gap-3 pb-2">
          <View className="flex-1 gap-0.5">
            <View className="flex-row items-center gap-2">
              <Text className="text-2xl font-semibold text-foreground">
                API keys
              </Text>
              {keys && keys.length > 0 ? (
                <View className="rounded-xl border border-border px-2 py-0.5">
                  <Text className="text-xs font-medium text-foreground">
                    {active} active
                  </Text>
                </View>
              ) : null}
            </View>
            <Text className="font-normal text-sm text-muted">
              Manage keys and their usage
            </Text>
          </View>
          <Button size="sm" onPress={() => setGenerating(true)}>
            <Icon icon={Plus} size={16} className="text-accent-foreground" />
            <Button.Label>New key</Button.Label>
          </Button>
        </View>

        {keys === null ? (
          error ? (
            <View className="flex-1 items-center justify-center gap-4 py-16">
              <Text className="font-normal text-center text-sm text-muted">
                {error}
              </Text>
              <Button variant="secondary" onPress={load}>
                Try again
              </Button>
            </View>
          ) : (
            <View className="flex-1 items-center justify-center py-16">
              <Spinner />
            </View>
          )
        ) : keys.length === 0 ? (
          <View className="items-center gap-4 rounded-3xl border border-dashed border-border px-6 py-12">
            <View className="size-14 items-center justify-center rounded-full bg-default">
              <Icon icon={KeyRound} size={26} className="text-muted" />
            </View>
            <View className="items-center gap-1">
              <Text className="text-lg font-semibold text-foreground">
                No API keys yet
              </Text>
              <Text className="font-normal text-center text-sm text-muted">
                Generate a key to use Vaze from your own apps and scripts, with
                only the access they need.
              </Text>
            </View>
            <Button onPress={() => setGenerating(true)}>Generate a key</Button>
          </View>
        ) : (
          keys.map((key) => (
            <KeyCard
              key={key.id}
              apiKey={key}
              onOptions={() => actions.open(key)}
            />
          ))
        )}
      </ScrollView>
      <View className="absolute inset-x-0 top-0 pt-safe bg-background" />

      {actions.element}
      <GenerateKeySheet
        isOpen={generating}
        onOpenChange={setGenerating}
        onCreated={changed}
      />
    </View>
  );
}
