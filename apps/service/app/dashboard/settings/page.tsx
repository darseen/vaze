import { getDefaultVisibility } from "@/lib/settings";
import { Settings } from "lucide-react";
import { Metadata } from "next";
import { connection } from "next/server";
import DefaultVisibility from "./_components/default-visibility";

export const metadata: Metadata = {
  title: "Settings",
  description: "Vaze | Configure how your instance handles new files.",
};

export default async function Page() {
  await connection();
  // everything below will be excluded from prerendering

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <Settings className="text-primary h-8 w-8" />
          <h1 className="text-foreground text-3xl font-bold">Settings</h1>
        </div>
        <p className="text-muted-foreground text-balance">
          Configure how your Vaze instance handles new files and folders.
        </p>
      </div>

      <DefaultVisibility visibility={getDefaultVisibility()} />
    </div>
  );
}
