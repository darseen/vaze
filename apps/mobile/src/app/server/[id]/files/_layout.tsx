import { Stack } from "expo-router";
import { useThemeColor } from "heroui-native";
import { fonts } from "@/lib/fonts";

export default function FilesLayout() {
  const [background, foreground] = useThemeColor(["background", "foreground"]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: background },
        headerTintColor: foreground,
        headerTitleStyle: { color: foreground, fontFamily: fonts.semibold },
        headerLargeTitleStyle: {
          color: foreground,
          fontFamily: fonts.semibold,
        },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: background },
      }}
    />
  );
}
