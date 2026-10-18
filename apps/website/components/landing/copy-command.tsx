"use client";

import { useCopyButton } from "fumadocs-ui/utils/use-copy-button";
import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// whether part of the command is hidden past the right edge
const isClipped = (code: HTMLElement) =>
  code.scrollLeft + code.clientWidth < code.scrollWidth - 1;

export function CopyCommand({ command }: { command: string }) {
  const [copied, onCopy] = useCopyButton(() =>
    navigator.clipboard.writeText(command),
  );
  const ref = useRef<HTMLElement>(null);
  // fades the cut-off end of a command too long for its box
  const [clipped, setClipped] = useState(false);

  useEffect(() => {
    const code = ref.current;
    if (!code) return;
    const update = () => setClipped(isClipped(code));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(code);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex min-w-0 items-center rounded-lg border border-fd-border bg-fd-card font-mono text-[13px] shadow-sm">
      <code
        ref={ref}
        onScroll={(event) => setClipped(isClipped(event.currentTarget))}
        className={`min-w-0 flex-1 overflow-x-auto whitespace-nowrap py-3 pl-4 scrollbar-none ${clipped ? "mask-r-from-80%" : ""}`}
      >
        <span className="select-none text-fd-muted-foreground">$ </span>
        {command}
      </code>
      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? "Copied" : "Copy the install command"}
        className="m-1.5 shrink-0 rounded-md p-2 text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground focus-visible:outline-2 focus-visible:outline-gold"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </button>
    </div>
  );
}
