"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useInView } from "@/hooks/use-in-view";
import { cn } from "@/lib/utils";
import { isPdf, toPdfName, type Rotation } from "@/utils/pdf-tools";
import {
  ArrowLeft,
  ArrowRight,
  FilePen,
  RotateCcw,
  RotateCw,
  Save,
  Trash2,
  Undo2,
} from "lucide-react";
import type {
  PDFDocumentProxy,
  RenderTask,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ConversionFailed,
  SelectedSource,
  SourcePicker,
} from "../../conversion/_components/conversion-parts";
import type { ConversionSource } from "../../conversion/_components/request-conversion";
import { PdfJobStatus, usePdfJob } from "./pdf-job";

interface EditedPage {
  key: number;
  /** The page's number in the original, from 1. */
  page: number;
  /** Added to the page's own turn. */
  rotate: Rotation;
  removed: boolean;
}

type Loaded =
  | { state: "loading" }
  | { state: "failed" }
  | { state: "ready"; doc: PDFDocumentProxy };

const turn = (rotate: Rotation, by: 90 | -90) =>
  ((((rotate + by) % 360) + 360) % 360) as Rotation;

// CSS pixels across a thumbnail
const THUMB_WIDTH = 150;

/** Opens the chosen PDF in the browser, for its thumbnails. */
function useOpenedPdf(source: ConversionSource | null): Loaded | null {
  const [opened, setOpened] = useState<{
    source: ConversionSource;
    loaded: Loaded;
  } | null>(null);

  useEffect(() => {
    if (!source) return;
    const controller = new AbortController();
    let destroy = () => {};
    const url =
      source.kind === "vaze"
        ? `/${source.file.url}`
        : URL.createObjectURL(source.file);

    import("@/utils/pdf-thumbnail")
      .then(({ openPdf }) => {
        controller.signal.throwIfAborted();
        const task = openPdf(url);
        destroy = () => void task.destroy().catch(() => {});
        return task.promise;
      })
      .then((doc) => {
        controller.signal.throwIfAborted();
        setOpened({ source, loaded: { state: "ready", doc } });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setOpened({ source, loaded: { state: "failed" } });
        }
      });

    return () => {
      controller.abort();
      destroy();
      if (source.kind === "device") URL.revokeObjectURL(url);
    };
  }, [source]);

  if (!source) return null;
  // until this file has opened, an earlier one's pages don't count
  return opened?.source === source ? opened.loaded : { state: "loading" };
}

/** Every page of `doc` as it is. */
const allPages = (doc: PDFDocumentProxy | null): EditedPage[] =>
  doc
    ? Array.from({ length: doc.numPages }, (_, i) => ({
        key: i,
        page: i + 1,
        rotate: 0,
        removed: false,
      }))
    : [];

function PageThumbnail({
  doc,
  page,
  rotate,
}: {
  doc: PDFDocumentProxy;
  page: number;
  rotate: Rotation;
}) {
  const [ref, visible] = useInView<HTMLDivElement>("200px");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!visible || !canvas) return;

    let task: RenderTask | null = null;
    let cancelled = false;

    doc
      .getPage(page)
      .then((pdfPage) => {
        if (cancelled) return;
        // drawn turned as the result will be, on top of the page's own turn
        const rotation = (pdfPage.rotate + rotate) % 360;
        const base = pdfPage.getViewport({ scale: 1, rotation });
        const viewport = pdfPage.getViewport({
          scale: (THUMB_WIDTH * (window.devicePixelRatio || 1)) / base.width,
          rotation,
        });
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        task = pdfPage.render({ canvas, viewport });
        return task.promise.then(() => setDrawn(true));
      })
      // a cancelled render rejects
      .catch(() => {});

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [visible, doc, page, rotate]);

  return (
    <div
      ref={ref}
      className="bg-muted relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md"
    >
      {!drawn && <Skeleton className="absolute inset-3" />}
      <canvas
        ref={canvasRef}
        className={cn(
          "max-h-full max-w-full bg-white shadow-sm",
          !drawn && "invisible",
        )}
      />
    </div>
  );
}

