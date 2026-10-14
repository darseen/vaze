import type { ApiKey } from "@darseen/vaze";
import * as Haptics from "expo-haptics";
import { Chip, cn } from "heroui-native";
import {
  Calendar,
  Clock,
  EllipsisVertical,
  Shield,
  Timer,
  type LucideIcon,
} from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { fonts } from "@/lib/fonts";
import { formatDate, timeAgo } from "@/lib/format";
import { isExpired, isExpiringSoon, isKeyActive } from "@/lib/scopes";
import { Icon } from "../icon";
import { useServer } from "../server-context";

type KeyCardProps = {
  apiKey: ApiKey;
  onOptions: () => void;
};

export function KeyCard({ apiKey, onOptions }: KeyCardProps) {
  const { can } = useServer();
  const active = isKeyActive(apiKey.lastUsed);
  const expired = isExpired(apiKey.expiresAt);
  const expiringSoon = !expired && isExpiringSoon(apiKey.expiresAt);

  return (
    <Pressable
      onPress={onOptions}
      onLongPress={() => {
        Haptics.selectionAsync();
        onOptions();
      }}
      className="gap-4 rounded-3xl border border-border bg-surface p-4 active:opacity-80"
      accessibilityRole="button"
      accessibilityLabel={apiKey.name}
    >
      <View className="flex-row items-start gap-3">
        <View
          className={cn(
            "size-11 items-center justify-center rounded-2xl",
            active ? "bg-success-soft" : "bg-default",
          )}
        >
          <Icon
            icon={Shield}
            size={22}
            className={active ? "text-success" : "text-muted"}
          />
        </View>

        <View className="flex-1 gap-2">
          <Text
            numberOfLines={2}
            className="text-base font-semibold text-foreground"
          >
            {apiKey.name}
          </Text>
          <View className="flex-row flex-wrap gap-1.5">
            <Chip
              size="sm"
              variant="soft"
              color={active ? "success" : "default"}
            >
              <View
                className={cn(
                  "size-1.5 rounded-full",
                  active ? "bg-success" : "bg-muted",
                )}
              />
              <Chip.Label>{active ? "Active" : "Inactive"}</Chip.Label>
            </Chip>
            {expired || expiringSoon ? (
              <Chip size="sm" variant="soft" color="danger">
                <Chip.Label>{expired ? "Expired" : "Expiring soon"}</Chip.Label>
              </Chip>
            ) : null}
          </View>
        </View>

        <Pressable
          onPress={onOptions}
          hitSlop={10}
          className="-mt-1 -mr-1 size-8 items-center justify-center rounded-xl active:bg-default"
          accessibilityLabel={`${apiKey.name} options`}
        >
          <Icon icon={EllipsisVertical} size={18} className="text-muted" />
        </Pressable>
      </View>

      <View className="flex-row flex-wrap gap-1.5">
        {apiKey.scopes.map((scope) => (
          <View key={scope} className="rounded-lg bg-default px-1.5 py-0.5">
            <Text
              style={{ fontFamily: fonts.mono }}
              className={cn(
                "text-xs text-muted",
                // the owner lost this scope, so the key can't use it
                !can(scope) && "line-through opacity-60",
              )}
            >
              {scope}
            </Text>
          </View>
        ))}
      </View>

      <View className="gap-2.5 rounded-2xl bg-default-soft p-3">
        <Detail
          icon={Calendar}
          label="Created"
          value={formatDate(apiKey.createdAt)}
        />
        <Detail
          icon={Clock}
          label="Last used"
          value={apiKey.lastUsed ? timeAgo(apiKey.lastUsed) : "Never"}
        />
        <Detail
          icon={Timer}
          label="Expires"
          value={apiKey.expiresAt ? formatDate(apiKey.expiresAt) : "Never"}
          danger={expired || expiringSoon}
        />
      </View>
    </Pressable>
  );
}

function Detail({
  icon,
  label,
  value,
  danger = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-2.5">
      <Icon icon={icon} size={16} className="text-muted" />
      <Text className="font-normal flex-1 text-sm text-muted">{label}</Text>
      <Text
        className={cn(
          "text-sm font-medium",
          danger ? "text-danger" : "text-foreground",
        )}
      >
        {value}
      </Text>
    </View>
  );
}
