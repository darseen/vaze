import { Card, Label, Select, Tabs } from "heroui-native";
import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";

/** A tool's screen: what it does, then its card. */
export function ToolScroll({
  description,
  children,
}: {
  description: string;
  children: ReactNode;
}) {
  return (
    <ScrollView
      contentContainerClassName="gap-4 px-5 pt-3 pb-8"
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Text className="font-normal text-sm text-muted">{description}</Text>
      <Card className="gap-4 border border-border">{children}</Card>
    </ScrollView>
  );
}

export function Option({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <Label>{label}</Label>
      {children}
    </View>
  );
}

export type Choice<T extends string> = { value: T; label: string };

/** A row of tabs for a few short choices. */
export function ChoiceTabs<T extends string>({
  value,
  choices,
  isDisabled,
  onChange,
}: {
  value: T;
  choices: readonly Choice<T>[];
  isDisabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <Tabs
      value={value}
      // the triggers offered are the only values the tabs can report
      onValueChange={(next) => onChange(next as T)}
    >
      <Tabs.List className="w-full">
        <Tabs.Indicator />
        {choices.map((choice) => (
          <Tabs.Trigger
            key={choice.value}
            value={choice.value}
            isDisabled={isDisabled}
            // less padding keeps five short labels on one line
            className="flex-1 px-1"
          >
            <Tabs.Label>{choice.label}</Tabs.Label>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs>
  );
}

/** A choice from a list too long for tabs, picked in a sheet. */
export function ChoiceSelect<T extends string>({
  label,
  value,
  choices,
  isDisabled,
  onChange,
}: {
  /** Heads the sheet and names the control. */
  label: string;
  value: T;
  choices: readonly Choice<T>[];
  isDisabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <Select
      presentation="bottom-sheet"
      value={choices.find((choice) => choice.value === value)}
      // only the choices offered can be picked
      onValueChange={(option) => option && onChange(option.value as T)}
      isDisabled={isDisabled}
    >
      <Select.Trigger accessibilityLabel={label}>
        <Select.Value placeholder={label} />
        <Select.TriggerIndicator />
      </Select.Trigger>
      <Select.Portal>
        <Select.Overlay />
        <Select.Content presentation="bottom-sheet">
          <Select.ListLabel>{label}</Select.ListLabel>
          {choices.map((choice) => (
            <Select.Item
              key={choice.value}
              value={choice.value}
              label={choice.label}
            />
          ))}
        </Select.Content>
      </Select.Portal>
    </Select>
  );
}
