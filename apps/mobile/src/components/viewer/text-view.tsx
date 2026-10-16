import type { File } from "@darseen/vaze";
import { useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { formatBytes } from "@/lib/format";
import { textStart } from "@/lib/previews";
import { useServer } from "../server-context";
import { Loading, NoPreview } from "./status";

// what the web shows before asking for a download
const TEXT_VIEW_BYTES = 1024 * 1024;

// one huge text node lays out slowly, so the text renders in pieces
const CHUNK_LINES = 80;
const CHUNK_CHARS = 4000;

function chunk(text: string) {
  const chunks: string[] = [];
  let lines: string[] = [];
  let length = 0;

  const flush = () => {
    if (lines.length > 0) chunks.push(lines.join("\n"));
    lines = [];
    length = 0;
  };

  for (const line of text.split("\n")) {
    // a minified file can be one enormous line
    for (
      let start = 0;
      start < Math.max(line.length, 1);
      start += CHUNK_CHARS
    ) {
      const piece = line.slice(start, start + CHUNK_CHARS);
      if (lines.length >= CHUNK_LINES || length + piece.length > CHUNK_CHARS) {
        flush();
      }
      lines.push(piece);
      length += piece.length;
    }
  }
  flush();
  return chunks;
}

export function TextView({ file }: { file: File }) {
  const { server, headers } = useServer();
  const [chunks, setChunks] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    textStart(
      { serverId: server.id, headers },
      file,
      TEXT_VIEW_BYTES,
      controller.signal,
    ).then(
      (text) => setChunks(chunk(text)),
      () => {
        if (!controller.signal.aborted) setFailed(true);
      },
    );
    return () => controller.abort();
  }, [server.id, headers, file]);

  if (failed) {
    return <NoPreview file={file} message="This file can't be shown as text" />;
  }
  if (chunks === null) return <Loading />;

  return (
    <FlatList
      data={chunks}
      keyExtractor={(_chunk, index) => String(index)}
      contentContainerClassName="p-3"
      initialNumToRender={4}
      renderItem={({ item, index }) => (
        <View
          className={
            index === 0
              ? "rounded-t-lg border border-b-0 border-border bg-surface px-3 pt-3"
              : "border-x border-border bg-surface px-3"
          }
        >
          <Text
            selectable
            className="text-[13px] leading-5 text-foreground"
            style={{ fontFamily: "monospace" }}
          >
            {item}
          </Text>
        </View>
      )}
      ListFooterComponent={
        <>
          <View className="h-3 rounded-b-lg border border-t-0 border-border bg-surface" />
          {file.size > TEXT_VIEW_BYTES ? (
            <Text className="font-normal mt-3 text-center text-sm text-muted">
              Showing the first {formatBytes(TEXT_VIEW_BYTES)}. Share the file
              to see the rest.
            </Text>
          ) : null}
        </>
      }
    />
  );
}
