import type { Metadata } from "next";
import { Inter, Schibsted_Grotesk } from "next/font/google";
import { RootProvider } from "fumadocs-ui/provider/next";
import { appName, siteDescription, siteUrl } from "@/lib/shared";
import "./global.css";

const inter = Inter({
  subsets: ["latin"],
});

// headlines on the landing and privacy pages
const display = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-display-face",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: `%s | ${appName}`,
    default: `${appName}, self-hosted file storage and hosting`,
  },
  description: siteDescription,
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
    <html
      lang="en"
      className={`${inter.className} ${display.variable}`}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
