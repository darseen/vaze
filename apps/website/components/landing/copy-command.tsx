"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Outcome = "copied" | "failed";

const MESSAGES: Record<Outcome, string> = {
  copied: "Copied",
  failed: "Copy failed",
};

export function CopyCommand({ command }: { command: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(undefined);
  const lastMessage = useRef("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [message, setMessage] = useState("");
  // only used where CSS can't tell which end of the command is cut off
  const [cut, setCut] = useState({ start: false, end: false });

  useEffect(() => {
    const element = scroller.current;
    if (!element || CSS.supports("animation-timeline", "scroll()")) return;
    const start = element.firstElementChild;
    const end = element.lastElementChild;
    if (!start || !end) return;
    const observer = new IntersectionObserver(
      (entries) =>
        setCut((previous) => {
          const next = { ...previous };
          for (const entry of entries) {
            next[entry.target === start ? "start" : "end"] =
              !entry.isIntersecting;
          }
          return next;
        }),
      { root: element, rootMargin: "1px" },
    );
    observer.observe(start);
    observer.observe(end);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    window.clearTimeout(timer.current);
    let result: Outcome;
    try {
      await navigator.clipboard.writeText(command);
      result = "copied";
    } catch {
      result = "failed";
    }
    // VoiceOver skips a message identical to the one before it
    let text = MESSAGES[result];
    if (text === lastMessage.current) text += " ";
    lastMessage.current = text;
    setOutcome(result);
    setMessage(text);
    timer.current = window.setTimeout(() => {
      setOutcome(null);
      setMessage("");
    }, 2000);
  }

  return (
    <div className="flex min-w-0 items-center rounded-lg border border-fd-border bg-fd-card font-mono text-[0.8125rem] shadow-sm">
      <div
        ref={scroller}
        tabIndex={0}
        role="region"
        aria-label="Install command"
        className={`vz-scroll-fade min-w-0 flex-1 overflow-x-auto rounded-md py-3 pl-4 whitespace-nowrap scrollbar-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${cut.start ? "more-start" : ""} ${cut.end ? "more-end" : ""}`}
      >
        <span aria-hidden className="inline-block w-px" />
        <code>
          <span className="text-fd-muted-foreground select-none">$ </span>
          {command}
        </code>
        <span aria-hidden className="inline-block w-px" />
      </div>
      <span className="relative m-1.5 shrink-0">
        <button
          type="button"
          onClick={copy}
          aria-label="Copy the install command"
          className="flex min-h-8 min-w-8 items-center justify-center rounded-md text-fd-muted-foreground transition-[background-color,color,scale] hover:bg-fd-accent hover:text-fd-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold motion-safe:active:scale-95"
        >
          {outcome === "copied" ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
        </button>
        <span
          role="status"
          className={`pointer-events-none absolute right-0 bottom-full mb-2 rounded-md border border-fd-border bg-fd-popover px-2 py-1 font-sans text-xs whitespace-nowrap text-fd-popover-foreground shadow-sm transition-opacity ${message ? "opacity-100" : "opacity-0"}`}
        >
          {message}
        </span>
      </span>
    </div>
  );
}
