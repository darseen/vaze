import { Stack, useLocalSearchParams } from "expo-router";
import { FileQuestion } from "lucide-react-native";
import { useEffect } from "react";
import { View } from "react-native";
import { EmptyState } from "@/components/empty-state";
import { DocumentToPdf } from "@/components/pdf/document-to-pdf";
import { EditPdf } from "@/components/pdf/edit-pdf";
import { ImagesToPdf } from "@/components/pdf/images-to-pdf";
import { MergePdfs } from "@/components/pdf/merge-pdfs";
import { SplitPdf } from "@/components/pdf/split-pdf";
import { clearConversions } from "@/lib/conversion";
import { findTool } from "@/lib/tools";

const SCREENS: Record<string, () => React.JSX.Element> = {
  merge: MergePdfs,
  split: SplitPdf,
  edit: EditPdf,
  "from-images": ImagesToPdf,
  "from-document": DocumentToPdf,
};

export default function PdfToolScreen() {
  const { tool: slug } = useLocalSearchParams<{ tool: string }>();
  const tool = findTool("pdf", slug);

  // earlier results stay until now in case a share is still reading one
  useEffect(() => {
    clearConversions();
  }, []);

  const Screen = tool ? SCREENS[tool.slug] : undefined;
  if (!tool || !Screen) {
    return (
      <View className="px-5 pt-6">
        <Stack.Screen options={{ title: "PDF tools" }} />
        <EmptyState
          icon={FileQuestion}
          title="No such tool"
          message="This link points at a PDF tool the app doesn't have."
        />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: tool.title }} />
      <Screen />
    </>
  );
}
