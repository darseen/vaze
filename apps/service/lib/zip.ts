import { contentDisposition } from "@/app/api/_utils";
import { chunkReader } from "@/lib/file-stream";
import { NextResponse } from "next/server";
import { crc32 } from "node:zlib";

export type ZipEntry =
  | { type: "directory"; name: string; mtime: Date }
  | { type: "file"; name: string; path: string; size: number; mtime: Date };

/** Name for an archive of a folder key; the root has no name of its own. */
export function archiveName(folderKey: string): string {
  return folderKey ? folderKey.slice(folderKey.lastIndexOf("/") + 1) : "files";
}

// a field holding one of these is a placeholder for its ZIP64 counterpart
const UINT16_MAX = 0xffff;
const UINT32_MAX = 0xffffffff;

// Unix, written to version 6.3 of the format
const VERSION_MADE_BY = (3 << 8) | 63;
const VERSION_NEEDED = 20;
const VERSION_NEEDED_ZIP64 = 45;

const NAME_IS_UTF8 = 1 << 11;
// the checksum is only known once the file has streamed, so it trails the data
const CRC_FOLLOWS_DATA = 1 << 3;

const DIRECTORY_MODE = 0o40775;
const FILE_MODE = 0o100664;

// headers and files below this size share a chunk instead of costing a write each
const GATHER_BELOW = 64 * 1024;

const MIN_DOS_DATE = new Date(1980, 0, 1);
const MAX_DOS_DATE = new Date(2107, 11, 31, 23, 59, 58);

interface Member {
  name: Buffer;
  /** Set for a file with content; folders and empty files have nothing to read. */
  path?: string;
  size: number;
  /** Where its local header starts in the archive. */
  offset: number;
  crc: number;
  attributes: number;
  dosTime: number;
  dosDate: number;
  /** Seconds since the epoch, for the extended timestamp field. */
  mtime: number;
}

function toMember(entry: ZipEntry, offset: number): Member {
  // extractors treat a leading drive letter as an absolute path
  if (/^[a-zA-Z]:/.test(entry.name)) {
    throw new Error(`Cannot archive the absolute path "${entry.name}"`);
  }

  const directory = entry.type === "directory";
  const name = Buffer.from(directory ? `${entry.name}/` : entry.name);
  if (name.length > UINT16_MAX) {
    throw new Error(`Name too long to archive: "${entry.name}"`);
  }

  const date =
    entry.mtime < MIN_DOS_DATE
      ? MIN_DOS_DATE
      : entry.mtime > MAX_DOS_DATE
        ? MAX_DOS_DATE
        : entry.mtime;
  const size = directory ? 0 : entry.size;

  return {
    name,
    path: !directory && size > 0 ? entry.path : undefined,
    size,
    offset,
    crc: 0,
    attributes: ((directory ? DIRECTORY_MODE : FILE_MODE) << 16) >>> 0,
    dosTime:
      Math.floor(date.getSeconds() / 2) |
      (date.getMinutes() << 5) |
      (date.getHours() << 11),
    dosDate:
      date.getDate() |
      ((date.getMonth() + 1) << 5) |
      ((date.getFullYear() - 1980) << 9),
    mtime: Math.min(
      Math.max(Math.floor(entry.mtime.getTime() / 1000), 0),
      0x7fffffff,
    ),
  };
}

const flagsOf = (member: Member) =>
  member.path === undefined ? NAME_IS_UTF8 : NAME_IS_UTF8 | CRC_FOLLOWS_DATA;

const needsZip64 = (member: Member) =>
  member.size >= UINT32_MAX || member.offset >= UINT32_MAX;

function localHeader(member: Member): Buffer {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(VERSION_NEEDED, 4);
  header.writeUInt16LE(flagsOf(member), 6);
  header.writeUInt16LE(member.dosTime, 10);
  header.writeUInt16LE(member.dosDate, 12);
  // checksum and sizes stay zero: the descriptor and the directory carry them
  header.writeUInt16LE(member.name.length, 26);
  return Buffer.concat([header, member.name]);
}

const descriptorSize = (member: Member) =>
  member.path === undefined ? 0 : needsZip64(member) ? 24 : 16;

function dataDescriptor(member: Member): Buffer {
  const descriptor = Buffer.alloc(descriptorSize(member));
  descriptor.writeUInt32LE(0x08074b50, 0);
  descriptor.writeUInt32LE(member.crc, 4);

  if (needsZip64(member)) {
    descriptor.writeBigUInt64LE(BigInt(member.size), 8);
    descriptor.writeBigUInt64LE(BigInt(member.size), 16);
  } else {
    descriptor.writeUInt32LE(member.size, 8);
    descriptor.writeUInt32LE(member.size, 12);
  }

  return descriptor;
}

