import {
  Button,
  Label,
  Spinner,
  TextField,
  useThemeColor,
} from "heroui-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { getClients } from "@/lib/clients";
import { PasswordInput } from "./password-input";
import { SheetInput } from "./sheet-input";

type Account = { name: string; email: string };

type RegisterFormProps = {
  server: { id: string; url: string };
  onSignedIn: (account: Account) => void;
  /** `secondary` reads better on a sheet, `primary` on a screen. */
  inputVariant?: "primary" | "secondary";
};

/** Creates a new instance's first account, its admin, like the web's register page. */
export function RegisterForm({
  server,
  onSignedIn,
  inputVariant = "secondary",
}: RegisterFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const spinnerColor = useThemeColor("accent-foreground");

  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length > 0 &&
    confirm.length > 0 &&
    !busy;

  async function submit() {
    if (!canSubmit) return;
    if (password !== confirm) return setError("Passwords don't match.");

    setBusy(true);
    setError(null);
    try {
      const { auth } = getClients(server);
      // a stale cookie would make the server check the request's origin
      if (await auth.getCookie()) await auth.signOut().catch(() => undefined);

      // the server signs the new account in, like the web
      const result = await auth.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
      });

      if (result.error) {
        setError(result.error.message ?? "Couldn't create the account.");
        return;
      }

      onSignedIn({
        name: result.data.user.name,
        email: result.data.user.email,
      });
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="gap-4">
      <TextField>
        <Label>Name</Label>
        <SheetInput
          variant={inputVariant}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
        />
      </TextField>

      <TextField>
        <Label>Email</Label>
        <SheetInput
          variant={inputVariant}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          textContentType="username"
          returnKeyType="next"
        />
      </TextField>

      <TextField>
        <Label>Password</Label>
        <PasswordInput
          variant={inputVariant}
          value={password}
          onChangeText={setPassword}
          placeholder="Create a strong password"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
        />
      </TextField>

      <TextField>
        <Label>Confirm password</Label>
        <PasswordInput
          variant={inputVariant}
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Type it again"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </TextField>

      {error ? (
        <Text className="font-normal text-sm text-danger">{error}</Text>
      ) : null}

      <Button onPress={submit} isDisabled={!canSubmit} className="mt-1">
        {busy ? <Spinner size="sm" color={spinnerColor} /> : null}
        <Button.Label>
          {busy ? "Creating account" : "Create admin account"}
        </Button.Label>
      </Button>
    </View>
  );
}
