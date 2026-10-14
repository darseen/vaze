import {
  Button,
  Label,
  Spinner,
  TextField,
  useThemeColor,
} from "heroui-native";
import { Eye, EyeOff } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { getClients } from "@/lib/clients";
import { Icon } from "./icon";
import { SheetInput } from "./sheet-input";

type Account = { name: string; email: string };

type SignInFormProps = {
  server: { id: string; url: string };
  onSignedIn: (account: Account) => void;
  /** `secondary` reads better on a sheet, `primary` on a screen. */
  inputVariant?: "primary" | "secondary";
};

export function SignInForm({
  server,
  onSignedIn,
  inputVariant = "secondary",
}: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const spinnerColor = useThemeColor("accent-foreground");

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);

    try {
      const { auth } = getClients(server);
      // a stale cookie would make the server check the request's origin
      if (await auth.getCookie()) await auth.signOut().catch(() => undefined);

      const result = await auth.signIn.email({
        email: email.trim(),
        password,
      });

      if (result.error) {
        setError(result.error.message ?? "Couldn't sign in.");
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
        <View className="justify-center">
          <SheetInput
            variant={inputVariant}
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            className="pr-12"
          />
          <Pressable
            onPress={() => setShowPassword((value) => !value)}
            hitSlop={12}
            accessibilityLabel={
              showPassword ? "Hide password" : "Show password"
            }
            className="absolute right-4"
          >
            <Icon
              icon={showPassword ? EyeOff : Eye}
              size={18}
              className="text-muted"
            />
          </Pressable>
        </View>
      </TextField>

      {error ? (
        <Text className="font-normal text-sm text-danger">{error}</Text>
      ) : null}

      <Button onPress={submit} isDisabled={!canSubmit} className="mt-1">
        {busy ? <Spinner size="sm" color={spinnerColor} /> : null}
        <Button.Label>{busy ? "Signing in" : "Sign in"}</Button.Label>
      </Button>
    </View>
  );
}
