import { Stack } from "expo-router";
import { useStackOptions } from "@/hooks/use-stack-options";

export default function ToolsLayout() {
  return <Stack screenOptions={useStackOptions()} />;
}
