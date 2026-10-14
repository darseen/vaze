import type { CreatedApiKey, Scope } from "@darseen/vaze";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import * as Clipboard from "expo-clipboard";
import {
  Button,
  cn,
  ControlField,
  Description,
  Label,
  Separator,
  Spinner,
  useThemeColor,
} from "heroui-native";
import { Check, Copy } from "lucide-react-native";
import { Fragment, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { fonts } from "@/lib/fonts";
import { formatDateTime } from "@/lib/format";
import { EXPIRY_OPTIONS, KEY_SCOPES } from "@/lib/scopes";
import { Icon } from "../icon";
import { useServer } from "../server-context";
import { Sheet } from "../sheet";
import { SheetInput } from "../sheet-input";

type GenerateKeySheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export function GenerateKeySheet({
  isOpen,
  onOpenChange,
  onCreated,
}: GenerateKeySheetProps) {
  const { vaze, can } = useServer();
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState(0);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);
  const spinnerColor = useThemeColor("accent-foreground");

  // reset on open, so the secret stays readable while the sheet slides away
  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setExpiry(0);
    setScopes(KEY_SCOPES.map(({ scope }) => scope).filter(can));
    setError(null);
    setCreated(null);
    setCopied(false);
  }, [isOpen, can]);

  const lifetime = EXPIRY_OPTIONS[expiry].ms;

  function toggle(scope: Scope, selected: boolean) {
    setError(null);
    setScopes((current) =>
      KEY_SCOPES.map((item) => item.scope).filter((item) =>
        item === scope ? selected : current.includes(item),
      ),
    );
  }

  async function generate() {
    const trimmed = name.trim();
    if (!trimmed) return setError("Give the key a name.");
    if (scopes.length === 0) return setError("Pick at least one scope.");

    setBusy(true);
    setError(null);
    const { data, error } = await vaze.keys.create({
      name: trimmed,
      scopes,
      expiresAt: lifetime ? new Date(Date.now() + lifetime) : null,
    });
    setBusy(false);

    if (!data) return setError(error.message);
    setCreated(data.key);
    onCreated();
  }

  async function copy() {
    if (!created) return;
    await Clipboard.setStringAsync(created.key);
    setCopied(true);
  }

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={created ? "API key created" : "New API key"}
      description={
        created
          ? `Copy ${created.name} now. This is the only time you'll see it.`
          : "Give it a name, only the scopes it needs, and an expiry."
      }
      scrollable
      fullHeight
    >
      <BottomSheetScrollView style={{ flex: 1 }}>
        {created ? (
          <View className="gap-4 pb-6">
            <View className="rounded-2xl border border-border bg-default-soft p-3">
              <Text
                selectable
                style={{ fontFamily: fonts.mono }}
                className="text-sm text-foreground"
              >
                {created.key}
              </Text>
            </View>
            <Button variant={copied ? "secondary" : "primary"} onPress={copy}>
              <Icon
                icon={copied ? Check : Copy}
                size={18}
                className={
                  copied
                    ? "text-accent-soft-foreground"
                    : "text-accent-foreground"
                }
              />
              <Button.Label>{copied ? "Copied" : "Copy key"}</Button.Label>
            </Button>
            <Text className="font-normal text-sm text-muted">
              Anything that uses this key acts as you, limited to its scopes.
              Keep it somewhere safe.
            </Text>
            <Button variant="tertiary" onPress={() => onOpenChange(false)}>
              Done
            </Button>
          </View>
        ) : (
          <View className="gap-6 pb-6">
            <View className="gap-2">
              <Label>Name</Label>
              <SheetInput
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  setError(null);
                }}
                placeholder="Production API, Backup script"
                returnKeyType="done"
              />
            </View>

            <View className="gap-2">
              <Label>Expires</Label>
              <View className="flex-row flex-wrap gap-2">
                {EXPIRY_OPTIONS.map((option, index) => {
                  const selected = index === expiry;
                  return (
                    <Pressable
                      key={option.label}
                      onPress={() => setExpiry(index)}
                      className={cn(
                        "rounded-2xl border px-3 py-1.5",
                        selected
                          ? "border-accent bg-accent"
                          : "border-border active:bg-default",
                      )}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                    >
                      <Text
                        className={cn(
                          "text-sm font-medium",
                          selected
                            ? "text-accent-foreground"
                            : "text-foreground",
                        )}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text className="font-normal text-sm text-muted">
                {lifetime
                  ? `Expires ${formatDateTime(new Date(Date.now() + lifetime).toISOString())}`
                  : "Works until you delete it."}
              </Text>
            </View>

            <View className="gap-2">
              <View className="gap-1">
                <Label>Scopes</Label>
                <Description>
                  What this key can do. It never goes beyond your own access.
                </Description>
              </View>
              <View className="rounded-2xl border border-border">
                {KEY_SCOPES.map((item, index) => {
                  const held = can(item.scope);
                  return (
                    <Fragment key={item.scope}>
                      {index > 0 ? <Separator /> : null}
                      <ControlField
                        isSelected={held && scopes.includes(item.scope)}
                        onSelectedChange={(selected) =>
                          toggle(item.scope, selected)
                        }
                        isDisabled={!held}
                        className="items-start gap-3 p-3"
                      >
                        <View className="flex-1 gap-1">
                          <View className="flex-row flex-wrap items-center gap-2">
                            <Label>{item.label}</Label>
                            <View className="rounded-lg bg-default px-1.5 py-0.5">
                              <Text
                                style={{ fontFamily: fonts.mono }}
                                className="text-xs text-muted"
                              >
                                {item.scope}
                              </Text>
                            </View>
                          </View>
                          <Description>
                            {held
                              ? item.description
                              : `${item.description} Your account doesn't have it.`}
                          </Description>
                        </View>
                        <ControlField.Indicator variant="checkbox" />
                      </ControlField>
                    </Fragment>
                  );
                })}
              </View>
            </View>

            {error ? (
              <Text className="font-normal text-sm text-danger">{error}</Text>
            ) : null}
            <Button onPress={generate} isDisabled={busy}>
              {busy ? <Spinner size="sm" color={spinnerColor} /> : null}
              <Button.Label>Generate key</Button.Label>
            </Button>
          </View>
        )}
      </BottomSheetScrollView>
    </Sheet>
  );
}
