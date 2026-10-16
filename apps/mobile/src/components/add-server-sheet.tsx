import {
  Button,
  Description,
  Label,
  Spinner,
  TextField,
  useThemeColor,
} from "heroui-native";
import { ArrowLeft } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { forgetServer, needsSetup, probeServer } from "@/lib/clients";
import { candidateUrls, hostOf } from "@/lib/server-url";
import { newServerId, useServers, type Server } from "@/stores/servers";
import { Icon } from "./icon";
import { RegisterForm } from "./register-form";
import { Sheet } from "./sheet";
import { SheetInput } from "./sheet-input";
import { SignInForm } from "./sign-in-form";

/** A server that answered, before its account is set up; `setup` when it has none yet. */
type Draft = { id: string; url: string; name: string; setup: boolean };

type AddServerSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (server: Server) => void;
};

export function AddServerSheet({
  isOpen,
  onOpenChange,
  onAdded,
}: AddServerSheetProps) {
  const servers = useServers((state) => state.servers);
  const add = useServers((state) => state.add);
  const update = useServers((state) => state.update);

  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const spinnerColor = useThemeColor("accent-foreground");

  const candidates = candidateUrls(address);
  const defaultName = candidates[0] ? hostOf(candidates[0]) : "Home server";

  function reset() {
    setAddress("");
    setName("");
    setDraft(null);
    setError(null);
    setBusy(false);
  }

  async function connect() {
    if (candidates.length === 0) {
      setError("That doesn't look like a server address.");
      return;
    }

    setBusy(true);
    setError(null);

    for (const url of candidates) {
      if (await probeServer(url).catch(() => false)) {
        const existing = servers.find((server) => server.url === url);
        const setup = await needsSetup(url).catch(() => false);
        setDraft({
          id: existing?.id ?? newServerId(),
          url,
          name: name.trim(),
          setup,
        });
        setBusy(false);
        return;
      }
    }

    setBusy(false);
    setError("Couldn't find a Vaze server at that address.");
  }

  function finish(account: Server["account"]) {
    if (!draft) return;

    const existing = servers.find((server) => server.id === draft.id);
    const patch = draft.name ? { account, name: draft.name } : { account };
    const server: Server = existing
      ? { ...existing, ...patch }
      : {
          ...draft,
          name: draft.name || hostOf(draft.url),
          account,
          addedAt: Date.now(),
        };

    if (existing) update(existing.id, patch);
    else add(server);

    onOpenChange(false);
    reset();
    onAdded(server);
  }

  function close(open: boolean) {
    onOpenChange(open);
    if (open) return;
    // a sign-in that never finished must not leave a cookie behind
    if (draft && !servers.some((server) => server.id === draft.id)) {
      forgetServer(draft);
    }
    reset();
  }

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={close}
      title={
        draft
          ? draft.setup
            ? "Create the admin account"
            : "Sign in"
          : "Add a server"
      }
      description={
        draft
          ? draft.setup
            ? `${hostOf(draft.url)} has no accounts yet. The first one is its admin.`
            : hostOf(draft.url)
          : "Enter the address you open Vaze on in your browser."
      }
    >
      {draft ? (
        <View className="gap-5">
          {draft.setup ? (
            <RegisterForm server={draft} onSignedIn={finish} />
          ) : (
            <SignInForm server={draft} onSignedIn={finish} />
          )}
          <Pressable
            onPress={() => setDraft(null)}
            className="flex-row items-center justify-center gap-2 py-1"
          >
            <Icon icon={ArrowLeft} size={16} className="text-muted" />
            <Text className="font-normal text-sm text-muted">
              Use a different server
            </Text>
          </Pressable>
        </View>
      ) : (
        <View className="gap-4">
          <TextField>
            <Label>Name</Label>
            <SheetInput
              value={name}
              onChangeText={setName}
              placeholder={defaultName}
              autoCapitalize="words"
              returnKeyType="next"
            />
            <Description>Optional. Only shown on this device.</Description>
          </TextField>

          <TextField isInvalid={Boolean(error)}>
            <Label>Server address</Label>
            <SheetInput
              value={address}
              onChangeText={(value) => {
                setAddress(value);
                setError(null);
              }}
              placeholder="files.example.com"
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="url"
              returnKeyType="go"
              onSubmitEditing={connect}
            />
            <Description>
              A LAN address like 192.168.1.20:3000 works too.
            </Description>
          </TextField>

          {error ? (
            <Text className="font-normal text-sm text-danger">{error}</Text>
          ) : null}

          <Button onPress={connect} isDisabled={busy || !address.trim()}>
            {busy ? <Spinner size="sm" color={spinnerColor} /> : null}
            <Button.Label>{busy ? "Connecting" : "Continue"}</Button.Label>
          </Button>
        </View>
      )}
    </Sheet>
  );
}
