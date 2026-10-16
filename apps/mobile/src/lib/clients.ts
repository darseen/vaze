import { expoClient } from "@better-auth/expo/client";
import Vaze from "@darseen/vaze";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { APP_USER_AGENT } from "./user-agent";

type ServerRef = { id: string; url: string };

// React Native's XHR fetch streams `{ uri }` upload parts from disk, Expo's buffers them
const { fetch: nativeFetch } =
  require("react-native/Libraries/Network/fetch") as {
    fetch: typeof fetch;
  };

// cookies are sent by hand, so the native cookie jar must stay out of it
const omitCredentials: typeof fetch = (input, init) =>
  nativeFetch(input, { ...init, credentials: "omit" });

const unauthorizedListeners = new Map<string, Set<() => void>>();

/** Calls `listener` whenever a server answers one of its requests with 401. */
export function onUnauthorized(serverId: string, listener: () => void) {
  const listeners = unauthorizedListeners.get(serverId) ?? new Set();
  listeners.add(listener);
  unauthorizedListeners.set(serverId, listeners);
  return () => {
    listeners.delete(listener);
  };
}

function createClients(server: ServerRef) {
  const auth = createAuthClient({
    baseURL: `${server.url}/api/auth`,
    // a session records the user agent it signed in with
    fetchOptions: { headers: { "User-Agent": APP_USER_AGENT } },
    plugins: [
      expoClient({
        scheme: "vaze",
        storagePrefix: storagePrefix(server.id),
        storage: SecureStore,
      }),
    ],
  });

  const vaze = new Vaze({
    vazeUrl: server.url,
    fetch: async (input, init) => {
      const response = await omitCredentials(input, init);
      if (response.status === 401) {
        for (const listener of unauthorizedListeners.get(server.id) ?? []) {
          listener();
        }
      }
      return response;
    },
    headers: async (): Promise<Record<string, string>> => {
      const cookie = await auth.getCookie();
      return cookie ? { cookie } : {};
    },
  });

  return { auth, vaze };
}

export type Clients = ReturnType<typeof createClients>;
export type AuthClient = Clients["auth"];

const cache = new Map<string, Clients & { url: string }>();

function storagePrefix(id: string) {
  return `vaze_${id}`;
}

export function getClients(server: ServerRef): Clients {
  const cached = cache.get(server.id);
  if (cached && cached.url === server.url) return cached;

  const clients = { ...createClients(server), url: server.url };
  cache.set(server.id, clients);
  return clients;
}

/** Ends the session (best effort) and wipes what this server left on the device. */
export async function forgetServer(server: ServerRef) {
  const { auth } = getClients(server);
  // the local cookie is cleared before the request, so this works offline too
  await auth.signOut().catch(() => undefined);
  cache.delete(server.id);

  const prefix = storagePrefix(server.id);
  await Promise.all(
    [`${prefix}_cookie`, `${prefix}_session_data`].map((key) =>
      SecureStore.deleteItemAsync(key).catch(() => undefined),
    ),
  );
}

const PROBE_TIMEOUT_MS = 8000;

/** Asks an unauthenticated question of a URL, giving up after a few seconds. */
async function askPublicly<T>(url: string, ask: (vaze: Vaze) => Promise<T>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const vaze = new Vaze({
      vazeUrl: url,
      headers: {},
      fetch: (input, init) =>
        omitCredentials(input, { ...init, signal: controller.signal }),
    });
    return await ask(vaze);
  } finally {
    clearTimeout(timer);
  }
}

/** Whether a Vaze instance answers at this URL. */
export function probeServer(url: string) {
  return askPublicly(url, async (vaze) =>
    Boolean((await vaze.health()).data?.message),
  );
}

/** Whether the instance still needs its admin account; older servers never say so. */
export function needsSetup(url: string) {
  return askPublicly(
    url,
    async (vaze) => (await vaze.setupStatus()).data?.needed ?? false,
  );
}
