import { Stack } from "expo-router";
import { useStackOptions } from "@/hooks/use-stack-options";

export default function FilesLayout() {
  return <Stack screenOptions={useStackOptions()} />;
}
