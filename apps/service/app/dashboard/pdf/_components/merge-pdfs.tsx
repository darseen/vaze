"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isPdf, toMergedName } from "@/utils/pdf-tools";
import { Combine, FileText } from "lucide-react";
import { SourcePicker } from "../../conversion/_components/conversion-parts";
import { PdfJobStatus, usePdfJob } from "./pdf-job";
import { SourceList, useSourceList } from "./source-list";

export default function MergePdfs() {
  const job = usePdfJob();
  const list = useSourceList(job.reset);
  const count = list.items.length;

  function merge() {
    job.start({
      url: "/api/pdf/merge",
      sources: list.sources,
      name: toMergedName(list.sources[0].file.name),
    });
  }

  return (
    <Card>
      <CardContent>
        <div className="sm:p-4">
          <SourcePicker
            icon={Combine}
            title={count ? "Add more PDFs" : "Choose PDFs to merge"}
            hint="They are joined in the order listed, which you can change"
            accept="application/pdf,.pdf"
            filter={isPdf}
            multiple
            disabled={job.busy}
            onChoose={list.add}
          />

          {count > 0 && (
            <div className="mt-3 rounded-xl border p-4">
              <SourceList
                items={list.items}
                icon={FileText}
                disabled={job.busy}
                onMove={list.move}
                onRemove={list.remove}
              />
              <div className="mt-3 flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-muted-foreground text-sm">
                  {count < 2 ? "Add at least one more PDF" : `${count} PDFs`}
                </p>
                {job.busy ? (
                  <Button variant="outline" onClick={job.cancel}>
                    Cancel
                  </Button>
                ) : (
                  <Button disabled={count < 2} onClick={merge}>
                    <Combine />
                    Merge PDFs
                  </Button>
                )}
              </div>
            </div>
          )}

          <PdfJobStatus status={job.status} workingLabel="Merging PDFs…" />
        </div>
      </CardContent>
    </Card>
  );
}
