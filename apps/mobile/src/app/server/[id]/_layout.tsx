import type { Me } from "@darseen/vaze";
import { Redirect, router, Stack, useLocalSearchParams } from "expo-router";
import { Button, Spinner } from "heroui-native";
import { CloudOff } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Icon } from "@/components/icon";
import {
  ServerContext,
  type ServerContextValue,
} from "@/components/server-context";
import { SignInForm } from "@/components/sign-in-form";
import { VIEWER_BACKGROUND } from "@/components/viewer/theme";
import { RegisterForm } from "@/components/register-form";
import { getClients, needsSetup } from "@/lib/clients";
import { hostOf } from "@/lib/server-url";
import { useLibrary } from "@/stores/library";
import { useServers, type Server } from "@/stores/servers";

export default function ServerLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const server = useServers((state) =>
    state.servers.find((item) => item.id === id),
  );

  if (!server) return <Redirect href="/" />;
  return <ServerGate key={server.id} server={server} />;
}

type GateState =
  | { status: "loading" }
  | { status: "ready"; me: Me; headers: Record<string, string> }
  | { status: "signed-out"; expired: boolean }
  | { status: "error"; message: string };

function ServerGate({ server }: { server: Server }) {
  const { auth, vaze } = useMemo(() => getClients(server), [server]);
  const update = useServers((state) => state.update);
  const clearLibrary = useLibrary((state) => state.clear);
  const [state, setState] = useState<GateState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    const { data, error } = await vaze.me();

    if (data) {
      setState({
        status: "ready",
        me: data,
        headers: await vaze.authHeaders(),
      });
      update(server.id, {
        account: { name: data.user.name, email: data.user.email },
      });
    } else if (error.status === 401) {
      const current = useServers
        .getState()
        .servers.find((item) => item.id === server.id);
      setState({ status: "signed-out", expired: Boolean(current?.account) });
      update(server.id, { account: null });
    } else if (error.status === 404) {
      setState({
        status: "error",
        message: "This server runs an older Vaze. Update it to use the app.",
      });
    } else {
      setState({ status: "error", message: error.message });
    }
  }, [vaze, server.id, update]);

  useEffect(() => {
    load();
  }, [load]);

  const reloadMe = useCallback(async () => {
    const { data } = await vaze.me();
    if (!data) return;

    setState((current) =>
      current.status === "ready" ? { ...current, me: data } : current,
    );
    update(server.id, {
      account: { name: data.user.name, email: data.user.email },
    });
  }, [vaze, server.id, update]);

  const context = useMemo<ServerContextValue | null>(() => {
    if (state.status !== "ready") return null;
    return {
      server,
      vaze,
      auth,
      me: state.me,
      headers: state.headers,
      can: (scope) => state.me.scopes.includes(scope),
      reloadMe,
      signOut: async () => {
        update(server.id, { account: null });
        clearLibrary(server.id);
        router.dismissTo("/");
        await auth.signOut().catch(() => undefined);
      },
    };
  }, [state, server, vaze, auth, update, clearLibrary, reloadMe]);

  if (state.status === "loading") {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Spinner />
      </View>
    );
  }

  if (state.status === "signed-out") {
    return (
      <SignInScreen server={server} expired={state.expired} onSignedIn={load} />
    );
  }

  if (state.status === "error" || !context) {
    return (
      <View className="flex-1 items-center justify-center gap-5 bg-background px-8">
        <View className="size-14 items-center justify-center rounded-full bg-default">
          <Icon icon={CloudOff} size={26} className="text-muted" />
        </View>
        <View className="items-center gap-1">
          <Text className="text-lg font-semibold text-foreground">
            Couldn't open {server.name}
          </Text>
          <Text className="font-normal text-center text-sm text-muted">
            {state.status === "error" ? state.message : "Something went wrong."}
          </Text>
        </View>
        <View className="flex-row gap-3">
          <Button variant="tertiary" onPress={() => router.dismissTo("/")}>
            Servers
          </Button>
          <Button onPress={load}>Try again</Button>
        </View>
      </View>
    );
  }

  return (
    <ServerContext.Provider value={context}>
      <ServerStack />
    </ServerContext.Provider>
  );
}

// the file viewer opens above the tabs, so it covers the tab bar
function ServerStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="view"
        options={{
          animation: "fade",
          contentStyle: { backgroundColor: VIEWER_BACKGROUND },
        }}
      />
    </Stack>
  );
}

function SignInScreen({
  server,
  expired,
  onSignedIn,
}: {
  server: Server;
  expired: boolean;
  onSignedIn: () => void;
}) {
  // a server reset to no accounts asks for its admin again, like the web
  const [setup, setSetup] = useState(false);
  useEffect(() => {
    needsSetup(server.url)
      .then(setSetup)
      .catch(() => undefined);
  }, [server.url]);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerClassName="grow justify-center gap-8 px-6 pt-safe-offset-6 pb-safe-offset-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-1">
          <Text className="text-2xl font-semibold text-foreground">
            {setup ? `Set up ${server.name}` : `Sign in to ${server.name}`}
          </Text>
          <Text className="font-normal text-sm text-muted">
            {setup
              ? "It has no accounts yet. The first one is its admin."
              : expired
                ? "Your session ended. Sign in again to continue."
                : server.name === hostOf(server.url)
                  ? "Use your Vaze account."
                  : hostOf(server.url)}
          </Text>
        </View>
        {setup ? (
          <RegisterForm
            server={server}
            onSignedIn={onSignedIn}
            inputVariant="primary"
          />
        ) : (
          <SignInForm
            server={server}
            onSignedIn={onSignedIn}
            inputVariant="primary"
          />
        )}
        <Button variant="ghost" onPress={() => router.dismissTo("/")}>
          Back to servers
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