function PageCard({
  doc,
  item,
  position,
  isFirst,
  isLast,
  disabled,
  onChange,
  onMove,
}: {
  doc: PDFDocumentProxy;
  item: EditedPage;
  /** Its number in the result, or null when removed. */
  position: number | null;
  isFirst: boolean;
  isLast: boolean;
  disabled: boolean;
  onChange: (next: EditedPage) => void;
  onMove: (by: -1 | 1) => void;
}) {
  const label = `page ${item.page}`;

  return (
    <li className="bg-card rounded-lg border p-2">
      <div className={cn(item.removed && "opacity-30 grayscale")}>
        <PageThumbnail doc={doc} page={item.page} rotate={item.rotate} />
      </div>
      <div className="mt-2 flex items-baseline justify-between px-0.5 text-xs">
        <span className="font-semibold tabular-nums">
          {position ?? "Removed"}
        </span>
        {position !== item.page && (
          <span className="text-muted-foreground tabular-nums">
            was {item.page}
          </span>
        )}
      </div>
      <div className="mt-1 flex justify-between">
        <IconButton
          label={`Move ${label} earlier`}
          disabled={disabled || isFirst}
          onClick={() => onMove(-1)}
        >
          <ArrowLeft />
        </IconButton>
        <IconButton
          label={`Turn ${label} left`}
          disabled={disabled || item.removed}
          onClick={() => onChange({ ...item, rotate: turn(item.rotate, -90) })}
        >
          <RotateCcw />
        </IconButton>
        <IconButton
          label={`Turn ${label} right`}
          disabled={disabled || item.removed}
          onClick={() => onChange({ ...item, rotate: turn(item.rotate, 90) })}
        >
          <RotateCw />
        </IconButton>
        <IconButton
          label={item.removed ? `Restore ${label}` : `Remove ${label}`}
          disabled={disabled}
          onClick={() => onChange({ ...item, removed: !item.removed })}
        >
          {item.removed ? <Undo2 /> : <Trash2 />}
        </IconButton>
        <IconButton
          label={`Move ${label} later`}
          disabled={disabled || isLast}
          onClick={() => onMove(1)}
        >
          <ArrowRight />
        </IconButton>
      </div>
    </li>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-muted-foreground size-7"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  );
}

export default function EditPdf() {
  const job = usePdfJob();
  const [source, setSource] = useState<ConversionSource | null>(null);
  const loaded = useOpenedPdf(source);
  // edits belong to the document they were made on
  const [edited, setEdited] = useState<{
    doc: PDFDocumentProxy;
    pages: EditedPage[];
  } | null>(null);
  const [pageNumbers, setPageNumbers] = useState(false);
  const [title, setTitle] = useState("");
  const id = useId();

  const doc = loaded?.state === "ready" ? loaded.doc : null;
  const initialPages = useMemo(() => allPages(doc), [doc]);
  const pages = edited && edited.doc === doc ? edited.pages : initialPages;
  const kept = pages.filter((item) => !item.removed);

  const positions = new Map<number, number>();
  for (const item of kept) positions.set(item.key, positions.size + 1);

  function change(next: (pages: EditedPage[]) => EditedPage[]) {
    if (!doc) return;
    setEdited({ doc, pages: next(pages) });
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

  function choose(next: ConversionSource | null) {
    setSource(next);
    setTitle("");
    setPageNumbers(false);
    job.reset();
  }

  function save() {
    if (!source || kept.length === 0) return;
    job.start({
      url: "/api/pdf/edit",
      sources: [source],
      options: {
        pages: kept.map(({ page, rotate }) =>
          rotate ? { page, rotate } : page,
        ),
        pageNumbers,
        ...(title.trim() ? { title: title.trim() } : {}),
      },
      name: toPdfName(source.file.name),
    });
  }

  const removedCount = pages.length - kept.length;

  return (
    <Card>
      <CardContent>
        <div className="sm:p-4">
          <SourcePicker
            icon={FilePen}
            title="Choose a PDF to edit"
            hint="Move, turn and remove pages, and number them"
            accept="application/pdf,.pdf"
            filter={isPdf}
            disabled={job.busy}
            onChoose={choose}
          />

          {source && (
            <div className="mt-3 rounded-xl border p-4">
              <SelectedSource
                source={source}
                icon={FilePen}
                removeLabel="Remove selected PDF"
                disabled={job.busy}
                onRemove={() => choose(null)}
                action={
                  job.busy ? (
                    <Button variant="outline" onClick={job.cancel}>
                      Cancel
                    </Button>
                  ) : (
                    <Button disabled={!doc || kept.length === 0} onClick={save}>
                      <Save />
                      Save PDF
                    </Button>
                  )
                }
              />

              {loaded?.state === "failed" && (
                <div className="mt-4 border-t pt-4">
                  <ConversionFailed message="This PDF couldn't be opened. It may be damaged or protected with a password" />
                </div>
              )}

              {loaded?.state === "loading" && (
                <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-3 md:grid-cols-4">
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className="aspect-[3/4] rounded-lg" />
                  ))}
                </div>
              )}

              {doc && (
                <>
                  <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2 sm:items-end">
                    <div className="space-y-2">
                      <Label htmlFor={`${id}-title`}>Title</Label>
                      <Input
                        id={`${id}-title`}
                        placeholder="Keep the current title"
                        maxLength={500}
                        value={title}
                        disabled={job.busy}
                        onChange={(event) => {
                          setTitle(event.target.value);
                          job.reset();
                        }}
                      />
                    </div>
                    <div className="flex h-9 items-center gap-2">
                      <Checkbox
                        id={`${id}-numbers`}
                        checked={pageNumbers}
                        disabled={job.busy}
                        onCheckedChange={(checked) => {
                          setPageNumbers(checked === true);
                          job.reset();
                        }}
                      />
                      <Label htmlFor={`${id}-numbers`}>
                        Number the pages at the bottom
                      </Label>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-muted-foreground text-sm">
                      {kept.length} of {pages.length}{" "}
                      {pages.length === 1 ? "page" : "pages"}
                      {removedCount > 0 && ` · ${removedCount} removed`}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={job.busy}
                        onClick={() =>
                          change((pages) =>
                            pages.map((item) => ({
                              ...item,
                              rotate: turn(item.rotate, -90),
                            })),
                          )
                        }
                      >
                        <RotateCcw />
                        Turn all left
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={job.busy}
                        onClick={() =>
                          change((pages) =>
                            pages.map((item) => ({
                              ...item,
                              rotate: turn(item.rotate, 90),
                            })),
                          )
                        }
                      >
                        <RotateCw />
                        Turn all right
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={job.busy}
                        onClick={() =>
                          change((pages) =>
                            [...pages]
                              .sort((a, b) => a.page - b.page)
                              .map((item) => ({
                                ...item,
                                rotate: 0,
                                removed: false,
                              })),
                          )
                        }
                      >
                        <Undo2 />
                        Reset
                      </Button>
                    </div>
                  </div>

                  <ol className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {pages.map((item, index) => (
                      <PageCard
                        key={item.key}
                        doc={doc}
                        item={item}
                        position={positions.get(item.key) ?? null}
                        isFirst={index === 0}
                        isLast={index === pages.length - 1}
                        disabled={job.busy}
                        onChange={(next) =>
                          change((pages) =>
                            pages.map((other) =>
                              other.key === next.key ? next : other,
                            ),
                          )
                        }
                        onMove={(by) => move(item.key, by)}
                      />
                    ))}
                  </ol>
                </>
              )}
            </div>
          )}

          <PdfJobStatus status={job.status} workingLabel="Saving your PDF…" />
        </div>
      </CardContent>
    </Card>
  );
}
