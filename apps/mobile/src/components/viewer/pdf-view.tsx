import type { File } from "@darseen/vaze";
import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { FlatList, PixelRatio, View } from "react-native";
import { pdfDocument, pdfInfo, pdfPageImage } from "@/lib/previews";
import { useServer } from "../server-context";
import { Loading, NoPreview } from "./status";

const PADDING = 12;
const GAP = 12;

type Pdf = { path: string; ratios: number[] };

// pages render one at a time, and a page scrolled past before its turn is skipped
let queue: Promise<unknown> = Promise.resolve();

function renderInTurn<T>(task: () => Promise<T>, wanted: () => boolean) {
  const turn = queue.then(() => {
    if (!wanted()) throw new Error("Skipped");
    return task();
  });
  queue = turn.catch(() => {});
  return turn;
}

function PdfPage({
  file,
  path,
  index,
  width,
  height,
}: {
  file: File;
  path: string;
  index: number;
  width: number;
  height: number;
}) {
  const { server } = useServer();
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const pixels = Math.round(width * PixelRatio.get());
    renderInTurn(
      () => pdfPageImage(server.id, file, path, index, pixels),
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
  }, [server.id, file, path, index, width]);

  return (
    <View style={{ width, height }} className="overflow-hidden bg-white">
      {uri ? (
        <Image
          source={{ uri }}
          style={{ flex: 1 }}
          contentFit="fill"
          transition={100}
        />
      ) : null}
    </View>
  );
}

export function PdfView({
  file,
  pageWidth,
}: {
  file: File;
  pageWidth: number;
}) {
  const { server, headers } = useServer();
  const [pdf, setPdf] = useState<Pdf | null>(null);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    pdfDocument({ serverId: server.id, headers }, file, (fraction) => {
      if (mounted) setProgress(fraction);
    })
      .then(async (path) => {
        const { pages } = await pdfInfo(path);
        if (pages.length === 0) throw new Error("No pages");
        if (mounted) {
          setPdf({
            path,
            ratios: pages.map((page) => page.height / page.width),
          });
        }
      })
      .catch(() => {
        if (mounted) setFailed(true);
      });
    return () => {
      mounted = false;
    };
  }, [server.id, headers, file]);

  const width = pageWidth - PADDING * 2;
  const layout = useMemo(() => {
    let offset = PADDING;
    return (pdf?.ratios ?? []).map((ratio) => {
      const height = Math.round(width * ratio);
      const entry = { length: height + GAP, offset, height };
      offset += height + GAP;
      return entry;
    });
  }, [pdf, width]);

  if (failed) {
    return <NoPreview file={file} message="This PDF couldn't be opened" />;
  }
  if (!pdf) {
    return (
      <Loading
        label={
          progress > 0
            ? `Downloading ${Math.round(progress * 100)}%`
            : undefined
        }
      />
    );
  }

  return (
    <FlatList
      data={pdf.ratios}
      keyExtractor={(_ratio, index) => String(index)}
      contentContainerStyle={{ padding: PADDING }}
      ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
      getItemLayout={(_data, index) => ({
        length: layout[index].length,
        offset: layout[index].offset,
        index,
      })}
      initialNumToRender={2}
      windowSize={5}
      renderItem={({ index }) => (
        <PdfPage
          file={file}
          path={pdf.path}
          index={index}
          width={width}
          height={layout[index].height}
        />
      )}
    />
  );
}
