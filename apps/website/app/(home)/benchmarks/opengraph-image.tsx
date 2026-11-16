import { docsCard, ogSize } from "@/components/og-card";
import { benchmarksRoute } from "@/lib/shared";

export const alt =
  "Vaze benchmarks: Vaze and Seafile measured across sixteen everyday file operations";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return docsCard({
    section: "Benchmarks",
    title: "Vaze and Seafile, side by side",
    description: "Sixteen everyday file operations, measured on one machine.",
    path: benchmarksRoute,
  });
}
