const extensionOf = (name: string) =>
  /\.([^./\\]+)$/.exec(name)?.[1]?.toLowerCase() ?? "";

const baseName = (name: string, fallback: string) =>
  name.replace(/\.[^./\\]+$/, "") || fallback;

export const toPdfName = (name: string) => `${baseName(name, "document")}.pdf`;

export const isPdf = (file: { name: string; mimeType: string }) =>
  extensionOf(file.name) === "pdf" || file.mimeType === "application/pdf";

/** The most files one merge or one images-to-PDF request takes. */
export const MAX_PDF_SOURCES = 100;

/** The most bytes one request reads in all, as pdf-lib holds them in memory. */
export const MAX_PDF_INPUT_SIZE = 512 * 1024 ** 2;

/** The most pages one result may have. */
export const MAX_PDF_PAGES = 10_000;

/** A run of pages, numbered from 1 and inclusive. */
export interface PageRange {
  from: number;
  to: number;
}

/** Reads ranges like "1-3, 5, 8-" or says what's wrong; without `pageCount`, "8-" ends at Infinity. */
export function parsePageRanges(
  text: string,
  pageCount = Infinity,
): PageRange[] | string {
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
    const to = match[3] ? Number(match[3]) : match[2] ? pageCount : from;
    if (from < 1 || to < from)
      return `"${item}" isn't a range that runs forward`;
    if (to > pageCount) {
      return `"${item}" goes past the last page, ${pageCount}`;
    }
    ranges.push({ from, to });
  }
  return ranges;
}

export const describeRange = ({ from, to }: PageRange) =>
  from === to ? `page ${from}` : `pages ${from}-${to}`;

/** One part of a split, e.g. "report (pages 1-3).pdf". */
export const toPartName = (name: string, range: PageRange) =>
  `${baseName(name, "document")} (${describeRange(range)}).pdf`;

export const toMergedName = (firstName: string) =>
  `${baseName(firstName, "merged")} (merged).pdf`;

export const toSplitArchiveName = (name: string) =>
  `${baseName(name, "document")} (split)`;

/** Pages an image is placed on, in points; "fit" makes each page the image's size. */
export const PAGE_SIZES = ["fit", "a4", "letter"] as const;

export type PageSize = (typeof PAGE_SIZES)[number];

export const PAGE_SIZE_INFO: Record<
  PageSize,
  { label: string; size: [number, number] | null }
> = {
  fit: { label: "Same as image", size: null },
  a4: { label: "A4", size: [595.28, 841.89] },
  letter: { label: "Letter", size: [612, 792] },
};

/** The widest margin images-to-PDF takes, in points (2 inches). */
export const MAX_PAGE_MARGIN = 144;

/** Quarter turns, clockwise. */
export const ROTATIONS = [0, 90, 180, 270] as const;

export type Rotation = (typeof ROTATIONS)[number];

/** A page of an edited PDF: which page of the original, turned how far. */
export interface EditedPage {
  page: number;
  rotate: Rotation;
}

// what LibreOffice turns into a PDF, by the extension it reads the type from
const DOCUMENT_EXTENSIONS = new Set([
  // text documents
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
  // spreadsheets
  "xls",
  "xlsx",
  "xlsm",
  "ods",
  "fods",
  "csv",
  // presentations
  "ppt",
  "pptx",
  "pps",
  "ppsx",
  "odp",
  "fodp",
]);

export const documentExtension = (name: string) => {
  const extension = extensionOf(name);
  return DOCUMENT_EXTENSIONS.has(extension) ? extension : null;
};

export const isConvertibleDocument = (file: { name: string }) =>
  documentExtension(file.name) !== null;

/** The picker's `accept` for documents. */
export const DOCUMENT_ACCEPT = [...DOCUMENT_EXTENSIONS]
  .map((extension) => `.${extension}`)
  .join(",");
