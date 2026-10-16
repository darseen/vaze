import { router, Stack } from "expo-router";
import {
  Button,
  Description,
  Input,
  Label,
  Spinner,
  TextField,
  useThemeColor,
  useToast,
} from "heroui-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text } from "react-native";
import { useServer } from "@/components/server-context";

export default function ProfileScreen() {
  const { vaze, me, reloadMe } = useServer();
  const { toast } = useToast();
  const spinnerColor = useThemeColor("accent-foreground");
  const [name, setName] = useState(me.user.name);
  const [email, setEmail] = useState(me.user.email);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  const dirty = trimmedName !== me.user.name || trimmedEmail !== me.user.email;

  async function save() {
    if (!trimmedName || !trimmedEmail) {
      return setError("Name and email can't be empty.");
    }

    setBusy(true);
    setError(null);
    const { error } = await vaze.account.update({
      name: trimmedName,
      email: trimmedEmail,
    });

    if (error) {
      setBusy(false);
      return setError(error.message);
    }

    await reloadMe();
    setBusy(false);
    toast.show({ variant: "success", label: "Profile updated" });
    router.back();
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: "Profile" }} />
      <ScrollView
        contentContainerClassName="gap-5 px-5 pt-4 pb-8"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <TextField>
          <Label>Name</Label>
          <Input
            value={name}
            onChangeText={(text) => {
              setName(text);
              setError(null);
            }}
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
          />
        </TextField>

        <TextField>
          <Label>Email</Label>
          <Input
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setError(null);
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="done"
            onSubmitEditing={save}
          />
          <Description>
            You sign in with this address. A new one applies right away.
          </Description>
        </TextField>

        {error ? (
          <Text className="font-normal text-sm text-danger">{error}</Text>
        ) : null}

        <Button onPress={save} isDisabled={!dirty || busy}>
          {busy ? <Spinner size="sm" color={spinnerColor} /> : null}
          <Button.Label>Save changes</Button.Label>
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
