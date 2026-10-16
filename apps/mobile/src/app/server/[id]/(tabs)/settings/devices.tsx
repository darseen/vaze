import type { Session } from "@darseen/vaze";
import { Stack, useFocusEffect } from "expo-router";
import {
  Button,
  Chip,
  ListGroup,
  Separator,
  useThemeColor,
  useToast,
} from "heroui-native";
import { Laptop, Smartphone } from "lucide-react-native";
import { Fragment, useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { LoadState } from "@/components/empty-state";
import { Icon } from "@/components/icon";
import { useServer } from "@/components/server-context";
import { SHEET_CLOSE_MS } from "@/components/sheet";
import { formatDate, formatIpAddress } from "@/lib/format";
import { describeUserAgent, isMobileUserAgent } from "@/lib/user-agent";

// the confirm sheet either signs out one device or every other one
type Pending = { kind: "one"; session: Session } | { kind: "others" };

export default function DevicesScreen() {
  const { vaze } = useServer();
  const { toast } = useToast();
  const muted = useThemeColor("muted");
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await vaze.account.getSessions();
    if (data) {
      setSessions(data.sessions);
      setError(null);
    } else {
      setError(error.message);
    }
  }, [vaze]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function confirm(next: Pending) {
    setPending(next);
    setConfirming(true);
  }

  async function revoke() {
    if (!pending) return;
    const { error } =
      pending.kind === "one"
        ? await vaze.account.revokeSession(pending.session.id)
        : await vaze.account.revokeOtherSessions();

    const notice = error
      ? {
          variant: "danger" as const,
          label: "Couldn't sign out",
          description: error.message,
        }
      : {
          variant: "success" as const,
          label:
            pending.kind === "one"
              ? "Device signed out"
              : "All other devices signed out",
        };

    if (!error) load();
    setTimeout(() => toast.show(notice), SHEET_CLOSE_MS);
  }

  const others = sessions?.filter((session) => !session.current).length ?? 0;
  const pendingName =
    pending?.kind === "one"
      ? describeUserAgent(pending.session.userAgent)
      : null;

  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: "Devices" }} />
      <ScrollView
        contentContainerClassName="grow gap-4 px-5 pt-4 pb-8"
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            tintColor={muted}
            onRefresh={async () => {
              setPulling(true);
              await load();
              setPulling(false);
            }}
          />
        }
      >
        <Text className="font-normal px-1 text-sm text-muted">
          Devices signed in to your account. Sign out any you don't recognize.
        </Text>

        {sessions === null ? (
          <LoadState error={error} onRetry={load} />
        ) : (
          <>
            <ListGroup className="border border-border">
              {sessions.map((session, index) => (
                <Fragment key={session.id}>
                  {index > 0 ? <Separator className="mx-4" /> : null}
                  <ListGroup.Item
                    onPress={
                      session.current
                        ? undefined
                        : () => confirm({ kind: "one", session })
                    }
                  >
                    <ListGroup.ItemPrefix>
                      <Icon
                        icon={
                          isMobileUserAgent(session.userAgent)
                            ? Smartphone
                            : Laptop
                        }
                        className="text-muted"
                      />
                    </ListGroup.ItemPrefix>
                    <ListGroup.ItemContent>
                      <ListGroup.ItemTitle numberOfLines={1}>
                        {describeUserAgent(session.userAgent)}
                      </ListGroup.ItemTitle>
                      <ListGroup.ItemDescription numberOfLines={2}>
                        {session.ipAddress
                          ? formatIpAddress(session.ipAddress)
                          : "Unknown IP"}
                        {` · Signed in ${formatDate(session.createdAt)}`}
                      </ListGroup.ItemDescription>
                    </ListGroup.ItemContent>
                    {session.current ? (
                      <ListGroup.ItemSuffix>
                        <Chip size="sm" variant="soft" color="success">
                          <Chip.Label>This device</Chip.Label>
                        </Chip>
                      </ListGroup.ItemSuffix>
                    ) : (
                      <ListGroup.ItemSuffix>
                        <Text className="text-sm font-medium text-danger">
                          Sign out
                        </Text>
                      </ListGroup.ItemSuffix>
                    )}
                  </ListGroup.Item>
                </Fragment>
              ))}
            </ListGroup>

            {others > 0 ? (
              <Button
                variant="danger-soft"
                onPress={() => confirm({ kind: "others" })}
              >
                Sign out other devices
              </Button>
            ) : null}
          </>
        )}
      </ScrollView>

      <ConfirmSheet
        isOpen={confirming}
        onOpenChange={setConfirming}
        title={
          pendingName ? `Sign out ${pendingName}?` : "Sign out other devices?"
        }
        description={
          pendingName
            ? "It needs your password to sign back in."
            : `${others} ${others === 1 ? "device needs" : "devices need"} your password to sign back in. This phone stays signed in.`
        }
        confirmLabel="Sign out"
        onConfirm={revoke}
      />
    </View>
  );
}
