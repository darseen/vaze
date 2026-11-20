import { Button } from "heroui-native";
import { Combine, FileText } from "lucide-react-native";
import { SourceChoices } from "@/components/conversion/conversion-parts";
import { useServer } from "@/components/server-context";
import { toMergedName } from "@/lib/pdf-tools";
import { PdfJobFooter, usePdfJob } from "./pdf-job";
import { SourceListRows, useSourceList, useSourcePicker } from "./sources";
import { ToolScroll } from "@/components/tool-parts";

export function MergePdfs() {
  const { server } = useServer();
  const job = usePdfJob();
  const list = useSourceList(job.reset);
  const picker = useSourcePicker("pdf", { multiple: true, onPicked: list.add });
  const count = list.items.length;
  const settled = job.busy || job.status.phase === "done";

  return (
    <ToolScroll description="Join several PDFs into one, in the order listed. The result isn't kept on the server, so save or share it.">
      {count > 0 ? (
        <SourceListRows list={list} icon={FileText} busy={settled} />
      ) : null}

      {settled ? null : (
        <SourceChoices
          icon={Combine}
          title={count ? "Add more PDFs" : "Choose PDFs to merge"}
          hint={count < 2 ? "Add at least two." : `${count} PDFs so far.`}
          origins={["files", "vaze"]}
          descriptions={{
            files: "PDFs saved on this phone",
            vaze: `A PDF on ${server.name}`,
          }}
          onPick={picker.pick}
        />
      )}

      <PdfJobFooter
        job={job}
        workingLabel="Merging PDFs…"
        againLabel="Merge other PDFs"
        onAgain={() => {
          job.reset();
          list.clear();
        }}
        action={
          count > 0 ? (
            <Button
              isDisabled={count < 2}
              onPress={() =>
                job.start({
                  tool: "merge",
                  sources: list.sources,
                  name: toMergedName(list.sources[0].file.name),
                })
              }
            >
              {job.status.phase === "error"
                ? "Try again"
                : count < 2
                  ? "Merge PDFs"
                  : `Merge ${count} PDFs`}
            </Button>
          ) : null
        }
      />
      {picker.sheet}
    </ToolScroll>
  );
}
