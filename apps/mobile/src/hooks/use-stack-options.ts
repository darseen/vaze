import type { NativeStackNavigationOptions } from "expo-router";
import { useThemeColor } from "heroui-native";
import { fonts } from "@/lib/fonts";

/** Native headers in the app's colors, for the stacks inside a tab. */
export function useStackOptions(): NativeStackNavigationOptions {
  const [background, foreground] = useThemeColor(["background", "foreground"]);

  return {
    headerStyle: { backgroundColor: background },
    headerTintColor: foreground,
    headerTitleStyle: { color: foreground, fontFamily: fonts.semibold },
    headerLargeTitleStyle: { color: foreground, fontFamily: fonts.semibold },
    headerShadowVisible: false,
    headerBackButtonDisplayMode: "minimal",
    contentStyle: { backgroundColor: background },
  };
}
