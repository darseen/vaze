import type Vaze from "@darseen/vaze";
import { convert, type ConversionSource, type Handlers } from "./conversion";
import { extensionOf } from "./file-kind";

export type PdfToolSlug =
  "merge" | "split" | "edit" | "from-images" | "from-document";

export const PDF_MIME_TYPE = "application/pdf";
export const ZIP_MIME_TYPE = "application/zip";

export const isPdf = (file: { name: string; mimeType: string }) =>
  extensionOf(file.name) === "pdf" || file.mimeType === PDF_MIME_TYPE;

// what the server's LibreOffice turns into a PDF, by extension
const DOCUMENT_EXTENSIONS = new Set([
  "doc",
  "docx",
  "docm",
  "dot",
  "dotx",
  "odt",
  "ott",
  "fodt",
  "rtf",
  "txt",
  "xls",
  "xlsx",
  "xlsm",
  "ods",
  "fods",
  "csv",
  "ppt",
  "pptx",
  "pps",
  "ppsx",
  "odp",
  "fodp",
]);

export const isConvertibleDocument = (file: { name: string }) =>
  DOCUMENT_EXTENSIONS.has(extensionOf(file.name));

/** What the phone's file picker offers for documents. */
export const DOCUMENT_MIME_TYPES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-word.document.macroEnabled.12",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.text-template",
  "application/rtf",
  "text/rtf",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "application/vnd.oasis.opendocument.spreadsheet",
  "text/csv",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
  "application/vnd.oasis.opendocument.presentation",
];

const baseName = (name: string, fallback: string) =>
  name.replace(/\.[^./\\]+$/, "") || fallback;

// named as the server names them, so a shared file looks the same from either
export const toPdfName = (name: string) => `${baseName(name, "document")}.pdf`;

export const toMergedName = (firstName: string) =>
  `${baseName(firstName, "merged")} (merged).pdf`;

export const toSplitName = (name: string) =>
  `${baseName(name, "document")} (split).zip`;

/** A run of pages, numbered from 1 and inclusive. */
export type PageRange = { from: number; to: number };

/**
 * Reads ranges such as "1-3, 5, 8-", where "8-" runs to the last page, and
 * returns them or what is wrong with them; the server checks the page count.
 */
export function parsePageRanges(text: string): PageRange[] | string {
  const items = text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (items.length === 0) return "Give at least one page or range";

  const ranges: PageRange[] = [];
  for (const item of items) {
    const match = /^(\d+)?\s*(-)?\s*(\d+)?$/.exec(item);
    if (!match || (!match[1] && !match[3])) {
      return `"${item}" isn't a page or a range like 1-3`;
    }
    const from = match[1] ? Number(match[1]) : 1;
    const to = match[3] ? Number(match[3]) : match[2] ? Infinity : from;
    if (from < 1 || to < from) {
      return `"${item}" isn't a range that runs forward`;
    }
    ranges.push({ from, to });
  }
  return ranges;
}

/** Quarter turns clockwise, added to a page's own. */
export type Rotation = 0 | 90 | 180 | 270;

export type PdfToolRequest = {
  tool: PdfToolSlug;
  sources: ConversionSource[];
  options?: Record<string, string | number | boolean | object | undefined>;
  /** What the result is called in the app's cache. */
  name: string;
};

const TAKES_SEVERAL: PdfToolSlug[] = ["merge", "from-images"];

const toolUrl = (vaze: Vaze, tool: PdfToolSlug) =>
  ({
    merge: () => vaze.pdf.mergeUrl(),
    split: () => vaze.pdf.splitUrl(),
    edit: () => vaze.pdf.editUrl(),
    "from-images": () => vaze.pdf.fromImagesUrl(),
    "from-document": () => vaze.pdf.fromDocumentUrl(),
  })[tool]();

/** Runs a PDF tool on the server into the app's cache; returns a function that cancels it. */
export function runPdfTool(
  vaze: Vaze,
  { tool, sources, options, name }: PdfToolRequest,
  handlers: Handlers,
) {
  return convert(
    vaze,
    sources,
    {
      url: toolUrl(vaze, tool),
      name,
      options,
      many: TAKES_SEVERAL.includes(tool),
    },
    handlers,
  );
}
