"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBytes } from "@/utils";
import {
  IMAGE_FORMAT_INFO,
  IMAGE_FORMATS,
  isConvertibleImage,
  toImageName,
  type ImageFormat,
} from "@/utils/conversion";
import { FileImage, Play } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ConversionFailed,
  ConversionProgress,
  ConversionReady,
  Field,
  SelectedSource,
  sizeChange,
  SourcePicker,
} from "./conversion-parts";
import { requestConversion, type ConversionSource } from "./request-conversion";

type Status =
  | { phase: "idle" }
  | { phase: "uploading"; progress: number }
  | { phase: "converting"; progress: number | null }
  | {
      phase: "done";
      url: string;
      name: string;
      format: ImageFormat;
      size: number;
      sourceSize: number;
      width: number;
      height: number;
    }
  | { phase: "error"; message: string };

const IDLE: Status = { phase: "idle" };

// AVIF looks as good as the others at a lower number
const QUALITIES = {
  high: { label: "High", value: { webp: 90, jpeg: 90, avif: 65 } },
  balanced: { label: "Balanced", value: { webp: 80, jpeg: 80, avif: 50 } },
  small: { label: "Smaller file", value: { webp: 65, jpeg: 65, avif: 35 } },
} as const;

type Quality = keyof typeof QUALITIES;

// the box the longest side must fit in; only SVGs are drawn larger than they are
const SIZES = ["original", "3840", "2560", "1920", "1280", "640"] as const;

type Size = (typeof SIZES)[number];

export default function ImageConverter() {
  const [source, setSource] = useState<ConversionSource | null>(null);
  const [status, setStatus] = useState<Status>(IDLE);
  const [format, setFormat] = useState<ImageFormat>("webp");
  const [quality, setQuality] = useState<Quality>("balanced");
  const [size, setSize] = useState<Size>("original");
  const cancelRef = useRef<(() => void) | null>(null);
  const id = useId();

  const busy = status.phase === "uploading" || status.phase === "converting";
  const imageUrl = status.phase === "done" ? status.url : null;
  const lossy = IMAGE_FORMAT_INFO[format].defaultQuality !== null;
  const label = IMAGE_FORMAT_INFO[format].label;

  // leaving the page cancels the request
  useEffect(() => () => cancelRef.current?.(), []);

  useEffect(() => {
    if (!imageUrl) return;
    return () => URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  function choose(next: ConversionSource) {
    setSource(next);
    setStatus(IDLE);
  }

  // a result made with other options would no longer match them
  function changeOption<T extends string>(set: Dispatch<SetStateAction<T>>) {
    // the items offered are the only values a select can report
    return (value: string) => {
      set(value as T);
      setStatus(IDLE);
    };
  }

  function startConversion() {
    if (!source || busy) return;

    const options: Record<string, string | number> = { format };
    if (format !== "png") options.quality = QUALITIES[quality].value[format];
    if (size !== "original") options.width = options.height = Number(size);

    const name = toImageName(source.file.name, format);
    const sourceSize = source.file.size;
    const finish = (next: Status) => {
      cancelRef.current = null;
      setStatus(next);
    };

    setStatus(
      source.kind === "device"
        ? { phase: "uploading", progress: 0 }
        : { phase: "converting", progress: null },
    );

    cancelRef.current = requestConversion(
      { url: "/api/conversion/image", source, options },
      {
        onUploadProgress: (fraction) =>
          setStatus(
            fraction < 1
              ? { phase: "uploading", progress: fraction }
              : { phase: "converting", progress: null },
          ),
        onProgress: (_received, progress) =>
          setStatus({ phase: "converting", progress }),
        onDone: (image, header) =>
          finish({
            phase: "done",
            url: URL.createObjectURL(image),
            name,
            format,
            size: image.size,
            sourceSize,
            width: Number(header("X-Image-Width")),
            height: Number(header("X-Image-Height")),
          }),
        onError: (message) => finish({ phase: "error", message }),
      },
    );
  }

  function cancelConversion() {
    cancelRef.current?.();
    cancelRef.current = null;
    setStatus(IDLE);
  }

  return (
    <Card>
      <CardContent>
        <div className="sm:p-4">
          <SourcePicker
            icon={FileImage}
            title="Choose an image to get started"
            hint="HEIC, JPG, PNG, WebP, AVIF, GIF, TIFF and SVG"
            accept="image/*,.heic,.heif"
            filter={isConvertibleImage}
            disabled={busy}
            onChoose={choose}
          />

          {source && (
            <div className="mt-3 rounded-xl border p-4">
              <SelectedSource
                source={source}
                icon={FileImage}
                removeLabel="Remove selected image"
                disabled={busy}
                onRemove={() => {
                  setSource(null);
                  setStatus(IDLE);
                }}
                action={
                  busy ? (
                    <Button variant="outline" onClick={cancelConversion}>
                      Cancel
                    </Button>
                  ) : (
                    <Button onClick={startConversion}>
                      <Play fill="currentColor" />
                      Convert to {label}
                    </Button>
                  )
                }
              />

              <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-3">
                <Field id={`${id}-format`} label="Format">
                  <Select
                    value={format}
                    onValueChange={changeOption(setFormat)}
                    disabled={busy}
                  >
                    <SelectTrigger id={`${id}-format`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IMAGE_FORMATS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {IMAGE_FORMAT_INFO[value].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field id={`${id}-quality`} label="Quality">
                  <Select
                    // PNG keeps every pixel, so there is no quality to pick
                    value={lossy ? quality : ""}
                    onValueChange={changeOption(setQuality)}
                    disabled={busy || !lossy}
                  >
                    <SelectTrigger id={`${id}-quality`} className="w-full">
                      <SelectValue placeholder="Lossless" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(QUALITIES) as Quality[]).map((value) => (
                        <SelectItem key={value} value={value}>
                          {QUALITIES[value].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field id={`${id}-size`} label="Longest side">
                  <Select
                    value={size}
                    onValueChange={changeOption(setSize)}
                    disabled={busy}
                  >
                    <SelectTrigger id={`${id}-size`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SIZES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value === "original" ? "Original" : `${value} px`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>
          )}

          {status.phase !== "idle" && (
            <div className="bg-muted/40 mt-3 rounded-xl border p-4">
              <StatusPanel status={status} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusPanel({
  status,
}: {
  status: Exclude<Status, { phase: "idle" }>;
}) {
  if (status.phase === "error") {
    return <ConversionFailed message={status.message} />;
  }

  if (status.phase === "done") {
    const details = [
      IMAGE_FORMAT_INFO[status.format].label,
      status.width && status.height
        ? `${status.width} × ${status.height}`
        : null,
      formatBytes(status.size),
      sizeChange(status.size, status.sourceSize),
    ];

    return (
      <ConversionReady
        title="Your image is ready"
        preview={
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={status.url}
            alt=""
            className="bg-card h-9 w-9 shrink-0 rounded-lg border object-cover"
          />
        }
        name={status.name}
        details={details.filter(Boolean).join(" · ")}
        url={status.url}
        downloadLabel={`Download ${IMAGE_FORMAT_INFO[status.format].label}`}
      />
    );
  }

  return status.phase === "uploading" ? (
    <ConversionProgress label="Uploading image…" progress={status.progress} />
  ) : (
    <ConversionProgress label="Converting image…" progress={status.progress} />
  );
}
