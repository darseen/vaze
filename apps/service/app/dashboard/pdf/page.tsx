import { isDocumentConversionEnabled } from "@/lib/document-conversion";
import { authorize } from "@/utils/auth";
import { FileStack } from "lucide-react";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import Section from "../_components/section";
import DocumentToPdf from "./_components/document-to-pdf";
import EditPdf from "./_components/edit-pdf";
import ImagesToPdf from "./_components/images-to-pdf";
import MergePdfs from "./_components/merge-pdfs";
import SplitPdf from "./_components/split-pdf";

export const metadata: Metadata = {
  title: "PDF Tools",
  description:
    "Vaze | Merge, split and edit PDFs, and make them from other files.",
};

export default async function Page() {
  await connection();

  const { error } = await authorize("files:read");
  if (error) redirect("/dashboard");

  return (
    <main className="mx-auto w-full max-w-4xl">
      <div className="mb-8">
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <FileStack className="text-primary h-8 w-8" />
            <h1 className="text-foreground text-3xl font-bold">PDF Tools</h1>
          </div>
          <p className="text-muted-foreground text-balance">
            Merge, split and edit PDFs, and make PDFs from images and documents.
          </p>
        </div>

        <div className="space-y-10">
          <Section
            title="Merge PDFs"
            description="Join several PDFs into one, in the order you choose."
          >
            <MergePdfs />
          </Section>

          <Section
            title="Split PDF"
            description="Cut a PDF into parts, by page or by ranges."
          >
            <SplitPdf />
          </Section>

          <Section
            title="Edit Pages"
            description="Move, turn and remove a PDF's pages, number them, and give it a title."
          >
            <EditPdf />
          </Section>

          <Section
            title="Images to PDF"
            description="Put images on pages of their own size, or on A4 or Letter."
          >
            <ImagesToPdf />
          </Section>

          <Section
            title="Document to PDF"
            description="Turn Word, Excel, PowerPoint and OpenDocument files into PDFs."
          >
            <DocumentToPdf enabled={isDocumentConversionEnabled()} />
          </Section>
        </div>
      </div>
    </main>
  );
}
