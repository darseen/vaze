import { authorize } from "@/utils/auth";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import Section from "../_components/section";
import Header from "./_components/header";
import ImageConverter from "./_components/image-converter";
import VideoToAudio from "./_components/video-to-audio";

export const metadata: Metadata = {
  title: "Conversion",
  description: "Vaze | Convert from one format to another.",
};

export default async function Page() {
  await connection();

  const { error } = await authorize("files:read");
  if (error) redirect("/dashboard");

  return (
    <main className="mx-auto w-full max-w-4xl">
      <div className="mb-8">
        <Header />

        <div className="space-y-10">
          <Section
            title="Video to Audio"
            description="Convert video files to audio, and download them."
          >
            <VideoToAudio />
          </Section>

          <Section
            title="Image Converter"
            description="Convert images to WebP, JPG, PNG or AVIF, resize them, and download them."
          >
            <ImageConverter />
          </Section>
        </div>
      </div>
    </main>
  );
}
