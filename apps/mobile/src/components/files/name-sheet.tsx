import { Button, Spinner, useThemeColor, type InputRef } from "heroui-native";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Sheet } from "../sheet";
import { SheetInput } from "../sheet-input";

type NameSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialValue?: string;
  placeholder?: string;
  submitLabel: string;
  /** Resolves to an error message, or null once the name is saved. */
  onSubmit: (name: string) => Promise<string | null>;
};

export function NameSheet({
  isOpen,
  onOpenChange,
  title,
  initialValue = "",
  placeholder,
  submitLabel,
  onSubmit,
}: NameSheetProps) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const spinnerColor = useThemeColor("accent-foreground");
  const inputRef = useRef<InputRef>(null);

  // focusing from code leaves the sheet under the keyboard, so the user taps in
  useEffect(() => {
    if (!isOpen) {
      inputRef.current?.blur();
      return;
    }
    setValue(initialValue);
    setError(null);
  }, [isOpen, initialValue]);

  const name = value.trim();
  const unchanged = name === initialValue.trim();

  async function submit() {
    if (!name || unchanged || busy) return;
    if (name.includes("/")) {
      setError("Names can't contain a slash.");
      return;
    }

    setBusy(true);
    const message = await onSubmit(name);
    setBusy(false);

    if (message) setError(message);
    else onOpenChange(false);
  }

  return (
    <Sheet isOpen={isOpen} onOpenChange={onOpenChange} title={title}>
      <View className="gap-4">
        <SheetInput
          value={value}
          onChangeText={(text) => {
            setValue(text);
            setError(null);
          }}
          ref={inputRef}
          placeholder={placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          selectTextOnFocus
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        {error ? (
          <Text className="font-normal text-sm text-danger">{error}</Text>
        ) : null}
        <Button onPress={submit} isDisabled={!name || unchanged || busy}>
          {busy ? <Spinner size="sm" color={spinnerColor} /> : null}
          <Button.Label>{submitLabel}</Button.Label>
        </Button>
      </View>
    </Sheet>
  );
}
