import type { ApiKey } from "@darseen/vaze";
import { Stack, useFocusEffect } from "expo-router";
import { Button, Chip, useThemeColor } from "heroui-native";
import { KeyRound, Plus } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { EmptyState, LoadState } from "@/components/empty-state";
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
    <View className="flex-1">
      <Stack.Screen
        options={{
          title: "API keys",
          headerRight: () => (
            <Pressable
              onPress={() => setGenerating(true)}
              hitSlop={10}
              className="px-1"
              accessibilityLabel="New key"
            >
              <Icon icon={Plus} size={24} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentContainerClassName="grow gap-4 px-5 pt-4 pb-8"
        contentInsetAdjustmentBehavior="automatic"
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
        <View className="flex-row items-center gap-3 px-1">
          <Text className="font-normal flex-1 text-sm text-muted">
            Keys act as you, limited to the scopes you give them.
          </Text>
          {keys && keys.length > 0 ? (
            <Chip size="sm" variant="secondary">
              <Chip.Label>{active} active</Chip.Label>
            </Chip>
          ) : null}
        </View>

        {keys === null ? (
          <LoadState error={error} onRetry={load} />
        ) : keys.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="No API keys yet"
            message="Generate a key to use Vaze from your own apps and scripts, with only the access they need."
            action={
              <Button onPress={() => setGenerating(true)}>
                Generate a key
              </Button>
            }
          />
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

      {actions.element}
      <GenerateKeySheet
        isOpen={generating}
        onOpenChange={setGenerating}
        onCreated={changed}
      />
    </View>
  );
}
