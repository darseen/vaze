import { Directory, File as DeviceFile, Paths } from "expo-file-system";
import { Image } from "expo-image";
import {
  Button,
  Card,
  ControlField,
  Description,
  Input,
  Label,
  Spinner,
} from "heroui-native";
import {
  ArrowLeft,
  ArrowRight,
  FilePen,
  RotateCw,
  Trash2,
  Undo2,
  type LucideIcon,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  PixelRatio,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ConversionFailed,
  SourceChoices,
  SourceRow,
} from "@/components/conversion/conversion-parts";
import { Icon } from "@/components/icon";
import { useServer } from "@/components/server-context";
import type { ConversionSource } from "@/lib/conversion";
import { toPdfName, type Rotation } from "@/lib/pdf-tools";
import { pdfDocument, pdfInfo, renderPdfPage } from "@/lib/previews";
import FilePreviews from "../../../modules/file-previews";
import { PdfJobFooter, usePdfJob } from "./pdf-job";
import { useSource, useSourcePicker } from "./sources";

type EditedPage = {
  key: number;
  /** Its number in the original, from 1. */
  page: number;
  rotate: Rotation;
  removed: boolean;
};

type Opened =
  | { state: "loading" }
  | { state: "failed"; message: string }
  | {
      state: "ready";
      document: string;
      /** Each page's size, its own turn applied. */
      sizes: { width: number; height: number }[];
      /** Where this document's thumbnails are kept until it is closed. */
      folder: Directory;
    };

const GAP = 12;
const SIDE = 20;

const turn = (rotate: Rotation): Rotation => ((rotate + 90) % 360) as Rotation;

// thumbnails render one at a time, and one scrolled past before its turn is skipped
let queue: Promise<unknown> = Promise.resolve();

function renderInTurn<T>(task: () => Promise<T>, wanted: () => boolean) {
  const turnTask = queue.then(() => {
    if (!wanted()) throw new Error("Skipped");
    return task();
  });
  queue = turnTask.catch(() => {});
  return turnTask;
}

let openCount = 0;

/** The chosen PDF on disk with its page sizes, for its thumbnails. */
function useOpenedPdf(source: ConversionSource | null): Opened | null {
  const { server, headers } = useServer();
  const [opened, setOpened] = useState<{
    source: ConversionSource;
    opened: Opened;
  } | null>(null);

  useEffect(() => {
    if (!source) return;
    let active = true;
    const folder = new Directory(
      Paths.cache,
      "pdf-pages",
      `${Date.now()}-${openCount++}`,
    );

    if (!FilePreviews) {
      setOpened({
        source,
        opened: {
          state: "failed",
          message:
            "This build of the app can't show PDF pages. Update the app to edit them",
        },
      });
      return;
    }

    const document =
      source.kind === "device"
        ? Promise.resolve(source.file.uri)
        : pdfDocument({ serverId: server.id, headers }, source.file);

    document
      .then(async (path) => {
        const { pages } = await pdfInfo(path);
        if (!active) return;
        folder.create({ intermediates: true, idempotent: true });
        setOpened({
          source,
          opened: { state: "ready", document: path, sizes: pages, folder },
        });
      })
      .catch(() => {
        if (!active) return;
        setOpened({
          source,
          opened: {
            state: "failed",
            message:
              "This PDF couldn't be opened. It may be damaged or protected with a password",
          },
        });
      });

    return () => {
      active = false;
      try {
        if (folder.exists) folder.delete();
      } catch {
        // already gone
      }
    };
  }, [source, server.id, headers]);

  if (!source) return null;
  // until this file has opened, an earlier one's pages don't count
  return opened?.source === source ? opened.opened : { state: "loading" };
}

