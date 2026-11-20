import { Button } from "heroui-native";
import { FileType } from "lucide-react-native";
import {
  SourceChoices,
  SourceRow,
} from "@/components/conversion/conversion-parts";
import { useServer } from "@/components/server-context";
import { toPdfName } from "@/lib/pdf-tools";
import { PdfJobFooter, usePdfJob } from "./pdf-job";
import { useSource, useSourcePicker } from "./sources";
import { ToolScroll } from "@/components/tool-parts";

export function DocumentToPdf() {
  const { server } = useServer();
  const job = usePdfJob();
  const { source, choose } = useSource(job.reset);
  const picker = useSourcePicker("document", {
    multiple: false,
    onPicked: choose,
  });

  return (
    <ToolScroll description="Turn Word, Excel and PowerPoint files, OpenDocument, RTF, CSV and plain text into a PDF.">
      {source ? (
        <SourceRow
          source={source}
          icon={FileType}
          removeLabel="Remove the document"
          onRemove={job.busy ? undefined : () => choose(null)}
        />
      ) : (
        <SourceChoices
          icon={FileType}
          title="Choose a document"
          hint="It comes back as a PDF."
          origins={["files", "vaze"]}
          descriptions={{
            files: "A document saved on this phone",
            vaze: `A document on ${server.name}`,
          }}
          onPick={picker.pick}
        />
      )}

      <PdfJobFooter
        job={job}
        workingLabel="Converting document…"
        againLabel="Convert another document"
        onAgain={() => {
          job.reset();
          choose(null);
        }}
        action={
          source ? (
            <Button
              onPress={() =>
                job.start({
                  tool: "from-document",
                  sources: [source],
                  name: toPdfName(source.file.name),
                })
              }
            >
              {job.status.phase === "error" ? "Try again" : "Convert to PDF"}
            </Button>
          ) : null
        }
      />
      {picker.sheet}
    </ToolScroll>
  );
}
