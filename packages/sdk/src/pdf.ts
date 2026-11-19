import Base from "./base.js";
import type {
  ConversionSource,
  ImagesToPdfOptions,
  PdfEditOptions,
  PdfSplitOptions,
} from "./types/index.js";

type Options = Record<string, string | number | boolean | object | undefined>;

/** Merging, splitting and editing PDFs, and making them from other files. */
export default class Pdf extends Base {
  /** Sends stored files by id and device files as uploads, in order; JSON when all are stored. */
  private async send(
    url: string,
    sources: ConversionSource[],
    options: Options = {},
    { single }: { single: boolean },
  ) {
    if (sources.every((source) => "id" in source)) {
      const ids = sources.map((source) => (source as { id: string }).id);
      return await this.requestBlob(url, "POST", {
        ...(single ? { fileId: ids[0] } : { fileIds: ids }),
        ...options,
      });
    }

    const formData = new FormData();
    for (const [name, value] of Object.entries(options)) {
      if (value === undefined) continue;
      formData.append(
        name,
        typeof value === "object" ? JSON.stringify(value) : String(value),
      );
    }
    for (const source of sources) {
      if ("id" in source) formData.append("fileId", source.id);
      // React Native's FormData reads uri, name and type off a plain object
      else formData.append("file", source.file as Blob);
    }
    return await this.requestBlob(url, "POST", formData);
  }

  /** Join 2 to 100 PDFs into one, in the order given. */
  public async merge(sources: ConversionSource[]) {
    return await this.send(this.mergeUrl(), sources, {}, { single: false });
  }

  /** Where `merge` posts; send the request yourself with `authHeaders()`. */
  public mergeUrl() {
    return this.apiUrl("/api/pdf/merge");
  }

  /** Cut a PDF into PDFs in a ZIP, by `ranges` like "1-3, 7-" or `every` n pages; one per page by default. */
  public async split(source: ConversionSource, options: PdfSplitOptions = {}) {
    return await this.send(this.splitUrl(), [source], options, {
      single: true,
    });
  }

  /** Where `split` posts; send the request yourself with `authHeaders()`. */
  public splitUrl() {
    return this.apiUrl("/api/pdf/split");
  }

  /** Keep, reorder, repeat and turn pages with `pages`, number them, and set a `title`. */
  public async edit(source: ConversionSource, options: PdfEditOptions) {
    return await this.send(this.editUrl(), [source], options, {
      single: true,
    });
  }

  /** Where `edit` posts; send the request yourself with `authHeaders()`. */
  public editUrl() {
    return this.apiUrl("/api/pdf/edit");
  }

  /** Make a PDF with one image on each page, in the order given. */
  public async fromImages(
    sources: ConversionSource[],
    options: ImagesToPdfOptions = {},
  ) {
    return await this.send(this.fromImagesUrl(), sources, options, {
      single: false,
    });
  }

  /** Where `fromImages` posts; send the request yourself with `authHeaders()`. */
  public fromImagesUrl() {
    return this.apiUrl("/api/pdf/from-images");
  }

  /** Turn a document, spreadsheet or presentation, such as a DOCX, into a PDF. */
  public async fromDocument(source: ConversionSource) {
    return await this.send(
      this.fromDocumentUrl(),
      [source],
      {},
      {
        single: true,
      },
    );
  }

  /** Where `fromDocument` posts; send the request yourself with `authHeaders()`. */
  public fromDocumentUrl() {
    return this.apiUrl("/api/pdf/from-document");
  }
}
