import { Button, Tabs } from "heroui-native";
import { FileImage, Images } from "lucide-react-native";
import { useState } from "react";
import { SourceChoices } from "@/components/conversion/conversion-parts";
import { useServer } from "@/components/server-context";
import { toPdfName } from "@/lib/pdf-tools";
import { PdfJobFooter, usePdfJob } from "./pdf-job";
import { SourceListRows, useSourceList, useSourcePicker } from "./sources";
import { Option, ToolScroll } from "@/components/tool-parts";

const PAGE_SIZES = [
  { value: "fit", label: "Image size" },
  { value: "a4", label: "A4" },
  { value: "letter", label: "Letter" },
] as const;

// in points, a quarter and a half of an inch
const MARGINS = [
  { value: "0", label: "None" },
  { value: "18", label: "Small" },
  { value: "36", label: "Large" },
] as const;

type PageSize = (typeof PAGE_SIZES)[number]["value"];
type Margin = (typeof MARGINS)[number]["value"];

export function ImagesToPdf() {
  const { server } = useServer();
  const job = usePdfJob();
  const list = useSourceList(job.reset);
  const picker = useSourcePicker("image", {
    multiple: true,
    onPicked: list.add,
  });
  const [pageSize, setPageSize] = useState<PageSize>("fit");
  const [margin, setMargin] = useState<Margin>("0");
  const count = list.items.length;
  const settled = job.busy || job.status.phase === "done";

  return (
    <ToolScroll description="Put each image on a page of its own, in the order listed. HEIC, JPG, PNG, WebP, AVIF, GIF, TIFF and SVG.">
      {count > 0 ? (
        <SourceListRows
          list={list}
          icon={FileImage}
          showDeviceImage
          busy={settled}
        />
      ) : null}

      {settled ? null : (
        <SourceChoices
          icon={Images}
          title={count ? "Add more images" : "Choose images to make a PDF"}
          hint="One image on each page."
          descriptions={{
            media: "Photos in your gallery",
            files: "Images saved on this phone",
            vaze: `An image on ${server.name}`,
          }}
          onPick={picker.pick}
        />
      )}

      {count > 0 && !settled ? (
        <>
          <Option label="Page size">
            <Tabs
              value={pageSize}
              onValueChange={(value) => {
                // the triggers offered are the only values the tabs can report
                setPageSize(value as PageSize);
                job.reset();
              }}
            >
              <Tabs.List className="w-full">
                <Tabs.Indicator />
                {PAGE_SIZES.map(({ value, label }) => (
                  <Tabs.Trigger key={value} value={value} className="flex-1">
                    <Tabs.Label>{label}</Tabs.Label>
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </Tabs>
          </Option>
          <Option label="Margin">
            <Tabs
              value={margin}
              onValueChange={(value) => {
                setMargin(value as Margin);
                job.reset();
              }}
            >
              <Tabs.List className="w-full">
                <Tabs.Indicator />
                {MARGINS.map(({ value, label }) => (
                  <Tabs.Trigger key={value} value={value} className="flex-1">
                    <Tabs.Label>{label}</Tabs.Label>
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </Tabs>
          </Option>
        </>
      ) : null}

      <PdfJobFooter
        job={job}
        workingLabel="Making your PDF…"
        againLabel="Use other images"
        onAgain={() => {
          job.reset();
          list.clear();
        }}
        action={
          count > 0 ? (
            <Button
              onPress={() =>
                job.start({
                  tool: "from-images",
                  sources: list.sources,
                  options: { pageSize, margin: Number(margin) },
                  name: toPdfName(list.sources[0].file.name),
                })
              }
            >
              {job.status.phase === "error" ? "Try again" : "Make PDF"}
            </Button>
          ) : null
        }
      />
      {picker.sheet}
    </ToolScroll>
  );
}
