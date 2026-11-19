import {
  describeRange,
  MAX_PDF_PAGES,
  PAGE_SIZE_INFO,
} from "@/utils/pdf-tools";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parentPort, workerData } from "node:worker_threads";
import {
  degrees,
  grayscale,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFPage,
  PDFRef,
  popGraphicsState,
  pushGraphicsState,
  StandardFonts,
} from "pdf-lib";
import type {
  JobInput,
  PdfJob,
  PdfJobFailure,
  PdfJobResult,
  PdfWorkerMessage,
} from "./jobs";

// pdf-lib parses and writes on the thread it runs on, so it runs here, away from requests

class JobError extends Error {
  constructor(
    readonly code: PdfJobFailure["code"],
    message: string,
  ) {
    super(message);
  }
}

// PDF viewers refuse pages longer than 200 inches
const MAX_PAGE_SIDE = 14_400;
// CSS pixels, so an image's page is the size it shows at on a screen
const POINTS_PER_PIXEL = 72 / 96;
const PAGE_NUMBER_SIZE = 10;
const PAGE_NUMBER_MARGIN = 22;

async function load({ path, name }: JobInput): Promise<PDFDocument> {
  const bytes = await readFile(path);
  let doc: PDFDocument;
  try {
    // keeps the original's producer and dates rather than stamping pdf-lib's
    doc = await PDFDocument.load(bytes, {
      updateMetadata: false,
      // checked below, as pdf-lib's own error can't be told apart by class
      ignoreEncryption: true,
    });
  } catch {
    throw new JobError("unreadable", `${name} isn't a PDF that can be read`);
  }
  // pdf-lib can't decrypt, and copied pages would come out scrambled
  if (doc.isEncrypted) {
    throw new JobError(
      "encrypted",
      `${name} is protected with a password or permissions, remove them first`,
    );
  }
  return doc;
}

async function create(): Promise<PDFDocument> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const now = new Date();
  doc.setProducer("Vaze");
  doc.setCreationDate(now);
  doc.setModificationDate(now);
  return doc;
}

async function save(doc: PDFDocument, output: string) {
  await writeFile(output, await doc.save());
}

const pageCount = (count: number) =>
  `${count} ${count === 1 ? "page" : "pages"}`;

function checkPageCount(count: number) {
  if (count > MAX_PDF_PAGES) {
    throw new JobError(
      "too-large",
      `The result would have ${count} pages, more than the ${MAX_PDF_PAGES} allowed`,
    );
  }
}

/** The page's turn in quarter turns clockwise, whatever the file wrote. */
function rotationOf(page: PDFPage): number {
  const angle = Math.round(page.getRotation().angle / 90) * 90;
  return ((angle % 360) + 360) % 360;
}

// a link's page is swapped for one of these names while pages are copied
const LINK_MARK = "VazeLink";

const linkMark = (source: number, index: number) =>
  PDFName.of(`${LINK_MARK}.${source}.${index}`);

/** A link's explicit destinations, whose first item is the page it goes to. */
function destinationsOf(annot: PDFDict): PDFArray[] {
  const found: PDFArray[] = [];
  const dest = annot.lookup(PDFName.of("Dest"));
  if (dest instanceof PDFArray) found.push(dest);
  const action = annot.lookup(PDFName.of("A"));
  if (action instanceof PDFDict) {
    const goTo = action.lookup(PDFName.of("D"));
    if (goTo instanceof PDFArray) found.push(goTo);
  }
  return found;
}

function annotationsOf(page: PDFPage): PDFDict[] {
  const annots = page.node.Annots();
  if (!annots) return [];
  return annots
    .asArray()
    .map((_, i) => annots.lookup(i))
    .filter((annot): annot is PDFDict => annot instanceof PDFDict);
}

/** Names each link's page instead of referring to it, so copying a page doesn't drag its link targets along. */
function unlinkPages(src: PDFDocument, source: number) {
  const indexOf = new Map(
    src.getPages().map((page, i) => [page.ref.toString(), i]),
  );
  for (const page of src.getPages()) {
    for (const annot of annotationsOf(page)) {
      for (const dest of destinationsOf(annot)) {
        const target = dest.get(0);
        const index =
          target instanceof PDFRef ? indexOf.get(target.toString()) : undefined;
        if (index !== undefined) dest.set(0, linkMark(source, index));
      }
    }
  }
}

