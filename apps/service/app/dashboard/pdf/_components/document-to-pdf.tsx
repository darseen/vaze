"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DOCUMENT_ACCEPT,
  isConvertibleDocument,
  toPdfName,
} from "@/utils/pdf-tools";
import { FileType, Play } from "lucide-react";
import { useState } from "react";
import {
  SelectedSource,
  SourcePicker,
} from "../../conversion/_components/conversion-parts";
import type { ConversionSource } from "../../conversion/_components/request-conversion";
import { PdfJobStatus, usePdfJob } from "./pdf-job";

export default function DocumentToPdf() {
  const job = usePdfJob();
  const [source, setSource] = useState<ConversionSource | null>(null);

  return (
    <Card>
      <CardContent>
        <div className="sm:p-4">
          <SourcePicker
            icon={FileType}
            title="Choose a document to turn into a PDF"
            hint="Word, Excel and PowerPoint files, OpenDocument, RTF, CSV and plain text"
            accept={DOCUMENT_ACCEPT}
            filter={isConvertibleDocument}
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
                icon={FileType}
                removeLabel="Remove selected document"
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
                    <Button
                      onClick={() =>
                        job.start({
                          url: "/api/pdf/from-document",
                          sources: [source],
                          name: toPdfName(source.file.name),
                        })
                      }
                    >
                      <Play fill="currentColor" />
                      Convert to PDF
                    </Button>
                  )
                }
              />
            </div>
          )}

          <PdfJobStatus
            status={job.status}
            workingLabel="Converting document…"
          />
        </div>
      </CardContent>
    </Card>
  );
}
