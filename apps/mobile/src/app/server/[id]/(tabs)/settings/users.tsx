import type { User } from "@darseen/vaze";
import { Stack, useFocusEffect } from "expo-router";
import { Chip, useThemeColor, useToast } from "heroui-native";
import { UserPlus } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { LoadState } from "@/components/empty-state";
import { Icon } from "@/components/icon";
import { useServer } from "@/components/server-context";
import { SHEET_CLOSE_MS } from "@/components/sheet";
import { AddUserSheet } from "@/components/users/add-user-sheet";
import { useUserActions } from "@/components/users/user-actions";
import { UserCard } from "@/components/users/user-card";

export default function UsersScreen() {
  const { vaze, me } = useServer();
  const { toast } = useToast();
  const muted = useThemeColor("muted");
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await vaze.users.getAll();
    if (data) {
      setUsers(data.users);
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

  const actions = useUserActions(load);

  function added(name: string) {
    load();
    setTimeout(
      () =>
        toast.show({
          variant: "success",
          label: `${name} can now sign in`,
          description: "Share their password with them.",
        }),
      SHEET_CLOSE_MS,
    );
  }

  return (
    <View className="flex-1">
      <Stack.Screen
        options={{
          title: "Users",
          headerRight: () => (
            <Pressable
              onPress={() => setAdding(true)}
              hitSlop={10}
              className="px-1"
              accessibilityLabel="Add user"
            >
              <Icon icon={UserPlus} size={22} />
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
            Files are shared. Roles and scopes decide who can see and change
            them.
          </Text>
          {users ? (
            <Chip size="sm" variant="secondary">
              <Chip.Label>
                {users.length} {users.length === 1 ? "user" : "users"}
              </Chip.Label>
            </Chip>
          ) : null}
        </View>

        {users === null ? (
          <LoadState error={error} onRetry={load} />
        ) : (
          users.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              isSelf={user.id === me.user.id}
              onOptions={() => actions.open(user)}
            />
          ))
        )}
      </ScrollView>

      {actions.element}
      <AddUserSheet isOpen={adding} onOpenChange={setAdding} onAdded={added} />
    </View>
  );
}
