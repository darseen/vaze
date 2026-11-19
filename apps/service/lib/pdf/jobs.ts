import type { EditedPage, PageRange, PageSize } from "@/utils/pdf-tools";

/** A file the worker reads, and the name its errors call it by. */
export interface JobInput {
  path: string;
  name: string;
}

export interface PreparedImage {
  path: string;
  type: "jpg" | "png";
  width: number;
  height: number;
}

/** What the worker thread is asked to do; every path is on local disk. */
export type PdfJob =
  | { kind: "merge"; inputs: JobInput[]; output: string }
  | {
      kind: "split";
      input: JobInput;
      /** Ranges to cut, where `to` may be Infinity for the last page, or a part every `every` pages. */
      split: { ranges: PageRange[] } | { every: number };
      /** Part n is written to `<outputDir>/<n>.pdf`. */
      outputDir: string;
    }
  | {
      kind: "edit";
      input: JobInput;
      /** The pages to keep, in order; null keeps them all as they are. */
      pages: EditedPage[] | null;
      pageNumbers: boolean;
      title: string | null;
      output: string;
    }
  | {
      kind: "images";
      images: PreparedImage[];
      pageSize: PageSize;
      margin: number;
      output: string;
    };

export interface PdfJobResult {
  /** Pages in the result, or in all of a split's parts together. */
  pages: number;
  /** A split's parts, in the order they were written. */
  parts?: PageRange[];
}

export type PdfJobFailure = {
  /** "input" means one of the files is unusable or a page asked for doesn't exist. */
  code: "encrypted" | "unreadable" | "input" | "too-large";
  message: string;
};

export type PdfWorkerMessage =
  { ok: true; result: PdfJobResult } | { ok: false; failure: PdfJobFailure };
