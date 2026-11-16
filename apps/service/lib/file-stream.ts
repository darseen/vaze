import { open, type FileHandle } from "node:fs/promises";

// large enough that per-chunk overhead stops mattering, small enough to hold two per download
const CHUNK_SIZE = 256 * 1024;

export interface ChunkReader {
  /** The next chunk, or null once the range or the file has ended. */
  read(): Promise<Buffer | null>;
  close(): Promise<void>;
}

/**
 * Read bytes `start` to `end` (inclusive) of a file chunk by chunk. The file is
 * opened by the first read, and the chunk after the one handed out is always
 * already on its way from disk.
 */
export function chunkReader(
  path: string,
  start: number,
  end: number,
): ChunkReader {
  let handle: FileHandle | undefined;
  let position = start;
  let closed = false;
  // the read in flight, so close() can wait for it instead of racing it
  let ahead: Promise<Buffer | null> | undefined;

  const release = async () => {
    const current = handle;
    handle = undefined;
    await current?.close();
  };

  const readNext = async (): Promise<Buffer | null> => {
    const length = Math.min(CHUNK_SIZE, end - position + 1);
    if (closed || length <= 0) return null;

    handle ??= await open(path, "r");
    const { bytesRead, buffer } = await handle.read(
      Buffer.allocUnsafeSlow(length),
      0,
      length,
      position,
    );

    // a short read is the end of the file, whatever `end` says
    position = bytesRead < length ? end + 1 : position + bytesRead;
    if (position > end) await release();

    if (bytesRead === 0) return null;
    return bytesRead === length ? buffer : buffer.subarray(0, bytesRead);
  };

  return {
    async read() {
      const chunk = await (ahead ??= readNext());
      ahead = chunk ? readNext() : undefined;
      // a failed read ahead is reported by the read that awaits it
      ahead?.catch(() => {});
      return chunk;
    },
    async close() {
      closed = true;
      await ahead?.catch(() => {});
      ahead = undefined;
      await release();
    },
  };
}

/**
 * A byte range of a file as a response body. `onBytes` sees each chunk as it
 * is handed to the client.
 */
export function fileStream(
  path: string,
  start: number,
  end: number,
  onBytes?: (bytes: number) => void,
): ReadableStream<Uint8Array> {
  const reader = chunkReader(path, start, end);

  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        try {
          const chunk = await reader.read();
          if (!chunk) {
            await reader.close();
            controller.close();
            return;
          }
          onBytes?.(chunk.byteLength);
          controller.enqueue(chunk);
        } catch (error) {
          await reader.close().catch(() => {});
          throw error;
        }
      },
      cancel: () => reader.close(),
    },
    // nothing is opened until the body is read, which a HEAD response never is
    { highWaterMark: 0 },
  );
}