function PageThumbnail({
  document,
  folder,
  index,
  size,
  pageSize,
  rotate,
}: {
  document: string;
  folder: Directory;
  index: number;
  /** The square it is drawn in. */
  size: number;
  pageSize: { width: number; height: number };
  rotate: Rotation;
}) {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const pixels = Math.round(size * PixelRatio.get());
    const target = new DeviceFile(folder, `page-${index}-${pixels}.jpg`);
    renderInTurn(
      () => renderPdfPage(document, index, pixels, target),
      () => mounted,
    ).then(
      (rendered) => {
        if (mounted) setUri(rendered);
      },
      () => {},
    );
    return () => {
      mounted = false;
    };
  }, [document, folder, index, size]);

  // fit the page as it will be turned, then draw it unturned and rotate it into place
  const sideways = rotate === 90 || rotate === 270;
  const shown = sideways
    ? { width: pageSize.height, height: pageSize.width }
    : pageSize;
  const scale = Math.min(size / shown.width, size / shown.height);
  const drawn = {
    width: pageSize.width * scale,
    height: pageSize.height * scale,
  };

  return (
    <View
      style={{ width: size, height: size }}
      className="items-center justify-center overflow-hidden rounded-xl bg-default"
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ ...drawn, transform: [{ rotate: `${rotate}deg` }] }}
          contentFit="fill"
          transition={120}
        />
      ) : (
        <Spinner size="sm" />
      )}
    </View>
  );
}

function PageButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
      className="size-8 items-center justify-center rounded-xl active:bg-default"
      style={{ opacity: disabled ? 0.35 : 1 }}
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Icon icon={icon} size={17} className="text-muted" />
    </Pressable>
  );
}

const allPages = (count: number): EditedPage[] =>
  Array.from({ length: count }, (_, i) => ({
    key: i,
    page: i + 1,
    rotate: 0,
    removed: false,
  }));

