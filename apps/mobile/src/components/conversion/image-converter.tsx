import type { File, ImageConversionOptions, ImageFormat } from "@darseen/vaze";
import type { File as DeviceFile } from "expo-file-system";
import { Image } from "expo-image";
import { Button, Description, Spinner, Tabs, useToast } from "heroui-native";
import { FileImage } from "lucide-react-native";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { View } from "react-native";
import { useServer } from "@/components/server-context";
import { ChoiceSelect, Option, ToolScroll } from "@/components/tool-parts";
import {
  convertImage,
  IMAGE_FORMAT_INFO,
  IMAGE_FORMATS,
  sizeChange,
  type ConversionSource,
} from "@/lib/conversion";
import { formatBytes } from "@/lib/format";
import { discardPicked, pickOne } from "@/lib/transfer";
import {
  ConversionFailed,
  ConversionProgress,
  ConversionReady,
  ResultActions,
  SourceChoices,
  SourceRow,
  type SourceOrigin,
} from "./conversion-parts";
import { FilePickerSheet } from "./file-picker-sheet";

type Status =
  | { phase: "idle" }
  | { phase: "uploading"; progress: number }
  | { phase: "converting"; progress: number | null }
  | {
      phase: "done";
      image: DeviceFile;
      format: ImageFormat;
      sourceSize: number;
      width: number;
      height: number;
    }
  | { phase: "error"; message: string };

const IDLE: Status = { phase: "idle" };

type Quality = "high" | "balanced" | "small";

// AVIF looks as good as the others at a lower number; PNG has none
const QUALITIES: Record<
  Quality,
  { label: string; value: Partial<Record<ImageFormat, number>> }
> = {
  high: { label: "High", value: { webp: 90, jpeg: 90, avif: 65 } },
  balanced: { label: "Balanced", value: { webp: 80, jpeg: 80, avif: 50 } },
  small: { label: "Smaller", value: { webp: 65, jpeg: 65, avif: 35 } },
};

// the box the longest side must fit in, as in the dashboard
const SIZES = ["original", "3840", "2560", "1920", "1280", "640"] as const;

type Size = (typeof SIZES)[number];

