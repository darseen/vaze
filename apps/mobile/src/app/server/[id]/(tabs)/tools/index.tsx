import { Stack, useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { Wrench } from "lucide-react-native";
import { useState } from "react";
import { RefreshControl, ScrollView, Text } from "react-native";
import { EmptyState, LoadState } from "@/components/empty-state";
import { ListSection } from "@/components/list-section";
import { useServer } from "@/components/server-context";
import { hasAnyTool, TOOL_GROUPS, type ToolGroupKey } from "@/lib/tools";
import { useLibrary } from "@/stores/library";

const ROUTES = {
  conversion: "/server/[id]/conversion/[tool]",
  pdf: "/server/[id]/pdf/[tool]",
} as const satisfies Record<ToolGroupKey, string>;

export default function ToolsScreen() {
  const router = useRouter();
  const { server, vaze } = useServer();
  const tools = useLibrary((state) => state.tools[server.id]);
  const loadTools = useLibrary((state) => state.loadTools);
  const muted = useThemeColor("muted");
  const [pulling, setPulling] = useState(false);
  const available = tools?.data ?? null;

  return (
    <>
      <Stack.Screen options={{ title: "Tools", headerLargeTitle: true }} />
      <ScrollView
        contentContainerClassName="grow gap-6 px-5 pt-3 pb-8"
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            tintColor={muted}
            onRefresh={async () => {
              setPulling(true);
              await loadTools(server.id, vaze);
              setPulling(false);
            }}
          />
        }
      >
        {available === null ? (
          <LoadState
            error={tools?.loading === false ? tools.error : null}
            onRetry={() => loadTools(server.id, vaze)}
          />
        ) : hasAnyTool(available) ? (
          <>
            <Text className="font-normal text-sm text-muted">
              Files are converted on {server.name}, and the results aren&apos;t
              kept there, so save or share them.
            </Text>
            {(Object.keys(TOOL_GROUPS) as ToolGroupKey[]).map((key) => (
              <ListSection
                key={key}
                title={TOOL_GROUPS[key].title}
                rows={TOOL_GROUPS[key].tools.map((tool) => ({
                  label: tool.title,
                  icon: tool.icon,
                  description: tool.description,
                  hidden: !tool.available(available),
                  onPress: () =>
                    router.push({
                      pathname: ROUTES[key],
                      params: { id: server.id, tool: tool.slug },
                    }),
                }))}
              />
            ))}
          </>
        ) : (
          <EmptyState
            icon={Wrench}
            title="No tools on this server"
            message="It runs an older Vaze, or its admin turned Conversion and the PDF tools off."
          />
        )}
      </ScrollView>
    </>
  );
}
