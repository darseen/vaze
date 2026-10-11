import { cn } from "@/lib/utils";
import type { FileWithUrl } from "@repo/types";
import { useEffect, useRef } from "react";
import FilePreview from "../file-preview";

export default function Filmstrip({
  files,
  index,
  onSelect,
}: {
  files: FileWithUrl[];
  index: number;
  onSelect: (index: number) => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);

  // keep the current file in the middle of the strip
  useEffect(() => {
    const strip = stripRef.current;
    const item = strip?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!strip || !item) return;

    strip.scrollTo({
      left: item.offsetLeft - (strip.clientWidth - item.offsetWidth) / 2,
      // jumping straight there on open, gliding after
      behavior: scrolled.current ? "smooth" : "instant",
    });
    scrolled.current = true;
  }, [index]);

  return (
    <div
      ref={stripRef}
      className="relative shrink-0 [scrollbar-width:thin] overflow-x-auto border-t py-3"
    >
      <div className="mx-auto flex w-max gap-2 px-4">
        {files.map((file, i) => (
          <button
            key={file.id}
            type="button"
            onClick={() => onSelect(i)}
            aria-label={file.name}
            aria-current={i === index}
            title={file.name}
            className={cn(
              "bg-muted focus-visible:ring-ring relative size-14 shrink-0 cursor-pointer overflow-hidden rounded-md transition-opacity outline-none focus-visible:ring-2",
              i === index
                ? "ring-foreground ring-2"
                : "opacity-50 hover:opacity-100",
            )}
          >
            <FilePreview file={file} compact />
          </button>
        ))}
      </div>
    </div>
  );
}
