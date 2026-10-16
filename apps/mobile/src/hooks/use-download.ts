import { useToast } from "heroui-native";
import { useState } from "react";
import { useServer } from "@/components/server-context";
import { saveDownload, type DownloadRequest } from "@/lib/transfer";

/** Saves downloads to the device and toasts where they went; not for use under an open sheet. */
export function useDownload() {
  const { vaze } = useServer();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function download(request: DownloadRequest) {
    setBusy(true);
    try {
      const saved = await saveDownload(vaze, request);
      if (saved) {
        toast.show({
          variant: "success",
          label: "Saved to Downloads",
          description: saved,
        });
      }
    } catch (error) {
      toast.show({
        variant: "danger",
        label: "Couldn't download it",
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return { download, busy };
}
