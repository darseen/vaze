import auth from "@/utils/auth";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import Section from "../_components/section";
import Header from "./_components/header";
import VideoToAudio from "./_components/video-to-audio";

export const metadata: Metadata = {
  title: "Conversion",
  description: "Vaze | Convert from one format to another.",
};

export default async function Page() {
  await connection();

  const user = await auth();
  if (!user) redirect("/");

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
        </div>
      </div>
    </main>
  );
}
