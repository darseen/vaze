import { Button, Spinner } from "heroui-native";
import { TriangleAlert, type LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { Icon } from "./icon";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  message: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <View className="items-center gap-4 rounded-3xl border border-dashed border-border px-6 py-12">
      <View className="size-14 items-center justify-center rounded-full bg-default">
        <Icon icon={icon} size={26} className="text-muted" />
      </View>
      <View className="items-center gap-1">
        <Text className="text-lg font-semibold text-foreground">{title}</Text>
        <Text className="font-normal text-center text-sm text-muted">
          {message}
        </Text>
      </View>
      {action}
    </View>
  );
}

/** A spinner, or the error that stopped the first load with a retry. */
export function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  if (!error) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <Spinner />
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center gap-4 px-6 py-16">
      <Icon icon={TriangleAlert} size={26} className="text-muted" />
      <Text className="font-normal text-center text-sm text-muted">
        {error}
      </Text>
      <Button variant="secondary" onPress={onRetry}>
        Try again
      </Button>
    </View>
  );
}
