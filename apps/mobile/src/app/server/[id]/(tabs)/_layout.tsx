import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useThemeColor } from "heroui-native";
import { useServer } from "@/components/server-context";
import { fonts } from "@/lib/fonts";

// API keys, users and instance settings are pages inside the Settings tab
export default function TabsLayout() {
  const canReadFiles = useServer().can("files:read");
  const [background, foreground, muted, indicator] = useThemeColor([
    "background",
    "foreground",
    "muted",
    "default",
  ]);

  return (
    <NativeTabs
      backgroundColor={background}
      tintColor={foreground}
      iconColor={{ default: muted, selected: foreground }}
      labelStyle={{
        default: { color: muted, fontFamily: fonts.medium },
        selected: { color: foreground, fontFamily: fonts.medium },
      }}
      indicatorColor={indicator}
      labelVisibilityMode="labeled"
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          md="home"
        />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="files" hidden={!canReadFiles}>
        <NativeTabs.Trigger.Icon
          sf={{ default: "folder", selected: "folder.fill" }}
          md="folder"
        />
        <NativeTabs.Trigger.Label>Files</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="activity">
        <NativeTabs.Trigger.Icon sf="clock.arrow.circlepath" md="history" />
        <NativeTabs.Trigger.Label>Activity</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon
          sf={{ default: "gearshape", selected: "gearshape.fill" }}
          md="settings"
        />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