/** Converts an image to another format. A stored image's `fileId` is picked, ready for its options. */
export function ImageConverter({ fileId }: { fileId?: string }) {
  const { server, vaze } = useServer();
  const { toast } = useToast();
  const [source, setSource] = useState<ConversionSource | null>(null);
  const [status, setStatus] = useState<Status>(IDLE);
  const [format, setFormat] = useState<ImageFormat>("webp");
  const [quality, setQuality] = useState<Quality>("balanced");
  const [size, setSize] = useState<Size>("original");
  const [finding, setFinding] = useState(Boolean(fileId));
  const [picking, setPicking] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);
  // events from a canceled run are ignored
  const runRef = useRef(0);

  const busy = status.phase === "uploading" || status.phase === "converting";
  const image = status.phase === "done" ? status : null;
  const { label, lossy } = IMAGE_FORMAT_INFO[format];

  // leaving the screen cancels the request
  useEffect(() => () => cancelRef.current?.(), []);

  const pickedUri = source?.kind === "device" ? source.file.uri : null;
  useEffect(() => {
    if (!pickedUri) return;
    return () => discardPicked(pickedUri);
  }, [pickedUri]);

  useEffect(() => {
    if (!fileId) return;
    let active = true;
    vaze.files.getById(fileId).then(({ data, error }) => {
      if (!active) return;
      setFinding(false);
      const file = data?.file as File | undefined;
      if (file) setSource({ kind: "vaze", file });
      else {
        setStatus({
          phase: "error",
          message: error?.message ?? "That image is no longer on the server",
        });
      }
    });
    return () => {
      active = false;
    };
  }, [fileId, vaze]);

  function start(next: ConversionSource) {
    const run = ++runRef.current;
    const live = () => runRef.current === run;
    const finish = (final: Status) => {
      if (!live()) return;
      cancelRef.current = null;
      setStatus(final);
    };

    const options: ImageConversionOptions = {
      format,
      quality: QUALITIES[quality].value[format],
    };
    if (size !== "original") options.width = options.height = Number(size);

    setStatus(
      next.kind === "device"
        ? { phase: "uploading", progress: 0 }
        : { phase: "converting", progress: null },
    );

    cancelRef.current = convertImage(vaze, next, options, {
      onUploadProgress: (fraction) => {
        if (!live()) return;
        setStatus(
          fraction < 1
            ? { phase: "uploading", progress: fraction }
            : { phase: "converting", progress: null },
        );
      },
      onProgress: (_received, progress) => {
        if (live()) setStatus({ phase: "converting", progress });
      },
      onDone: (result, header) =>
        finish({
          phase: "done",
          image: result,
          format,
          sourceSize: next.file.size,
          width: Number(header("X-Image-Width")),
          height: Number(header("X-Image-Height")),
        }),
      onError: (message) => finish({ phase: "error", message }),
    });
  }

  function choose(next: ConversionSource | null) {
    cancel();
    setSource(next);
  }

  function cancel() {
    cancelRef.current?.();
    cancelRef.current = null;
    runRef.current++;
    setStatus(IDLE);
  }

  // a result made with other options would no longer match them
  function changeOption<T extends string>(set: Dispatch<SetStateAction<T>>) {
    return (value: string) => {
      // the triggers offered are the only values the tabs can report
      set(value as T);
      setStatus(IDLE);
    };
  }

  async function pick(origin: SourceOrigin) {
    if (origin === "vaze") return setPicking(true);
    try {
      const picked = await pickOne("image", origin);
      if (picked) choose({ kind: "device", file: picked });
    } catch (error) {
      toast.show({
        variant: "danger",
        label: "Couldn't open your images",
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  return (
    <ToolScroll description="Convert an image to WebP, JPG, PNG or AVIF and resize it, from HEIC, JPG, PNG, WebP, AVIF, GIF, TIFF and SVG. Camera details and location are left out, and the result isn't kept on the server, so save or share it.">
      {finding ? (
        <View className="items-center py-8">
          <Spinner />
        </View>
      ) : source ? (
        <>
          <SourceRow
            source={source}
            icon={FileImage}
            showDeviceImage
            removeLabel="Remove the image"
            onRemove={busy ? undefined : () => choose(null)}
          />

          <Option label="Format">
            <Tabs value={format} onValueChange={changeOption(setFormat)}>
              <Tabs.List className="w-full">
                <Tabs.Indicator />
                {IMAGE_FORMATS.map((value) => (
                  <Tabs.Trigger
                    key={value}
                    value={value}
                    isDisabled={busy}
                    className="flex-1"
                  >
                    <Tabs.Label>{IMAGE_FORMAT_INFO[value].label}</Tabs.Label>
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </Tabs>
          </Option>

          <Option label="Quality">
            {lossy ? (
              <Tabs value={quality} onValueChange={changeOption(setQuality)}>
                <Tabs.List className="w-full">
                  <Tabs.Indicator />
                  {(Object.keys(QUALITIES) as Quality[]).map((value) => (
                    <Tabs.Trigger
                      key={value}
                      value={value}
                      isDisabled={busy}
                      className="flex-1"
                    >
                      <Tabs.Label>{QUALITIES[value].label}</Tabs.Label>
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>
              </Tabs>
            ) : (
              <Description>
                PNG keeps every pixel, so there's no quality to pick.
              </Description>
            )}
          </Option>

          <Option label="Longest side">
            <ChoiceSelect
              label="Longest side"
              value={size}
              choices={SIZES.map((value) => ({
                value,
                label: value === "original" ? "Original" : `${value} px`,
              }))}
              isDisabled={busy}
              onChange={changeOption(setSize)}
            />
            <Description>
              In pixels. Images are never made larger, except SVGs.
            </Description>
          </Option>
        </>
      ) : (
        <SourceChoices
          icon={FileImage}
          title="Choose an image to get started"
          hint="It comes back as WebP, JPG, PNG or AVIF."
          descriptions={{
            media: "A photo in your gallery",
            files: "An image saved on this phone",
            vaze: `An image on ${server.name}`,
          }}
          onPick={pick}
        />
      )}

      {status.phase !== "idle" ? <StatusPanel status={status} /> : null}

      {image ? (
        <ResultActions
          file={image.image}
          mimeType={IMAGE_FORMAT_INFO[image.format].mimeType}
          againLabel="Convert another image"
          onAgain={() => choose(null)}
        />
      ) : busy ? (
        <Button variant="secondary" onPress={cancel}>
          Cancel
        </Button>
      ) : source ? (
        <Button onPress={() => start(source)}>
          {status.phase === "error" ? "Try again" : `Convert to ${label}`}
        </Button>
      ) : null}

      <FilePickerSheet
        kind="image"
        isOpen={picking}
        onOpenChange={setPicking}
        onSelect={(file) => {
          setPicking(false);
          choose({ kind: "vaze", file });
        }}
      />
    </ToolScroll>
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
    const size = status.image.size ?? 0;
    const details = [
      IMAGE_FORMAT_INFO[status.format].label,
      status.width && status.height
        ? `${status.width} × ${status.height}`
        : null,
      formatBytes(size),
      sizeChange(size, status.sourceSize),
    ];

    return (
      <ConversionReady
        title="Your image is ready"
        preview={
          <View className="size-10 overflow-hidden rounded-xl bg-default">
            <Image
              source={{ uri: status.image.uri }}
              style={{ flex: 1 }}
              contentFit="cover"
              transition={150}
            />
          </View>
        }
        name={status.image.name}
        details={details.filter(Boolean).join(" · ")}
      />
    );
  }

  return (
    <ConversionProgress
      label={
        status.phase === "uploading" ? "Uploading image…" : "Converting image…"
      }
      progress={status.progress}
    />
  );
}
