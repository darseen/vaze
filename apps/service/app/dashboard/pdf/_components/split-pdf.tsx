"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isPdf, parsePageRanges, toSplitArchiveName } from "@/utils/pdf-tools";
import { Scissors } from "lucide-react";
import { useId, useState } from "react";
import {
  SelectedSource,
  SourcePicker,
} from "../../conversion/_components/conversion-parts";
import type { ConversionSource } from "../../conversion/_components/request-conversion";
import { PdfJobStatus, usePdfJob } from "./pdf-job";

const MODES = {
  pages: "Every page",
  every: "Every few pages",
  ranges: "Page ranges",
} as const;

type Mode = keyof typeof MODES;

export default function SplitPdf() {
  const job = usePdfJob();
  const [source, setSource] = useState<ConversionSource | null>(null);
  const [mode, setMode] = useState<Mode>("pages");
  const [every, setEvery] = useState("2");
  const [ranges, setRanges] = useState("");
  const id = useId();

  const everyNumber = Number(every);
  const everyValid = Number.isInteger(everyNumber) && everyNumber >= 1;
  // the server knows the page count; this only checks the shape
  const parsedRanges = ranges.trim() ? parsePageRanges(ranges) : null;
  const rangesError = typeof parsedRanges === "string" ? parsedRanges : null;
  const ready =
    mode === "pages" ||
    (mode === "every" && everyValid) ||
    (mode === "ranges" && Array.isArray(parsedRanges));

  function split() {
    if (!source || !ready) return;
    job.start({
      url: "/api/pdf/split",
      sources: [source],
      options:
        mode === "ranges"
          ? { ranges }
          : { every: mode === "every" ? everyNumber : 1 },
      name: toSplitArchiveName(source.file.name),
      zip: true,
    });
  }

  return (
    <Card>
      <CardContent>
        <div className="sm:p-4">
          <SourcePicker
            icon={Scissors}
            title="Choose a PDF to split"
            hint="Each part comes back as its own PDF, together in a ZIP"
            accept="application/pdf,.pdf"
            filter={isPdf}
            disabled={job.busy}
            onChoose={(next) => {
              setSource(next);
              job.reset();
            }}
          />

          {source && (
            <div className="mt-3 rounded-xl border p-4">
              <SelectedSource
                source={source}
                icon={Scissors}
                removeLabel="Remove selected PDF"
                disabled={job.busy}
                onRemove={() => {
                  setSource(null);
                  job.reset();
                }}
                action={
                  job.busy ? (
                    <Button variant="outline" onClick={job.cancel}>
                      Cancel
                    </Button>
                  ) : (
                    <Button disabled={!ready} onClick={split}>
                      <Scissors />
                      Split PDF
                    </Button>
                  )
                }
              />

              <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`${id}-mode`}>Split into</Label>
                  <Select
                    value={mode}
                    onValueChange={(value) => {
                      setMode(value as Mode);
                      job.reset();
                    }}
                    disabled={job.busy}
                  >
                    <SelectTrigger id={`${id}-mode`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(MODES) as Mode[]).map((value) => (
                        <SelectItem key={value} value={value}>
                          {MODES[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {mode === "every" && (
                  <div className="space-y-2">
                    <Label htmlFor={`${id}-every`}>Pages in each part</Label>
                    <Input
                      id={`${id}-every`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={every}
                      disabled={job.busy}
                      aria-invalid={!everyValid}
                      onChange={(event) => {
                        setEvery(event.target.value);
                        job.reset();
                      }}
                    />
                  </div>
                )}

                {mode === "ranges" && (
                  <div className="space-y-2">
                    <Label htmlFor={`${id}-ranges`}>Ranges</Label>
                    <Input
                      id={`${id}-ranges`}
                      placeholder="1-3, 4-6, 7-"
                      value={ranges}
                      disabled={job.busy}
                      aria-invalid={Boolean(rangesError)}
                      aria-describedby={`${id}-ranges-hint`}
                      onChange={(event) => {
                        setRanges(event.target.value);
                        job.reset();
                      }}
                    />
                    <p
                      id={`${id}-ranges-hint`}
                      className={
                        rangesError
                          ? "text-destructive text-xs"
                          : "text-muted-foreground text-xs"
                      }
                    >
                      {rangesError ??
                        'Each range becomes one PDF. "7-" runs to the last page.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <PdfJobStatus status={job.status} workingLabel="Splitting PDF…" />
        </div>
      </CardContent>
    </Card>
  );
}
