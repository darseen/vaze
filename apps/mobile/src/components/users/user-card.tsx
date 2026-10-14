import type { Role, User } from "@darseen/vaze";
import * as Haptics from "expo-haptics";
import { Avatar, Chip, cn } from "heroui-native";
import { EllipsisVertical } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { formatDate, initials } from "@/lib/format";
import { hasEveryScope, ROLE_INFO, SCOPE_INFO } from "@/lib/scopes";
import { Icon } from "../icon";

// the web's amber, blue, zinc and violet role badges, from the app's palette
const ROLE_TONES: Record<Role, { badge: string; text: string }> = {
  admin: { badge: "bg-warning-soft", text: "text-warning-soft-foreground" },
  editor: {
    badge: "border border-folder-badge-border bg-folder-badge",
    text: "text-folder-badge-foreground",
  },
  viewer: { badge: "bg-default", text: "text-muted" },
  custom: { badge: "bg-accent-soft", text: "text-accent-soft-foreground" },
};

type UserCardProps = {
  user: User;
  isSelf: boolean;
  onOptions: () => void;
};

export function UserCard({ user, isSelf, onOptions }: UserCardProps) {
  const tone = ROLE_TONES[user.role];
  const keys = `${user.apiKeys} ${user.apiKeys === 1 ? "API key" : "API keys"}`;

  return (
    <Pressable
      onPress={isSelf ? undefined : onOptions}
      onLongPress={
        isSelf
          ? undefined
          : () => {
              Haptics.selectionAsync();
              onOptions();
            }
      }
      className={cn(
        "gap-4 rounded-3xl border bg-surface p-4 active:opacity-80",
        user.disabled
          ? "border-dashed border-border opacity-70"
          : "border-border",
      )}
      accessibilityRole={isSelf ? undefined : "button"}
      accessibilityLabel={user.name}
    >
      <View className="flex-row items-start gap-3">
        <Avatar size="md" color="accent" variant="soft" alt={user.name}>
          <Avatar.Fallback>{initials(user.name)}</Avatar.Fallback>
        </Avatar>

        <View className="flex-1 gap-1">
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Text
              numberOfLines={1}
              className="shrink text-base font-semibold text-foreground"
            >
              {user.name}
            </Text>
            {isSelf ? (
              <Chip size="sm" variant="secondary">
                <Chip.Label>You</Chip.Label>
              </Chip>
            ) : null}
            {user.disabled ? (
              <Chip size="sm" variant="soft" color="danger">
                <Chip.Label>Disabled</Chip.Label>
              </Chip>
            ) : null}
          </View>
          <Text numberOfLines={1} className="font-normal text-sm text-muted">
            {user.email}
          </Text>
        </View>

        <View className={cn("rounded-lg px-2 py-0.5", tone.badge)}>
          <Text className={cn("text-xs font-medium", tone.text)}>
            {ROLE_INFO[user.role].label}
          </Text>
        </View>

        {isSelf ? null : (
          <Pressable
            onPress={onOptions}
            hitSlop={10}
            className="-mt-1 -mr-1 size-8 items-center justify-center rounded-xl active:bg-default"
            accessibilityLabel={`Manage ${user.name}`}
          >
            <Icon icon={EllipsisVertical} size={18} className="text-muted" />
          </Pressable>
        )}
      </View>

      <View className="flex-row flex-wrap gap-1.5">
        {hasEveryScope(user.scopes) ? (
          <ScopeTag label="Every scope" />
        ) : user.scopes.length === 0 ? (
          <Text className="font-normal text-xs text-muted">No scopes</Text>
        ) : (
          user.scopes.map((scope) => (
            <ScopeTag key={scope} label={SCOPE_INFO[scope].label} />
          ))
        )}
      </View>

      <Text className="font-normal text-xs text-muted">
        Added {formatDate(user.createdAt)} · {keys}
      </Text>
    </Pressable>
  );
}

function ScopeTag({ label }: { label: string }) {
  return (
    <View className="rounded-lg border border-border px-2 py-0.5">
      <Text className="font-normal text-xs text-foreground">{label}</Text>
    </View>
  );
}
