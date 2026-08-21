import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { RootProvider } from "fumadocs-ui/provider/next";
import { appName, siteUrl } from "@/lib/shared";
import "./global.css";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: `%s | ${appName}`,
    default: `${appName} Documentation`,
  },
  description:
    "Documentation for Vaze, a self-hosted local file storage and hosting service.",
  applicationName: appName,
  // og/twitter titles and descriptions are inherited from the fields above.
  openGraph: {
    type: "website",
    siteName: appName,
    locale: "en_US",
    url: siteUrl,
  },
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
