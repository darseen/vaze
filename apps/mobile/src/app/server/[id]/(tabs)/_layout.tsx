import { NativeTabs } from "expo-router/native-tabs";
import { useThemeColor } from "heroui-native";
import { useServer } from "@/components/server-context";
import { fonts } from "@/lib/fonts";
import { hasAnyTool } from "@/lib/tools";
import { useLibrary } from "@/stores/library";

// API keys, users and instance settings are pages inside the Settings tab
export default function TabsLayout() {
  const { server, can } = useServer();
  const canReadFiles = can("files:read");
  // shown until the server says it has none, so the common case doesn't shift
  const tools = useLibrary((state) => state.tools[server.id]?.data);
  const noTools = tools ? !hasAnyTool(tools) : false;
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
      <NativeTabs.Trigger name="tools" hidden={!canReadFiles || noTools}>
        <NativeTabs.Trigger.Icon
          sf={{
            default: "wrench.and.screwdriver",
            selected: "wrench.and.screwdriver.fill",
          }}
          md="handyman"
        />
        <NativeTabs.Trigger.Label>Tools</NativeTabs.Trigger.Label>
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
