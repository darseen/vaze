import "../global.css";

import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { HeroUINativeProvider, useThemeColor } from "heroui-native";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaListener } from "react-native-safe-area-context";
import { Uniwind, useUniwind } from "uniwind";
import { useHydrated } from "@/hooks/use-hydrated";
import { usePreferences } from "@/stores/preferences";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const hydrated = useHydrated();
  const theme = usePreferences((state) => state.theme);

  useEffect(() => {
    Uniwind.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (hydrated) SplashScreen.hideAsync();
  }, [hydrated]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaListener
        onChange={({ insets }) => {
          Uniwind.updateInsets(insets);
        }}
      >
        <HeroUINativeProvider
          config={{ toast: { defaultProps: { placement: "top" } } }}
        >
          {hydrated ? <AppStack /> : null}
        </HeroUINativeProvider>
      </SafeAreaListener>
    </GestureHandlerRootView>
  );
}

function AppStack() {
  const { theme } = useUniwind();
  const background = useThemeColor("background");

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(background);
  }, [background]);

  return (
    <>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: background },
        }}
      />
    </>
  );
}
