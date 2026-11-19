"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_CONVERSION_ENV,
  isConvertibleDocument,
  LIBREOFFICE_ADDED_SIZE,
  toPdfName,
} from "@/utils/pdf-tools";
import { FileType, Info, Play } from "lucide-react";
import { useState } from "react";
import {
  SelectedSource,
  SourcePicker,
} from "../../conversion/_components/conversion-parts";
import type { ConversionSource } from "../../conversion/_components/request-conversion";
import { PdfJobStatus, usePdfJob } from "./pdf-job";

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
      {children}
    </code>
  );
}

/** Names the variable that turns document conversion on, and what it costs in space. */
function TurnedOffDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-start gap-2">
            <Info className="text-primary mt-0.5 size-5 shrink-0" />
            Document conversion is turned off
          </DialogTitle>
          <DialogDescription>
            Add the <Code>{`${DOCUMENT_CONVERSION_ENV}=true`}</Code> environment
            variable to turn it on. This adds about{" "}
            <strong>{LIBREOFFICE_ADDED_SIZE}</strong> to the container.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <DialogClose asChild>
            <Button>Got it</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DocumentToPdf({ enabled }: { enabled: boolean }) {
  const job = usePdfJob();
  const [source, setSource] = useState<ConversionSource | null>(null);
  const [isTurnedOffOpen, setIsTurnedOffOpen] = useState(false);

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
            onUnavailable={enabled ? undefined : () => setIsTurnedOffOpen(true)}
          />
          <TurnedOffDialog
            open={isTurnedOffOpen}
            onOpenChange={setIsTurnedOffOpen}
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
