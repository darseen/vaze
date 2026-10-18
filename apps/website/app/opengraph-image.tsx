import { homeCard, ogSize } from "@/components/og-card";

export const alt =
  "Vaze: store and host your files on a server you own, shown on the web dashboard and the Android app";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return homeCard();
}
