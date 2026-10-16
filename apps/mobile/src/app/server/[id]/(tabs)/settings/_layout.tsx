import { Stack } from "expo-router";
import { useStackOptions } from "@/hooks/use-stack-options";

// a link into a settings page from another tab still has Settings to go back to
export const unstable_settings = { initialRouteName: "index" };

export default function SettingsLayout() {
  return <Stack screenOptions={useStackOptions()} />;
}
