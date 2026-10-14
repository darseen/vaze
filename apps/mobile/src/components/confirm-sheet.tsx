import { Button, Spinner, useThemeColor } from "heroui-native";
import { useState } from "react";
import { View } from "react-native";
import { Sheet } from "./sheet";

type ConfirmSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
};

export function ConfirmSheet({
  isOpen,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: ConfirmSheetProps) {
  const [busy, setBusy] = useState(false);
  const spinnerColor = useThemeColor("danger-foreground");

  async function confirm() {
    setBusy(true);
    await onConfirm();
    setBusy(false);
    onOpenChange(false);
  }

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
    >
      <View className="gap-3">
        <Button variant="danger" onPress={confirm} isDisabled={busy}>
          {busy ? <Spinner size="sm" color={spinnerColor} /> : null}
          <Button.Label>{confirmLabel}</Button.Label>
        </Button>
        <Button
          variant="tertiary"
          onPress={() => onOpenChange(false)}
          isDisabled={busy}
        >
          Cancel
        </Button>
      </View>
    </Sheet>
  );
}
