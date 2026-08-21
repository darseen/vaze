import { generate as DefaultImage } from "fumadocs-ui/og";
import { ImageResponse } from "next/og";
import { appName } from "@/lib/shared";

export const alt = "Vaze, self-hosted local file storage and hosting";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <DefaultImage
      title="File storage you host yourself"
      description="Vaze is a self-hosted, local-first file storage and hosting service with a web interface and an SDK."
      site={appName}
    />,
    size,
  );
}