/** Points each link at its page's copy, by mark, and drops links to pages left out. */
function relinkPages(out: PDFDocument, copies: Map<string, PDFRef>) {
  for (const page of out.getPages()) {
    const annots = page.node.Annots();
    if (!annots) continue;
    for (let i = annots.size() - 1; i >= 0; i--) {
      const annot = annots.lookup(i);
      if (!(annot instanceof PDFDict)) continue;
      for (const dest of destinationsOf(annot)) {
        const target = dest.get(0);
        if (!(target instanceof PDFName)) continue;
        const name = target.asString();
        if (!name.startsWith(`/${LINK_MARK}.`)) continue;
        const copy = copies.get(name);
        if (copy) {
          dest.set(0, copy);
        } else {
          annots.remove(i);
          break;
        }
      }
    }
  }
}

async function merge(
  job: Extract<PdfJob, { kind: "merge" }>,
): Promise<PdfJobResult> {
  const out = await create();
  const copies = new Map<string, PDFRef>();
  let count = 0;
  for (const [source, input] of job.inputs.entries()) {
    const src = await load(input);
    count += src.getPageCount();
    checkPageCount(count);
    unlinkPages(src, source);
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const [index, page] of pages.entries()) {
      copies.set(linkMark(source, index).asString(), page.ref);
      out.addPage(page);
    }
  }
  relinkPages(out, copies);
  await save(out, job.output);
  return { pages: count };
}

async function split(
  job: Extract<PdfJob, { kind: "split" }>,
): Promise<PdfJobResult> {
  const src = await load(job.input);
  const count = src.getPageCount();

  let parts;
  if ("every" in job.split) {
    parts = [];
    for (let from = 1; from <= count; from += job.split.every) {
      parts.push({ from, to: Math.min(from + job.split.every - 1, count) });
    }
  } else {
    parts = job.split.ranges.map(({ from, to }) => ({
      from,
      to: to === Infinity ? count : to,
    }));
    const outside = parts.find(({ to }) => to > count);
    if (outside) {
      throw new JobError(
        "input",
        `${job.input.name} has ${pageCount(count)}, fewer than ${describeRange(outside)} needs`,
      );
    }
  }
  const total = parts.reduce((sum, { from, to }) => sum + to - from + 1, 0);
  checkPageCount(total);

  await mkdir(job.outputDir, { recursive: true });
  unlinkPages(src, 0);
  for (const [index, { from, to }] of parts.entries()) {
    const out = await create();
    const indices = Array.from(
      { length: to - from + 1 },
      (_, i) => from - 1 + i,
    );
    const copies = new Map<string, PDFRef>();
    for (const [i, page] of (await out.copyPages(src, indices)).entries()) {
      copies.set(linkMark(0, indices[i]).asString(), page.ref);
      out.addPage(page);
    }
    relinkPages(out, copies);
    await save(out, path.join(job.outputDir, `${index}.pdf`));
  }
  return { pages: total, parts };
}

/** Writes each page's number at the foot of the page as it is shown, whichever way it is turned. */
async function addPageNumbers(doc: PDFDocument) {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  // the page's own drawing can leave the coordinates moved, so it is fenced off first
  const start = doc.context.register(
    doc.context.contentStream([pushGraphicsState()]),
  );
  const end = doc.context.register(
    doc.context.contentStream([popGraphicsState()]),
  );

  for (const [index, page] of doc.getPages().entries()) {
    const text = String(index + 1);
    const width = font.widthOfTextAtSize(text, PAGE_NUMBER_SIZE);
    const { x, y, width: w, height: h } = page.getCropBox();
    const m = PAGE_NUMBER_MARGIN;

    // where the shown page's bottom edge lies in the page's own space
    const place = {
      0: { x: x + w / 2 - width / 2, y: y + m },
      90: { x: x + w - m, y: y + h / 2 - width / 2 },
      180: { x: x + w / 2 + width / 2, y: y + h - m },
      270: { x: x + m, y: y + h / 2 + width / 2 },
    }[rotationOf(page) as 0 | 90 | 180 | 270];

    page.node.wrapContentStreams(start, end);
    page.drawText(text, {
      ...place,
      size: PAGE_NUMBER_SIZE,
      font,
      color: grayscale(0.35),
      rotate: degrees(rotationOf(page)),
    });
  }
}

