import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import logo from "@/public/vaze.png";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <Image src={logo} alt="Vaze logo" priority className="w-32 h-auto" />
      <h1 className="text-4xl font-bold tracking-tight">
        Vaze Documentation
      </h1>
      <p className="text-fd-muted-foreground max-w-xl text-lg">
        Vaze is a self-hosted, local-first file storage and hosting service.
        Manage your files from a clean web interface, or use it as a file
        hosting backend for your own applications.
      </p>
      <div className="flex gap-3">
        <Link
          href="/docs"
          className="bg-fd-primary text-fd-primary-foreground rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
        >
          Get Started
        </Link>
        <Link
          href="https://github.com/darseen/vaze"
          className="border-fd-border rounded-full border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent"
        >
          GitHub
        </Link>
      </div>
    </main>
  );
}
