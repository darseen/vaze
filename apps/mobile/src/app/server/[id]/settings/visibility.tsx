import type { InstanceSettings, Visibility } from "@darseen/vaze";
import { Stack, useFocusEffect } from "expo-router";
import {
  Button,
  ControlField,
  Description,
  Label,
  Separator,
  useThemeColor,
  useToast,
} from "heroui-native";
import { Globe, Lock, type LucideIcon } from "lucide-react-native";
import { Fragment, useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { LoadState } from "@/components/empty-state";
import { Icon } from "@/components/icon";
import { useServer } from "@/components/server-context";
import { SHEET_CLOSE_MS } from "@/components/sheet";

const OPTIONS: {
  value: Visibility;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    value: "public",
    label: "Public",
    description: "Anyone with the link can open new files.",
    icon: Globe,
  },
  {
    value: "private",
    label: "Private",
    description: "New files need an API key or a signed link to open.",
    icon: Lock,
  },
];

const pluralFiles = (count: number) =>
  `${count} ${count === 1 ? "file" : "files"}`;

export default function VisibilityScreen() {
  const { vaze } = useServer();
  const { toast } = useToast();
  const muted = useThemeColor("muted");
  const [settings, setSettings] = useState<InstanceSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await vaze.settings.get();
    if (data) {
      setSettings(data);
      setError(null);
    } else {
      setError(error.message);
    }
  }, [vaze]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function choose(value: Visibility) {
    if (!settings || saving || value === settings.defaultVisibility) return;

    const previous = settings;
    setSettings({ ...settings, defaultVisibility: value });
    setSaving(true);
    const { data, error } = await vaze.settings.update({
      defaultVisibility: value,
    });
    setSaving(false);

    if (!data) {
      setSettings(previous);
      toast.show({
        variant: "danger",
        label: "Couldn't change the default",
        description: error.message,
      });
      return;
    }

    setSettings(data);
    toast.show({
      variant: "success",
      label: `New files and folders are now ${value} by default`,
    });
  }

  async function apply() {
    if (!settings) return;
    const { defaultVisibility } = settings;
    const { data, error } =
      await vaze.settings.applyVisibility(defaultVisibility);

    const notice = data
      ? {
          variant: "success" as const,
          label: `${pluralFiles(data.updated)} made ${defaultVisibility}`,
        }
      : {
          variant: "danger" as const,
          label: "Couldn't update existing files",
          description: error.message,
        };

    if (data) load();
    setTimeout(() => toast.show(notice), SHEET_CLOSE_MS);
  }

  const visibility = settings?.defaultVisibility ?? "public";
  const other: Visibility = visibility === "private" ? "public" : "private";
  const mismatched = settings?.visibilityCounts[other] ?? 0;

  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: "Default visibility" }} />
      <ScrollView
        contentContainerClassName="grow gap-5 px-5 pt-4 pb-8"
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            tintColor={muted}
            onRefresh={async () => {
              setPulling(true);
              await load();
              setPulling(false);
            }}
          />
        }
      >
        <Text className="font-normal px-1 text-sm text-muted">
          Choose whether new files and folders start out public or private.
        </Text>

        {settings === null ? (
          <LoadState error={error} onRetry={load} />
        ) : (
          <>
            <View className="rounded-2xl border border-border">
              {OPTIONS.map((option, index) => (
                <Fragment key={option.value}>
                  {index > 0 ? <Separator /> : null}
                  <ControlField
                    isSelected={option.value === visibility}
                    onSelectedChange={() => choose(option.value)}
                    isDisabled={saving}
                    className="items-start gap-3 p-4"
                  >
                    <Icon icon={option.icon} size={20} />
                    <View className="flex-1 gap-1">
                      <Label>{option.label}</Label>
                      <Description>{option.description}</Description>
                    </View>
                    <ControlField.Indicator variant="radio" />
                  </ControlField>
                </Fragment>
              ))}
            </View>

            <Text className="font-normal px-1 text-sm text-muted">
              Applies to uploads from the app and the dashboard, and to API
              uploads that don't set a visibility. A folder is as private as the
              files inside it, so new folders follow this setting too.
            </Text>

            <View className="gap-3 rounded-2xl border border-dashed border-border p-4">
              <Text className="font-normal text-sm text-muted">
                {mismatched === 0
                  ? `Every existing file is already ${visibility}.`
                  : `${pluralFiles(mismatched)} you already uploaded ${mismatched === 1 ? "is" : "are"} still ${other}.`}
              </Text>
              <Button
                variant="secondary"
                onPress={() => setConfirming(true)}
                isDisabled={mismatched === 0 || saving}
              >
                Apply to existing files
              </Button>
            </View>
          </>
        )}
      </ScrollView>

      <ConfirmSheet
        isOpen={confirming}
        onOpenChange={setConfirming}
        title={`Make ${pluralFiles(mismatched)} ${visibility}?`}
        description={
          visibility === "private"
            ? `${mismatched === 1 ? "It" : "They"} will stop being publicly readable. Existing links break unless they are signed.`
            : `${mismatched === 1 ? "It" : "They"} will become readable by anyone with the link.`
        }
        confirmLabel={`Make ${mismatched === 1 ? "it" : "them"} ${visibility}`}
        onConfirm={apply}
      />
    </View>
  );
}
