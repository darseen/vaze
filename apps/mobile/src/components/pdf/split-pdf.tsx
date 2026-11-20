import { Button, Description, Input, Tabs } from "heroui-native";
import { Scissors } from "lucide-react-native";
import { useState } from "react";
import { Text } from "react-native";
import {
  SourceChoices,
  SourceRow,
} from "@/components/conversion/conversion-parts";
import { useServer } from "@/components/server-context";
import { parsePageRanges, toSplitName } from "@/lib/pdf-tools";
import { PdfJobFooter, usePdfJob } from "./pdf-job";
import { useSource, useSourcePicker } from "./sources";
import { Option, ToolScroll } from "@/components/tool-parts";

const MODES = [
  { value: "pages", label: "Every page" },
  { value: "every", label: "Every few" },
  { value: "ranges", label: "Ranges" },
] as const;

type Mode = (typeof MODES)[number]["value"];

export function SplitPdf() {
  const { server } = useServer();
  const job = usePdfJob();
  const { source, choose } = useSource(job.reset);
  const picker = useSourcePicker("pdf", { multiple: false, onPicked: choose });
  const [mode, setMode] = useState<Mode>("pages");
  const [every, setEvery] = useState("2");
  const [ranges, setRanges] = useState("");
  const settled = job.busy || job.status.phase === "done";

  const everyNumber = Number(every);
  const everyValid = Number.isInteger(everyNumber) && everyNumber >= 1;
  // the server knows the page count; this only checks the shape
  const parsed = ranges.trim() ? parsePageRanges(ranges) : null;
  const rangesError = typeof parsed === "string" ? parsed : null;
  const ready =
    mode === "pages" ||
    (mode === "every" && everyValid) ||
    (mode === "ranges" && Array.isArray(parsed));

  return (
    <ToolScroll description="Cut a PDF into parts, each its own PDF, together in a ZIP.">
      {source ? (
        <SourceRow
          source={source}
          icon={Scissors}
          removeLabel="Remove the PDF"
          onRemove={job.busy ? undefined : () => choose(null)}
        />
      ) : (
        <SourceChoices
          icon={Scissors}
          title="Choose a PDF to split"
          hint="Its parts come back in a ZIP."
          origins={["files", "vaze"]}
          descriptions={{
            files: "A PDF saved on this phone",
            vaze: `A PDF on ${server.name}`,
          }}
          onPick={picker.pick}
        />
      )}

      {source && !settled ? (
        <Option label="Split into">
          <Tabs
            value={mode}
            onValueChange={(value) => {
              // the triggers offered are the only values the tabs can report
              setMode(value as Mode);
              job.reset();
            }}
          >
            <Tabs.List className="w-full">
              <Tabs.Indicator />
              {MODES.map(({ value, label }) => (
                <Tabs.Trigger key={value} value={value} className="flex-1 px-1">
                  <Tabs.Label>{label}</Tabs.Label>
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs>

          {mode === "every" ? (
            <>
              <Input
                value={every}
                onChangeText={(value) => {
                  setEvery(value);
                  job.reset();
                }}
                keyboardType="number-pad"
                accessibilityLabel="Pages in each part"
              />
              <Description>Pages in each part.</Description>
            </>
          ) : null}

          {mode === "ranges" ? (
            <>
              <Input
                value={ranges}
                onChangeText={(value) => {
                  setRanges(value);
                  job.reset();
                }}
                placeholder="1-3, 4-6, 7-"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Page ranges"
              />
              {rangesError ? (
                <Text className="font-normal text-sm text-danger">
                  {rangesError}
                </Text>
              ) : (
                <Description>
                  Each range becomes one PDF. &quot;7-&quot; runs to the last
                  page.
                </Description>
              )}
            </>
          ) : null}
        </Option>
      ) : null}

      <PdfJobFooter
        job={job}
        workingLabel="Splitting PDF…"
        againLabel="Split another PDF"
        onAgain={() => {
          job.reset();
          choose(null);
        }}
        action={
          source ? (
            <Button
              isDisabled={!ready}
              onPress={() =>
                job.start(
                  {
                    tool: "split",
                    sources: [source],
                    options:
                      mode === "ranges"
                        ? { ranges }
                        : { every: mode === "every" ? everyNumber : 1 },
                    name: toSplitName(source.file.name),
                  },
                  { zip: true },
                )
              }
            >
              {job.status.phase === "error" ? "Try again" : "Split PDF"}
            </Button>
          ) : null
        }
      />
      {picker.sheet}
    </ToolScroll>
  );
}
