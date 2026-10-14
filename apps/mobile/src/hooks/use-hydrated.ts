import { useEffect, useState } from "react";
import { usePreferences } from "@/stores/preferences";
import { useServers } from "@/stores/servers";

const stores = [useServers, usePreferences];

function allHydrated() {
  return stores.every((store) => store.persist.hasHydrated());
}

/** True once every persisted store has been read back from storage. */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(allHydrated);

  useEffect(() => {
    const check = () => setHydrated(allHydrated());
    const unsubscribes = stores.map((store) =>
      store.persist.onFinishHydration(check),
    );
    check();
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, []);

  return hydrated;
}
