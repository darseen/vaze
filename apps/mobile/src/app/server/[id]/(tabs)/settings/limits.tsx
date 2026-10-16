import type { Limits } from "@darseen/vaze";
import { router, Stack } from "expo-router";
import {
  Button,
  Description,
  Input,
  Label,
  Spinner,
  Tabs,
  useThemeColor,
  useToast,
} from "heroui-native";
import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { LoadState } from "@/components/empty-state";
import { useServer } from "@/components/server-context";

type Unit = { label: string; factor: number };

const SIZE_UNITS: Unit[] = [
  { label: "KB", factor: 1024 },
  { label: "MB", factor: 1024 ** 2 },
  { label: "GB", factor: 1024 ** 3 },
  { label: "TB", factor: 1024 ** 4 },
];

const DURATION_UNITS: Unit[] = [
  { label: "Sec", factor: 1 },
  { label: "Min", factor: 60 },
  { label: "Hours", factor: 60 * 60 },
  { label: "Days", factor: 24 * 60 * 60 },
];

const DAY_UNITS: Unit[] = [{ label: "days", factor: 1 }];

// mirrors FIELDS in the web limits form
const FIELDS: {
  key: keyof Limits;
  label: string;
  description: string;
  units: Unit[];
}[] = [
  {
    key: "maxUploadSize",
    label: "Maximum upload size",
    description: "Largest single file an upload may contain.",
    units: SIZE_UNITS,
  },
  {
    key: "hostingCacheMaxAge",
    label: "Public cache lifetime",
    description:
      "How long browsers and CDNs may reuse a public file before checking for changes. 0 checks every time.",
    units: DURATION_UNITS,
  },
  {
    key: "defaultPresignTtl",
    label: "Default signed link lifetime",
    description: "Used when a signing request doesn't ask for a lifetime.",
    units: DURATION_UNITS,
  },
  {
    key: "maxPresignTtl",
    label: "Maximum signed link lifetime",
    description: "Longer requests are shortened to this.",
    units: DURATION_UNITS,
  },
  {
    key: "activityRetentionDays",
    label: "Activity history",
    description: "Activity entries older than this are deleted.",
    units: DAY_UNITS,
  },
  {
    key: "apiRequestRetentionDays",
    label: "API request log",
    description:
      "Older request records are deleted. They feed the API usage chart.",
    units: DAY_UNITS,
  },
];

type Field = { amount: string; unit: number };
type Fields = Record<keyof Limits, Field>;

// show a value in the largest unit that divides it evenly
function split(value: number, units: Unit[]): Field {
  const unit =
    units.findLast((u) => value >= u.factor && value % u.factor === 0) ??
    units[0];
  return { amount: String(value / unit.factor), unit: unit.factor };
}

function toFields(limits: Limits) {
  return Object.fromEntries(
    FIELDS.map(({ key, units }) => [key, split(limits[key], units)]),
  ) as Fields;
}

function toValue({ amount, unit }: Field): number {
  const trimmed = amount.trim().replace(",", ".");
  return trimmed === "" ? NaN : Math.round(Number(trimmed) * unit);
}

export default function LimitsScreen() {
  const { vaze } = useServer();
  const { toast } = useToast();
  const spinnerColor = useThemeColor("accent-foreground");
  const [saved, setSaved] = useState<Limits | null>(null);
  const [fields, setFields] = useState<Fields | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await vaze.settings.get();
    if (data) {
      setSaved(data.limits);
      setFields(toFields(data.limits));
      setLoadError(null);
    } else {
      setLoadError(error.message);
    }
  }, [vaze]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty =
    saved !== null &&
    fields !== null &&
    FIELDS.some(({ key }) => toValue(fields[key]) !== saved[key]);

  function setField(key: keyof Limits, change: Partial<Field>) {
    setError(null);
    setFields((current) =>
      current ? { ...current, [key]: { ...current[key], ...change } } : current,
    );
  }

  async function save() {
    if (!fields || busy) return;

    const limits = {} as Limits;
    for (const { key, label } of FIELDS) {
      const value = toValue(fields[key]);
      if (!Number.isFinite(value))
        return setError(`Enter a number for ${label}.`);
      limits[key] = value;
    }

    setBusy(true);
    setError(null);
    const { data, error } = await vaze.settings.update({ limits });
    setBusy(false);

    if (!data) return setError(error.message);

    setSaved(data.limits);
    setFields(toFields(data.limits));
    toast.show({ variant: "success", label: "Limits saved" });
    router.back();
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: "Limits" }} />
      <ScrollView
        contentContainerClassName="grow gap-4 px-5 pt-4 pb-8"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="font-normal px-1 text-sm text-muted">
          Changes apply right away, no restart needed. The matching environment
          variables only set the starting values.
        </Text>

        {fields === null ? (
          <LoadState error={loadError} onRetry={load} />
        ) : (
          <>
            {FIELDS.map(({ key, label, description, units }) => (
              <View
                key={key}
                className="gap-3 rounded-3xl border border-border bg-surface p-4"
              >
                <Label>{label}</Label>
                <View className="flex-row items-center gap-3">
                  <Input
                    value={fields[key].amount}
                    onChangeText={(amount) => setField(key, { amount })}
                    keyboardType="decimal-pad"
                    className="flex-1"
                    accessibilityLabel={label}
                  />
                  {units.length === 1 ? (
                    <Text className="font-normal text-sm text-muted">
                      {units[0].label}
                    </Text>
                  ) : null}
                </View>
                {units.length > 1 ? (
                  <Tabs
                    value={String(fields[key].unit)}
                    onValueChange={(value) =>
                      setField(key, { unit: Number(value) })
                    }
                  >
                    <Tabs.List className="w-full">
                      <Tabs.Indicator />
                      {units.map((unit) => (
                        <Tabs.Trigger
                          key={unit.factor}
                          value={String(unit.factor)}
                          className="flex-1"
                        >
                          <Tabs.Label>{unit.label}</Tabs.Label>
                        </Tabs.Trigger>
                      ))}
                    </Tabs.List>
                  </Tabs>
                ) : null}
                <Description>{description}</Description>
              </View>
            ))}

            {error ? (
              <Text className="font-normal text-sm text-danger">{error}</Text>
            ) : null}

            <Button onPress={save} isDisabled={!dirty || busy}>
              {busy ? <Spinner size="sm" color={spinnerColor} /> : null}
              <Button.Label>Save limits</Button.Label>
            </Button>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