async function edit(
  job: Extract<PdfJob, { kind: "edit" }>,
): Promise<PdfJobResult> {
  const src = await load(job.input);
  const count = src.getPageCount();
  const wanted =
    job.pages ?? src.getPageIndices().map((i) => ({ page: i + 1, rotate: 0 }));

  const missing = wanted.find(({ page }) => page > count);
  if (missing) {
    throw new JobError(
      "input",
      `${job.input.name} has ${pageCount(count)}, so it has no page ${missing.page}`,
    );
  }
  checkPageCount(wanted.length);

  // a fresh document, so removed pages don't linger unseen in the file
  const out = await create();
  const indices = wanted.map(({ page }) => page - 1);
  const firstCopies = new Map<number, PDFPage>();
  const copies = new Map<string, PDFRef>();
  const unique = [...new Set(indices)];
  unlinkPages(src, 0);
  for (const [i, page] of (await out.copyPages(src, unique)).entries()) {
    firstCopies.set(unique[i], page);
    // a link to a repeated page goes to its first appearance
    copies.set(linkMark(0, unique[i]).asString(), page.ref);
  }

  for (const [position, { page: number, rotate }] of wanted.entries()) {
    const index = number - 1;
    // one page object can't sit in the page tree twice, so a repeat is a new copy
    const isRepeat = indices.indexOf(index) !== position;
    const page = isRepeat
      ? (await out.copyPages(src, [index]))[0]
      : firstCopies.get(index)!;
    if (rotate) page.setRotation(degrees((rotationOf(page) + rotate) % 360));
    out.addPage(page);
  }

  relinkPages(out, copies);

  // the original's details carry over, besides when it was changed
  const title = job.title ?? src.getTitle();
  if (title) out.setTitle(title);
  const author = src.getAuthor();
  if (author) out.setAuthor(author);
  const subject = src.getSubject();
  if (subject) out.setSubject(subject);
  const keywords = src.getKeywords();
  if (keywords) out.setKeywords([keywords]);
  const creator = src.getCreator();
  if (creator) out.setCreator(creator);
  const created = src.getCreationDate();
  if (created) out.setCreationDate(created);

  if (job.pageNumbers) await addPageNumbers(out);

  await save(out, job.output);
  return { pages: wanted.length };
}

async function images(
  job: Extract<PdfJob, { kind: "images" }>,
): Promise<PdfJobResult> {
  checkPageCount(job.images.length);
  const out = await create();
  const { margin } = job;
  const paper = PAGE_SIZE_INFO[job.pageSize].size;

  for (const image of job.images) {
    const bytes = await readFile(image.path);
    const embedded =
      image.type === "jpg"
        ? await out.embedJpg(bytes)
        : await out.embedPng(bytes);

    let pageWidth: number;
    let pageHeight: number;
    let drawWidth: number;
    let drawHeight: number;

    if (paper) {
      // the paper turns to match the image
      const landscape = image.width > image.height;
      [pageWidth, pageHeight] = landscape ? [paper[1], paper[0]] : paper;
      const scale = Math.min(
        (pageWidth - 2 * margin) / image.width,
        (pageHeight - 2 * margin) / image.height,
      );
      drawWidth = image.width * scale;
      drawHeight = image.height * scale;
    } else {
      const scale = Math.min(
        POINTS_PER_PIXEL,
        (MAX_PAGE_SIDE - 2 * margin) / Math.max(image.width, image.height),
      );
      drawWidth = image.width * scale;
      drawHeight = image.height * scale;
      pageWidth = drawWidth + 2 * margin;
      pageHeight = drawHeight + 2 * margin;
    }

    const page = out.addPage([pageWidth, pageHeight]);
    page.drawImage(embedded, {
      x: (pageWidth - drawWidth) / 2,
      y: (pageHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    });
  }

  await save(out, job.output);
  return { pages: job.images.length };
}

async function run(job: PdfJob): Promise<PdfJobResult> {
  switch (job.kind) {
    case "merge":
      return merge(job);
    case "split":
      return split(job);
    case "edit":
      return edit(job);
    case "images":
      return images(job);
  }
}

run(workerData as PdfJob).then(
  (result) =>
    parentPort!.postMessage({ ok: true, result } satisfies PdfWorkerMessage),
  (error: unknown) => {
    if (error instanceof JobError) {
      parentPort!.postMessage({
        ok: false,
        failure: { code: error.code, message: error.message },
      } satisfies PdfWorkerMessage);
      return;
    }
    // anything else is a fault of the file's, pdf-lib's or the server's; the caller logs it
    throw error;
  },
);