export function EditPdf() {
  const { server } = useServer();
  const job = usePdfJob();
  const [title, setTitle] = useState("");
  const [pageNumbers, setPageNumbers] = useState(false);
  const { source, choose } = useSource(() => {
    job.reset();
    setTitle("");
    setPageNumbers(false);
  });
  const picker = useSourcePicker("pdf", { multiple: false, onPicked: choose });
  const opened = useOpenedPdf(source);
  const ready = opened?.state === "ready" ? opened : null;
  // edits belong to the document they were made on
  const [edited, setEdited] = useState<{
    document: string;
    pages: EditedPage[];
  } | null>(null);
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const pageCount = ready?.sizes.length ?? 0;
  const initialPages = useMemo(() => allPages(pageCount), [pageCount]);
  const pages =
    ready && edited?.document === ready.document ? edited.pages : initialPages;
  const kept = pages.filter((item) => !item.removed);
  const settled = job.busy || job.status.phase === "done";
  const cellWidth = Math.floor((screenWidth - SIDE * 2 - GAP) / 2);

  const positions = new Map<number, number>();
  for (const item of kept) positions.set(item.key, positions.size + 1);

  function change(next: (pages: EditedPage[]) => EditedPage[]) {
    if (!ready) return;
    setEdited({ document: ready.document, pages: next(pages) });
    job.reset();
  }

  function move(key: number, by: -1 | 1) {
    change((pages) => {
      const from = pages.findIndex((item) => item.key === key);
      const to = from + by;
      if (from < 0 || to < 0 || to >= pages.length) return pages;
      const next = [...pages];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  }

  function save() {
    if (!source || kept.length === 0) return;
    job.start({
      tool: "edit",
      sources: [source],
      options: {
        pages: kept.map(({ page, rotate }) =>
          rotate ? { page, rotate } : page,
        ),
        pageNumbers,
        title: title.trim() || undefined,
      },
      name: toPdfName(source.file.name),
    });
  }

  const header = (
    <View className="gap-4 pb-4">
      <Text className="font-normal text-sm text-muted">
        Move, turn and remove pages, number them, and give the PDF a title.
      </Text>
      <Card className="gap-4 border border-border">
        {source ? (
          <SourceRow
            source={source}
            icon={FilePen}
            removeLabel="Remove the PDF"
            onRemove={job.busy ? undefined : () => choose(null)}
          />
        ) : (
          <SourceChoices
            icon={FilePen}
            title="Choose a PDF to edit"
            hint="Its pages show here to rearrange."
            origins={["files", "vaze"]}
            descriptions={{
              files: "A PDF saved on this phone",
              vaze: `A PDF on ${server.name}`,
            }}
            onPick={picker.pick}
          />
        )}

        {opened?.state === "loading" ? (
          <View className="items-center py-6">
            <Spinner />
          </View>
        ) : null}
        {opened?.state === "failed" ? (
          <ConversionFailed message={opened.message} />
        ) : null}

        {ready ? (
          <>
            <View className="gap-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChangeText={(value) => {
                  setTitle(value);
                  job.reset();
                }}
                placeholder="Keep the current title"
                maxLength={500}
                editable={!settled}
                accessibilityLabel="Title"
              />
            </View>
            <ControlField
              isSelected={pageNumbers}
              isDisabled={settled}
              onSelectedChange={(value) => {
                setPageNumbers(value);
                job.reset();
              }}
              className="items-center gap-3"
            >
              <View className="flex-1 gap-1">
                <Label>Number the pages</Label>
                <Description>At the bottom of each page.</Description>
              </View>
              <ControlField.Indicator variant="switch" />
            </ControlField>
            <View className="flex-row items-center justify-between gap-2">
              <Text className="font-normal flex-1 text-sm text-muted">
                {kept.length} of {pages.length}{" "}
                {pages.length === 1 ? "page" : "pages"}
                {pages.length > kept.length
                  ? ` · ${pages.length - kept.length} removed`
                  : ""}
              </Text>
              <Button
                size="sm"
                variant="ghost"
                isDisabled={settled}
                onPress={() =>
                  change((pages) =>
                    pages.map((item) => ({
                      ...item,
                      rotate: turn(item.rotate),
                    })),
                  )
                }
              >
                Turn all
              </Button>
              <Button
                size="sm"
                variant="ghost"
                isDisabled={settled}
                onPress={() => change(() => allPages(pageCount))}
              >
                Reset
              </Button>
            </View>
          </>
        ) : null}
      </Card>
    </View>
  );

  return (
    <View className="flex-1">
      <FlatList
        data={ready ? pages : []}
        keyExtractor={(item) => String(item.key)}
        numColumns={2}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{
          paddingHorizontal: SIDE,
          paddingTop: 12,
          paddingBottom: 24,
          gap: GAP,
        }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        renderItem={({ item, index }) => {
          const position = positions.get(item.key) ?? null;
          const label = `page ${item.page}`;
          return (
            <View
              style={{ width: cellWidth }}
              className="gap-2 rounded-2xl border border-border p-2"
            >
              <View style={{ opacity: item.removed ? 0.3 : 1 }}>
                <PageThumbnail
                  document={ready!.document}
                  folder={ready!.folder}
                  index={item.page - 1}
                  size={cellWidth - 16}
                  pageSize={ready!.sizes[item.page - 1]}
                  rotate={item.rotate}
                />
              </View>
              <View className="flex-row items-baseline justify-between px-1">
                <Text className="text-sm font-semibold text-foreground">
                  {position ?? "Removed"}
                </Text>
                {position !== item.page ? (
                  <Text className="font-normal text-xs text-muted">
                    was {item.page}
                  </Text>
                ) : null}
              </View>
              <View className="flex-row justify-between">
                <PageButton
                  icon={ArrowLeft}
                  label={`Move ${label} earlier`}
                  disabled={settled || index === 0}
                  onPress={() => move(item.key, -1)}
                />
                <PageButton
                  icon={RotateCw}
                  label={`Turn ${label}`}
                  disabled={settled || item.removed}
                  onPress={() =>
                    change((pages) =>
                      pages.map((other) =>
                        other.key === item.key
                          ? { ...other, rotate: turn(other.rotate) }
                          : other,
                      ),
                    )
                  }
                />
                <PageButton
                  icon={item.removed ? Undo2 : Trash2}
                  label={item.removed ? `Restore ${label}` : `Remove ${label}`}
                  disabled={settled}
                  onPress={() =>
                    change((pages) =>
                      pages.map((other) =>
                        other.key === item.key
                          ? { ...other, removed: !other.removed }
                          : other,
                      ),
                    )
                  }
                />
                <PageButton
                  icon={ArrowRight}
                  label={`Move ${label} later`}
                  disabled={settled || index === pages.length - 1}
                  onPress={() => move(item.key, 1)}
                />
              </View>
            </View>
          );
        }}
      />

      {source ? (
        <View
          className="gap-3 border-t border-border bg-background px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <PdfJobFooter
            job={job}
            workingLabel="Saving your PDF…"
            againLabel="Edit another PDF"
            onAgain={() => {
              job.reset();
              choose(null);
            }}
            action={
              <Button isDisabled={!ready || kept.length === 0} onPress={save}>
                {job.status.phase === "error" ? "Try again" : "Save PDF"}
              </Button>
            }
          />
        </View>
      ) : null}
      {picker.sheet}
    </View>
  );
}
