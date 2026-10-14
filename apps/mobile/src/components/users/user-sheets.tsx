import type { User } from "@darseen/vaze";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import {
  Button,
  Description,
  Label,
  Spinner,
  TextField,
  useThemeColor,
} from "heroui-native";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { PasswordInput } from "../password-input";
import { Sheet } from "../sheet";
import { AccessPicker, type Access } from "./access-picker";

type UserSheetProps = {
  user: User | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AccessSheet({
  user,
  isOpen,
  onOpenChange,
  onSave,
}: UserSheetProps & {
  /** Resolves to an error message, or null once saved. */
  onSave: (access: Access) => Promise<string | null>;
}) {
  const spinnerColor = useThemeColor("accent-foreground");
  const [access, setAccess] = useState<Access>({ role: "viewer", scopes: [] });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen || !user) return;
    setAccess({
      role: user.role,
      scopes: user.role === "custom" ? user.customScopes : [],
    });
    setError(null);
  }, [isOpen, user]);

  async function save() {
    if (busy) return;
    if (access.role === "custom" && access.scopes.length === 0) {
      return setError("Pick at least one scope for a custom role.");
    }

    setBusy(true);
    const message = await onSave(access);
    setBusy(false);

    if (message) setError(message);
    else onOpenChange(false);
  }

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={user ? `Change access for ${user.name}` : "Change access"}
      description="Applies right away, to their sessions and their API keys alike."
      scrollable
      fullHeight
    >
      <BottomSheetScrollView style={{ flex: 1 }}>
        <View className="gap-6 pb-6">
          <AccessPicker
            value={access}
            onChange={(next) => {
              setAccess(next);
              setError(null);
            }}
            disabled={busy}
          />
          {error ? (
            <Text className="font-normal text-sm text-danger">{error}</Text>
          ) : null}
          <Button onPress={save} isDisabled={busy}>
            {busy ? <Spinner size="sm" color={spinnerColor} /> : null}
            <Button.Label>Save access</Button.Label>
          </Button>
        </View>
      </BottomSheetScrollView>
    </Sheet>
  );
}

export function ResetPasswordSheet({
  user,
  isOpen,
  onOpenChange,
  onReset,
}: UserSheetProps & {
  /** Resolves to an error message, or null once reset. */
  onReset: (password: string) => Promise<string | null>;
}) {
  const spinnerColor = useThemeColor("accent-foreground");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPassword("");
    setError(null);
  }, [isOpen]);

  async function reset() {
    if (!password || busy) return;

    setBusy(true);
    const message = await onReset(password);
    setBusy(false);

    if (message) setError(message);
    else onOpenChange(false);
  }

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={user ? `Reset password for ${user.name}` : "Reset password"}
      description="They're signed out of every device and need the new password to sign back in. Their API keys keep working."
    >
      <View className="gap-4">
        <TextField>
          <Label>New password</Label>
          <PasswordInput
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setError(null);
            }}
            autoComplete="off"
            returnKeyType="done"
            onSubmitEditing={reset}
          />
          <Description>At least 8 characters.</Description>
        </TextField>
        {error ? (
          <Text className="font-normal text-sm text-danger">{error}</Text>
        ) : null}
        <Button onPress={reset} isDisabled={!password || busy}>
          {busy ? <Spinner size="sm" color={spinnerColor} /> : null}
          <Button.Label>Reset password</Button.Label>
        </Button>
      </View>
    </Sheet>
  );
}