function directoryRecord(member: Member): Buffer {
  const zip64 = needsZip64(member);

  // extended timestamp, so extractors restore the time in UTC
  const timestamp = Buffer.alloc(9);
  timestamp.writeUInt16LE(0x5455, 0);
  timestamp.writeUInt16LE(5, 2);
  timestamp.writeUInt8(3, 4);
  timestamp.writeUInt32LE(member.mtime, 5);

  const wide = Buffer.alloc(zip64 ? 28 : 0);
  if (zip64) {
    wide.writeUInt16LE(0x0001, 0);
    wide.writeUInt16LE(24, 2);
    wide.writeBigUInt64LE(BigInt(member.size), 4);
    wide.writeBigUInt64LE(BigInt(member.size), 12);
    wide.writeBigUInt64LE(BigInt(member.offset), 20);
  }

  const record = Buffer.alloc(46);
  record.writeUInt32LE(0x02014b50, 0);
  record.writeUInt16LE(VERSION_MADE_BY, 4);
  record.writeUInt16LE(zip64 ? VERSION_NEEDED_ZIP64 : VERSION_NEEDED, 6);
  record.writeUInt16LE(flagsOf(member), 8);
  record.writeUInt16LE(member.dosTime, 12);
  record.writeUInt16LE(member.dosDate, 14);
  record.writeUInt32LE(member.crc, 16);
  record.writeUInt32LE(zip64 ? UINT32_MAX : member.size, 20);
  record.writeUInt32LE(zip64 ? UINT32_MAX : member.size, 24);
  record.writeUInt16LE(member.name.length, 28);
  record.writeUInt16LE(timestamp.length + wide.length, 30);
  record.writeUInt32LE(member.attributes, 38);
  record.writeUInt32LE(zip64 ? UINT32_MAX : member.offset, 42);

  return Buffer.concat([record, member.name, timestamp, wide]);
}

function endRecords(count: number, size: number, offset: number): Buffer {
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Math.min(count, UINT16_MAX), 8);
  end.writeUInt16LE(Math.min(count, UINT16_MAX), 10);
  end.writeUInt32LE(Math.min(size, UINT32_MAX), 12);
  end.writeUInt32LE(Math.min(offset, UINT32_MAX), 16);

  if (count < UINT16_MAX && size < UINT32_MAX && offset < UINT32_MAX) {
    return end;
  }

  const wide = Buffer.alloc(56);
  wide.writeUInt32LE(0x06064b50, 0);
  wide.writeBigUInt64LE(BigInt(44), 4);
  wide.writeUInt16LE(VERSION_MADE_BY, 12);
  wide.writeUInt16LE(VERSION_NEEDED_ZIP64, 14);
  wide.writeBigUInt64LE(BigInt(count), 24);
  wide.writeBigUInt64LE(BigInt(count), 32);
  wide.writeBigUInt64LE(BigInt(size), 40);
  wide.writeBigUInt64LE(BigInt(offset), 48);

  const locator = Buffer.alloc(20);
  locator.writeUInt32LE(0x07064b50, 0);
  locator.writeBigUInt64LE(BigInt(offset + size), 8);
  locator.writeUInt32LE(1, 16);

  return Buffer.concat([wide, locator, end]);
}

/** Every member's place in the archive, which also fixes the archive's exact size. */
function layOut(entries: ZipEntry[]) {
  let offset = 0;
  let directorySize = 0;

  const members = entries.map((entry) => {
    const member = toMember(entry, offset);
    offset += 30 + member.name.length + member.size + descriptorSize(member);
    directorySize +=
      46 + member.name.length + 9 + (needsZip64(member) ? 28 : 0);
    return member;
  });

  const end = endRecords(members.length, directorySize, offset);
  return { members, size: offset + directorySize + end.length };
}

async function* archiveChunks(members: Member[]): AsyncGenerator<Buffer> {
  let gathered: Buffer[] = [];
  let gatheredBytes = 0;

  const gather = (buffer: Buffer) => {
    gathered.push(buffer);
    gatheredBytes += buffer.length;
  };
  const flush = () => {
    const chunk = Buffer.concat(gathered, gatheredBytes);
    gathered = [];
    gatheredBytes = 0;
    return chunk;
  };

  for (const member of members) {
    gather(localHeader(member));
    if (member.path === undefined) continue;

    // bounded so a file growing mid-read cannot overrun Content-Length
    const reader = chunkReader(member.path, 0, member.size - 1);
    try {
      let remaining = member.size;
      for (let chunk; (chunk = await reader.read());) {
        member.crc = crc32(chunk, member.crc);
        remaining -= chunk.length;

        if (chunk.length < GATHER_BELOW) {
          gather(chunk);
          if (gatheredBytes >= GATHER_BELOW) yield flush();
        } else {
          if (gatheredBytes > 0) yield flush();
          yield chunk;
        }
      }
      if (remaining !== 0) {
        throw new Error(`"${member.path}" shrank while it was being archived`);
      }
    } finally {
      await reader.close();
    }

    gather(dataDescriptor(member));
  }

  const directoryOffset = members.reduce(
    (sum, member) =>
      sum + 30 + member.name.length + member.size + descriptorSize(member),
    0,
  );
  let directorySize = 0;
  for (const member of members) {
    const record = directoryRecord(member);
    directorySize += record.length;
    gather(record);
    if (gatheredBytes >= GATHER_BELOW) yield flush();
  }

  gather(endRecords(members.length, directorySize, directoryOffset));
  yield flush();
}

/** Stream entries as an uncompressed zip, so its exact size is known up front. */
export function streamZipResponse(
  entries: ZipEntry[],
  filename: string,
): NextResponse {
  const { members, size } = layOut(entries);
  const chunks = archiveChunks(members);

  const body = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        try {
          const { done, value } = await chunks.next();
          if (done) controller.close();
          else controller.enqueue(value);
        } catch (error) {
          console.error("error streaming zip:", error);
          throw error;
        }
      },
      // on a client disconnect this closes the file being read
      async cancel() {
        await chunks.return(undefined);
      },
    },
    // no file is opened until the response is read
    { highWaterMark: 0 },
  );

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": contentDisposition(
        "attachment",
        `${filename}.zip`,
      ),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Length": String(size),
    },
  });
}
