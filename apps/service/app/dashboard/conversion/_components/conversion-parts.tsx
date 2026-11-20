import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/utils";
import type { FileWithUrl } from "@repo/types";
import {
  Check,
  CircleAlert,
  Cloud,
  Download,
  LoaderCircle,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import FileSelector from "./file-selector";
import type { ConversionSource } from "./request-conversion";

/** Offers a file from the device or from Vaze. */
export function SourcePicker({
  icon: Icon,
  title,
  hint,
  accept,
  filter,
  disabled,
  multiple = false,
  onChoose,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  /** The device picker's `accept` attribute. */
  accept: string;
  /** Which Vaze files can be picked. Must be stable, e.g. defined at module level. */
  filter: (file: FileWithUrl) => boolean;
  disabled: boolean;
  /** Lets the device picker take several files, each passed to `onChoose`. */
  multiple?: boolean;
  onChoose: (source: ConversionSource) => void;
}) {
  const [isFileSelectorOpen, setIsFileSelectorOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDeviceFile(event: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    // lets the same file be picked again
    event.target.value = "";
    for (const file of files) onChoose({ kind: "device", file });
  }

  return (
    <>
      <div className="px-5 py-10 text-center sm:px-10">
        <div className="bg-secondary text-primary mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
          <Icon size={27} />
        </div>
        <h2 className="mt-5 text-lg font-semibold">{title}</h2>
        <p className="text-muted-foreground mt-2 text-sm">{hint}</p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            className="hidden"
            onChange={handleDeviceFile}
          />
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            <Upload />
            Choose from device
          </Button>
          <Button
            disabled={disabled}
            onClick={() => setIsFileSelectorOpen(true)}
          >
            <Cloud />
            Choose from Vaze
          </Button>
        </div>
      </div>

      <FileSelector
        open={isFileSelectorOpen}
        onOpenChange={setIsFileSelectorOpen}
        accept={filter}
        onSelect={(file) => {
          setIsFileSelectorOpen(false);
          onChoose({ kind: "vaze", file });
        }}
      />
    </>
  );
}

/** The chosen file, with a way to remove it and the card's main action. */
export function SelectedSource({
  source,
  icon: Icon,
  removeLabel,
  disabled,
  onRemove,
  action,
}: {
  source: ConversionSource;
  icon: LucideIcon;
  removeLabel: string;
  disabled: boolean;
  onRemove: () => void;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="bg-secondary text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
          <Icon size={19} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{source.file.name}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {formatBytes(source.file.size)} ·{" "}
            {source.kind === "device" ? "Your device" : "Vaze"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground size-7 shrink-0"
          disabled={disabled}
          onClick={onRemove}
          aria-label={removeLabel}
        >
          <X />
        </Button>
      </div>
      {action}
    </div>
  );
}

export function ConversionFailed({ message }: { message: string }) {
  return (
    <p role="alert" className="text-destructive flex items-start gap-2 text-sm">
      <CircleAlert className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  );
}

/** `progress` is a fraction, or null to show `received` bytes instead. */
export function ConversionProgress({
  label,
  progress,
  received = 0,
}: {
  label: string;
  progress: number | null;
  received?: number;
}) {
  const percent = progress === null ? null : Math.round(progress * 100);

  return (
    <>
      <div
        role="status"
        className="flex items-center justify-between gap-3 text-sm font-semibold"
      >
        <span className="flex items-center gap-2">
          <LoaderCircle className="text-primary size-4 animate-spin" />
          {label}
        </span>
        <span className="text-muted-foreground tabular-nums">
          {percent !== null
            ? `${percent}%`
            : received > 0
              ? formatBytes(received)
              : null}
        </span>
      </div>
      {percent !== null && <Progress value={percent} className="mt-3 h-2" />}
    </>
  );
}

/** The finished file, ready to download. */
export function ConversionReady({
  title,
  preview,
  name,
  details,
  url,
  downloadLabel,
}: {
  title: string;
  preview: ReactNode;
  name: string;
  details: string;
  url: string;
  downloadLabel: string;
}) {
  return (
    <>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <Check size={13} strokeWidth={3} />
        </span>
        {title}
      </div>
      <div className="bg-card mt-4 flex flex-col items-start justify-between gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          {preview}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="text-muted-foreground text-xs">{details}</p>
          </div>
        </div>
        <Button asChild size="sm">
          <a href={url} download={name}>
            <Download />
            {downloadLabel}
          </a>
        </Button>
      </div>
    </>
  );
}

/** How the result's size compares with the original's. */
export function sizeChange(size: number, sourceSize: number): string | null {
  if (!sourceSize) return null;
  const ratio = size / sourceSize;
  // e.g. a small SVG drawn large, where a percentage runs to thousands
  if (ratio >= 2)
    return `${parseFloat(ratio.toFixed(ratio < 10 ? 1 : 0))}× larger`;
  const percent = Math.round((1 - ratio) * 100);
  if (percent > 0) return `${percent}% smaller`;
  if (percent < 0) return `${-percent}% larger`;
  return null;
}

/** A labeled option, such as a select or an input. */
export function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  /** A line of help below the control, which it is described by. */
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
    </div>
  );
}
