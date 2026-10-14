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
import { useServer } from "../server-context";
import { Sheet } from "../sheet";
import { SheetInput } from "../sheet-input";
import { AccessPicker, type Access } from "./access-picker";

const DEFAULT_ACCESS: Access = { role: "viewer", scopes: [] };

type AddUserSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new user's name once the sheet starts closing. */
  onAdded: (name: string) => void;
};

export function AddUserSheet({
  isOpen,
  onOpenChange,
  onAdded,
}: AddUserSheetProps) {
  const { vaze } = useServer();
  const spinnerColor = useThemeColor("accent-foreground");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [access, setAccess] = useState(DEFAULT_ACCESS);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setEmail("");
    setPassword("");
    setAccess(DEFAULT_ACCESS);
    setError(null);
  }, [isOpen]);

  const complete = Boolean(name.trim() && email.trim() && password);

  async function add() {
    if (!complete || busy) return;
    if (access.role === "custom" && access.scopes.length === 0) {
      return setError("Pick at least one scope for a custom role.");
    }

    setBusy(true);
    setError(null);
    const { data, error } = await vaze.users.create({
      name: name.trim(),
      email: email.trim(),
      password,
      ...access,
    });
    setBusy(false);

    if (!data) return setError(error.message);
    onOpenChange(false);
    onAdded(data.user.name);
  }

  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setError(null);
  };

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Add user"
      description="They sign in with this email and password. Their role decides what they can see and change."
      scrollable
      fullHeight
    >
      <BottomSheetScrollView style={{ flex: 1 }}>
        <View className="gap-6 pb-6">
          <TextField>
            <Label>Name</Label>
            <SheetInput
              value={name}
              onChangeText={edit(setName)}
              autoComplete="off"
              returnKeyType="next"
            />
          </TextField>

          <TextField>
            <Label>Email</Label>
            <SheetInput
              value={email}
              onChangeText={edit(setEmail)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              returnKeyType="next"
            />
          </TextField>

          <TextField>
            <Label>Password</Label>
            <PasswordInput
              value={password}
              onChangeText={edit(setPassword)}
              autoComplete="off"
            />
            <Description>
              At least 8 characters. Share it with them; they can change it in
              Settings.
            </Description>
          </TextField>

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
          <Button onPress={add} isDisabled={!complete || busy}>
            {busy ? <Spinner size="sm" color={spinnerColor} /> : null}
            <Button.Label>Add user</Button.Label>
          </Button>
        </View>
      </BottomSheetScrollView>
    </Sheet>
  );
}
