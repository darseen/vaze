import type { ErrorBoundaryProps } from "expo-router";
import { TriangleAlert } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { Icon } from "./icon";

type CrashScreenProps = ErrorBoundaryProps & {
  /** Somewhere safe to go instead, when there is one. */
  leave?: { label: string; onPress: () => void };
};

/** Replaces a screen that crashed so the app stays open; plain views, as it may render outside the providers. */
export function CrashScreen({ error, retry, leave }: CrashScreenProps) {
  return (
    <View className="flex-1 items-center justify-center gap-5 bg-background px-8">
      <View className="size-14 items-center justify-center rounded-full bg-default">
        <Icon icon={TriangleAlert} size={26} className="text-muted" />
      </View>
      <View className="items-center gap-1">
        <Text className="text-lg font-semibold text-foreground">
          Something went wrong
        </Text>
        <Text
          numberOfLines={4}
          className="font-normal text-center text-sm text-muted"
        >
          {error.message || "This screen ran into an error."}
        </Text>
      </View>
      <View className="flex-row gap-3">
        {leave ? (
          <Pressable
            onPress={leave.onPress}
            className="rounded-full border border-border px-5 py-3 active:opacity-80"
            accessibilityRole="button"
          >
            <Text className="text-sm font-medium text-foreground">
              {leave.label}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={retry}
          className="rounded-full bg-accent px-5 py-3 active:opacity-80"
          accessibilityRole="button"
        >
          <Text className="text-sm font-medium text-accent-foreground">
            Try again
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
