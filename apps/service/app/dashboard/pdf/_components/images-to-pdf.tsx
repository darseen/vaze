"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isConvertibleImage } from "@/utils/conversion";
import {
  PAGE_SIZE_INFO,
  PAGE_SIZES,
  toPdfName,
  type PageSize,
} from "@/utils/pdf-tools";
import { FileImage, Images } from "lucide-react";
import { useId, useState } from "react";
import { SourcePicker } from "../../conversion/_components/conversion-parts";
import { PdfJobStatus, usePdfJob } from "./pdf-job";
import { SourceList, useSourceList } from "./source-list";

// in points, a quarter and a half of an inch
const MARGINS = {
  none: { label: "None", value: 0 },
  small: { label: "Small", value: 18 },
  large: { label: "Large", value: 36 },
} as const;

type Margin = keyof typeof MARGINS;

export default function ImagesToPdf() {
  const job = usePdfJob();
  const list = useSourceList(job.reset);
  const [pageSize, setPageSize] = useState<PageSize>("fit");
  const [margin, setMargin] = useState<Margin>("none");
  const id = useId();
  const count = list.items.length;

  function make() {
    job.start({
      url: "/api/pdf/from-images",
      sources: list.sources,
      options: { pageSize, margin: MARGINS[margin].value },
      name: toPdfName(list.sources[0].file.name),
    });
  }

  return (
    <Card>
      <CardContent>
        <div className="sm:p-4">
          <SourcePicker
            icon={Images}
            title={count ? "Add more images" : "Choose images to make a PDF"}
            hint="One image on each page, in the order listed. HEIC, JPG, PNG, WebP, AVIF, GIF, TIFF and SVG"
            accept="image/*,.heic,.heif"
            filter={isConvertibleImage}
            multiple
            disabled={job.busy}
            onChoose={list.add}
          />

          {count > 0 && (
            <div className="mt-3 rounded-xl border p-4">
              <SourceList
                items={list.items}
                icon={FileImage}
                disabled={job.busy}
                onMove={list.move}
                onRemove={list.remove}
              />

              <div className="mt-3 grid gap-4 border-t pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor={`${id}-size`}>Page size</Label>
                  <Select
                    value={pageSize}
                    onValueChange={(value) => {
                      setPageSize(value as PageSize);
                      job.reset();
                    }}
                    disabled={job.busy}
                  >
                    <SelectTrigger id={`${id}-size`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {PAGE_SIZE_INFO[value].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${id}-margin`}>Margin</Label>
                  <Select
                    value={margin}
                    onValueChange={(value) => {
                      setMargin(value as Margin);
                      job.reset();
                    }}
                    disabled={job.busy}
                  >
                    <SelectTrigger id={`${id}-margin`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(MARGINS) as Margin[]).map((value) => (
                        <SelectItem key={value} value={value}>
                          {MARGINS[value].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {job.busy ? (
                  <Button variant="outline" onClick={job.cancel}>
                    Cancel
                  </Button>
                ) : (
                  <Button onClick={make}>
                    <Images />
                    Make PDF
                  </Button>
                )}
              </div>
            </div>
          )}

          <PdfJobStatus status={job.status} workingLabel="Making your PDF…" />
        </div>
      </CardContent>
    </Card>
  );
}
