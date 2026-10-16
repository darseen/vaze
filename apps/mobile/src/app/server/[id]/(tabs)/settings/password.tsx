import { router, Stack } from "expo-router";
import {
  Button,
  ControlField,
  Description,
  Label,
  Spinner,
  TextField,
  useThemeColor,
  useToast,
} from "heroui-native";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { PasswordInput } from "@/components/password-input";
import { useServer } from "@/components/server-context";

const EMPTY = { current: "", next: "", confirm: "" };

export default function PasswordScreen() {
  const { vaze } = useServer();
  const { toast } = useToast();
  const spinnerColor = useThemeColor("accent-foreground");
  const [fields, setFields] = useState(EMPTY);
  const [revokeOthers, setRevokeOthers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const complete = Boolean(fields.current && fields.next && fields.confirm);

  const field = (key: keyof typeof EMPTY) => (text: string) => {
    setFields((current) => ({ ...current, [key]: text }));
    setError(null);
  };

  async function submit() {
    if (!complete || busy) return;
    if (fields.next !== fields.confirm) {
      return setError("The new passwords don't match.");
    }

    setBusy(true);
    setError(null);
    const { error } = await vaze.account.changePassword({
      currentPassword: fields.current,
      newPassword: fields.next,
      revokeOtherSessions: revokeOthers,
    });
    setBusy(false);

    if (error) return setError(error.message);

    toast.show({
      variant: "success",
      label: revokeOthers
        ? "Password changed and other devices signed out"
        : "Password changed",
    });
    router.back();
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: "Password" }} />
      <ScrollView
        contentContainerClassName="gap-5 px-5 pt-4 pb-8"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <TextField>
          <Label>Current password</Label>
          <PasswordInput
            variant="primary"
            value={fields.current}
            onChangeText={field("current")}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="next"
          />
        </TextField>

        <TextField>
          <Label>New password</Label>
          <PasswordInput
            variant="primary"
            value={fields.next}
            onChangeText={field("next")}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
          />
          <Description>At least 8 characters.</Description>
        </TextField>

        <TextField>
          <Label>Confirm new password</Label>
          <PasswordInput
            variant="primary"
            value={fields.confirm}
            onChangeText={field("confirm")}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={submit}
          />
        </TextField>

        <ControlField
          isSelected={revokeOthers}
          onSelectedChange={setRevokeOthers}
          className="items-center gap-3 rounded-2xl border border-border p-3"
        >
          <View className="flex-1 gap-1">
            <Label>Sign out other devices</Label>
            <Description>Keeps this phone signed in.</Description>
          </View>
          <ControlField.Indicator variant="switch" />
        </ControlField>

        {error ? (
          <Text className="font-normal text-sm text-danger">{error}</Text>
        ) : null}

        <Button onPress={submit} isDisabled={!complete || busy}>
          {busy ? <Spinner size="sm" color={spinnerColor} /> : null}
          <Button.Label>Change password</Button.Label>
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
