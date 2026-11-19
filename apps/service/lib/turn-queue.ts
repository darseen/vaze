/** A first-come queue running `maxRunning` jobs at once, with up to `maxWaiting` more waiting. */
export function createTurnQueue({
  maxRunning,
  maxWaiting,
}: {
  maxRunning: number;
  maxWaiting: number;
}) {
  let running = 0;
  const waiting: (() => void)[] = [];

  const isBusy = () => running >= maxRunning && waiting.length >= maxWaiting;

  /** Waits for a turn and returns its release, or null when too many are waiting. */
  async function acquireTurn(
    signal: AbortSignal,
  ): Promise<(() => void) | null> {
    signal.throwIfAborted();

    if (running < maxRunning) {
      running++;
    } else if (waiting.length >= maxWaiting) {
      return null;
    } else {
      await new Promise<void>((resolve, reject) => {
        const grant = () => {
          signal.removeEventListener("abort", leave);
          resolve();
        };
        const leave = () => {
          waiting.splice(waiting.indexOf(grant), 1);
          reject(signal.reason);
        };
        waiting.push(grant);
        signal.addEventListener("abort", leave, { once: true });
      });
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      // hand the turn straight to the next request so nothing can jump the queue
      const next = waiting.shift();
      if (next) next();
      else running--;
    };
  }

  return { isBusy, acquireTurn };
}
