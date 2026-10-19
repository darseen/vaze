import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { highlight } from "fumadocs-core/highlight";
import {
  BellRing,
  ChartLine,
  Download,
  FolderUp,
  Gauge,
  History,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Lock,
  ScanEye,
  Search,
  Server,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { CopyCommand } from "@/components/landing/copy-command";
import {
  BrowserFrame,
  PhoneFrame,
  Screenshot,
} from "@/components/landing/screenshots";
import {
  absoluteUrl,
  appName,
  docsRoute,
  installCommand,
  npmUrl,
  privacyRoute,
  repoUrl,
  siteDescription,
} from "@/lib/shared";
import logo from "@/public/vaze.png";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

// lets search engines show the site name and read Vaze as free software
const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: appName,
    url: absoluteUrl("/"),
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: appName,
    description: siteDescription,
    url: absoluteUrl("/"),
    image: absoluteUrl("/opengraph-image"),
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Docker, Android",
    license: "https://opensource.org/licenses/MIT",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    sameAs: [repoUrl, npmUrl],
  },
];

// the address the screenshots were taken on, a server on a home network
const serverAddress = "192.168.1.104:3000";

const sdkExample = `import { readFile } from "node:fs/promises";
import Vaze from "@darseen/vaze";

// reads VAZE_URL and VAZE_API_KEY from the environment
const vaze = new Vaze();

const hero = new File([await readFile("hero.png")], "hero.png", {
  type: "image/png",
});
const { data } = await vaze.files.upload({
  files: [hero],
  folder: "website",
});

console.log(data?.files[0].url);
// https://files.example.com/api/hosting/website/hero.png`;

type Feature = { icon: LucideIcon; title: string; text: ReactNode };

const fileFeatures: Feature[] = [
  {
    icon: FolderUp,
    title: "Folder uploads",
    text: "Drop in a whole folder and Vaze recreates it on the server, with progress, speed and cancel for every file.",
  },
  {
    icon: ScanEye,
    title: "Previews for everyday formats",
    text: "Images, video, audio, PDFs and text open in a full-screen viewer, so you rarely need to download first.",
  },
  {
    icon: Search,
    title: "Search and filter",
    text: "Find files and folders by name, and narrow a folder down to images, videos or documents.",
  },
  {
    icon: ListChecks,
    title: "Work on many at once",
    text: "Select files to move or delete together, or download a folder or a selection as one zip.",
  },
];

const hostingFeatures: Feature[] = [
  {
    icon: Lock,
    title: "Public or private",
    text: "Make a file or a whole folder private, then share it with a signed link that expires when you say.",
  },
  {
    icon: Gauge,
    title: "Made for embedding",
    text: "Range requests let video and audio seek, and ETag revalidation turns repeat loads into an empty 304.",
  },
  {
    icon: ChartLine,
    title: "Traffic you can see",
    text: "The dashboard counts requests and bytes served, ranks your most requested files and flags links that found nothing.",
  },
];

const accessFeatures: Feature[] = [
  {
    icon: Users,
    title: "Roles and scopes",
    text: "Make someone an Admin, Editor or Viewer, or pick their scopes one by one. Disable or remove them at any time.",
  },
  {
    icon: KeyRound,
    title: "Scoped API keys",
    text: "Keys for your apps can read, write or delete and nothing more, and can expire on a date you set.",
  },
  {
    icon: BellRing,
    title: "Alerts worth reading",
    text: "The dashboard warns about low disk space, failed uploads, and keys that are about to expire or sit unused.",
  },
  {
    icon: History,
    title: "Activity history",
    text: "Uploads, deletions and account changes are logged, and old entries are pruned for you.",
  },
];

const mobileFeatures: Feature[] = [
  {
    icon: Server,
    title: "All your servers",
    text: "Add a home server and a VPS side by side. A LAN address like 192.168.1.20:3000 works too.",
  },
  {
    icon: Upload,
    title: "Upload from your phone",
    text: "Send photos, videos and documents with live progress, and cancel any of them.",
  },
  {
    icon: Download,
    title: "Save and share",
    text: "Save files to your Downloads folder, or hand them to another app with the share sheet.",
  },
  {
    icon: LayoutDashboard,
    title: "The same dashboard",
    text: "Alerts, storage, traffic and recent files, laid out for a small screen.",
  },
];

function FeatureList({ features }: { features: Feature[] }) {
  return (
    <ul
      className={`mt-14 grid gap-x-10 gap-y-8 sm:grid-cols-2 ${features.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}
    >
      {features.map(({ icon: Icon, title, text }) => (
        <li key={title} className="flex gap-3.5">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-gold-soft text-gold">
            <Icon className="size-4" aria-hidden />
          </span>
          <div>
            <h3 className="font-medium">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-fd-muted-foreground">
              {text}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function SectionHeading({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h2 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-fd-muted-foreground">
        {children}
      </p>
    </div>
  );
}

function InstallStep({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="min-w-0">
      <span className="font-display text-sm font-semibold text-gold">
        Step {number}
      </span>
      <h3 className="mt-1 font-medium">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-fd-muted-foreground">
        {children}
      </p>
    </li>
  );
}

const linkButton =
  "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

export default async function HomePage() {
  const sdkCode = await highlight(sdkExample, {
    lang: "ts",
    components: {
      pre: (props) => (
        <CodeBlock title="upload.ts" className="my-0">
          <Pre {...props} />
        </CodeBlock>
      ),
    },
  });

  return (
    <main className="flex flex-1 flex-col overflow-x-clip">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <section className="mx-auto grid w-full max-w-6xl items-center gap-14 px-4 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-2 lg:gap-12 lg:pt-20">
        <div className="min-w-0">
          <h1 className="font-display text-[2.6rem] leading-[1.05] font-bold tracking-[-0.035em] text-balance sm:text-6xl lg:text-5xl xl:text-[3.5rem]">
            Store and host your files on a server you own
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-fd-muted-foreground sm:text-xl lg:text-lg">
            {appName} is a file server that runs in one Docker container.
            Organize files from the web dashboard or the Android app, share
            them with public or signed links, and use it as the storage
            behind your own projects.
          </p>

          <div className="mt-8">
            <CopyCommand command={installCommand} />
          </div>
          <p className="mt-3 text-sm text-fd-muted-foreground">
            Needs Docker with the Compose plugin.{" "}
            <Link
              href={`${docsRoute}/getting-started/installation`}
              className="font-medium text-fd-foreground underline decoration-gold decoration-2 underline-offset-4"
            >
              Other ways to install
            </Link>
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={docsRoute}
              className={`${linkButton} bg-fd-primary text-fd-primary-foreground hover:bg-fd-primary/85`}
            >
              Read the docs
            </Link>
            <a
              href={repoUrl}
              className={`${linkButton} border border-fd-border hover:bg-fd-accent`}
            >
              View the source on GitHub
            </a>
          </div>
        </div>

        {/* first on small screens, beside the text on wide ones */}
        <div className="relative order-first pb-[14%] sm:pb-[9%] lg:order-none lg:pb-[12%]">
          <div className="w-[92%] sm:w-[86%]">
            <BrowserFrame address={`${serverAddress}/dashboard`}>
              <Screenshot
                kind="web"
                name="dashboard"
                alt="The Vaze web dashboard with storage, hosting traffic and files added over the last 30 days"
                sizes="(min-width: 1024px) 480px, 90vw"
                eager
              />
            </BrowserFrame>
          </div>
          <div className="absolute right-0 bottom-0 w-[28%] sm:w-[21%] lg:w-[26%]">
            <PhoneFrame>
              <Screenshot
                kind="mobile"
                name="home"
                alt="The same dashboard in the Vaze Android app"
                sizes="(min-width: 1024px) 150px, 28vw"
                eager
              />
            </PhoneFrame>
          </div>
        </div>
      </section>

      <div className="mx-auto mt-24 flex w-full max-w-6xl flex-col gap-28 px-4 sm:mt-32 sm:gap-36 sm:px-6">
        <section>
          <div className="grid items-center gap-12 lg:grid-cols-[5fr_7fr]">
            <SectionHeading title="Browse and preview everything">
              A dashboard built around the files themselves, with
              thumbnails, a viewer and the folders you uploaded.
            </SectionHeading>
            <BrowserFrame address={`${serverAddress}/dashboard/files/photos`}>
              <Screenshot
                kind="web"
                name="files"
                alt="A folder of travel photos shown as a thumbnail grid"
                sizes="(min-width: 1024px) 660px, 92vw"
              />
            </BrowserFrame>
          </div>
          <FeatureList features={fileFeatures} />
        </section>

        <section>
          <div className="grid items-center gap-12 lg:grid-cols-[7fr_5fr]">
            <div className="lg:order-2">
              <SectionHeading title="Host files at URLs you choose">
                Files keep the names you upload them with, so a link like{" "}
                <code className="text-base text-fd-foreground">
                  /api/hosting/website/hero.jpg
                </code>{" "}
                stays the same until you change it.
              </SectionHeading>
            </div>
            <div className="lg:order-1">
              <BrowserFrame address={`${serverAddress}/dashboard`}>
                <Screenshot
                  kind="web"
                  name="traffic"
                  alt="Recent files, the most requested hosted files and API requests per day"
                  sizes="(min-width: 1024px) 660px, 92vw"
                />
              </BrowserFrame>
            </div>
          </div>
          <FeatureList features={hostingFeatures} />
        </section>

        <section>
          <div className="grid items-center gap-12 lg:grid-cols-[5fr_7fr]">
            <SectionHeading title="Decide who gets in">
              {appName} starts with one admin account. Add people when you
              need to, and give each of them only the access they need.
            </SectionHeading>
            <BrowserFrame address={`${serverAddress}/dashboard/users`}>
              <Screenshot
                kind="web"
                name="users"
                alt="The users page with an admin, editors, a custom role and a disabled account"
                sizes="(min-width: 1024px) 660px, 92vw"
              />
            </BrowserFrame>
          </div>
          <FeatureList features={accessFeatures} />
        </section>

        <section>
          <div className="grid items-center gap-12 lg:grid-cols-[5fr_7fr]">
            <SectionHeading title="Your server in your pocket">
              The {appName} app for Android connects to the same server and
              keeps up with everything the web dashboard does.
            </SectionHeading>
            <div className="mx-auto grid w-full max-w-2xl grid-cols-3 items-start gap-3 sm:gap-6">
              <PhoneFrame>
                <Screenshot
                  kind="mobile"
                  name="files"
                  alt="A photo folder in the app"
                  sizes="(min-width: 1024px) 200px, 30vw"
                />
              </PhoneFrame>
              <div className="mt-[18%]">
                <PhoneFrame>
                  <Screenshot
                    kind="mobile"
                    name="viewer"
                    alt="A photo open in the app's viewer"
                    sizes="(min-width: 1024px) 200px, 30vw"
                  />
                </PhoneFrame>
              </div>
              <PhoneFrame>
                <Screenshot
                  kind="mobile"
                  name="traffic"
                  alt="Hosting traffic and the most requested files in the app"
                  sizes="(min-width: 1024px) 200px, 30vw"
                />
              </PhoneFrame>
            </div>
          </div>
          <FeatureList features={mobileFeatures} />
        </section>

        <section className="grid items-center gap-12 lg:grid-cols-[2fr_3fr]">
          <div>
            <SectionHeading title="Use it as your app's file storage">
              Upload, list, sign and delete files over a JSON API, or let
              the TypeScript SDK do it for you.
            </SectionHeading>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`${docsRoute}/sdk`}
                className={`${linkButton} bg-fd-primary text-fd-primary-foreground hover:bg-fd-primary/85`}
              >
                Get started with the SDK
              </Link>
              <Link
                href={`${docsRoute}/api-reference`}
                className={`${linkButton} border border-fd-border hover:bg-fd-accent`}
              >
                API reference
              </Link>
            </div>
          </div>
          <div className="min-w-0">{sdkCode}</div>
        </section>

        <section className="rounded-2xl bg-fd-card px-6 py-12 ring-1 ring-fd-border sm:px-12 sm:py-16">
          <SectionHeading title="Up and running in a few minutes">
            The installer checks Docker, writes your config with a fresh
            secret and starts {appName}. Run it again later to upgrade.
          </SectionHeading>
          <div className="mt-8 max-w-4xl">
            <CopyCommand command={installCommand} />
          </div>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            <InstallStep number={1} title="Run the installer">
              Run the command above on the machine that will host {appName}.
              It asks where to install and which address you&apos;ll open it
              on.
            </InstallStep>
            <InstallStep number={2} title="Open your server">
              Visit that address in your browser. By default it is the
              machine&apos;s address on your network, on port 3000.
            </InstallStep>
            <InstallStep number={3} title="Create the admin account">
              The first account to register becomes the admin. Then add
              people, keys and files.
            </InstallStep>
          </ol>
        </section>
      </div>

      <footer className="mt-28 border-t border-fd-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-fd-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2.5">
            <Image src={logo} alt="" className="h-6 w-auto" />
            <span>
              {appName} is open source under the{" "}
              <a
                href={`${repoUrl}/blob/main/LICENSE`}
                className="underline underline-offset-4 hover:text-fd-foreground"
              >
                MIT license
              </a>
              .
            </span>
          </div>
          <nav className="flex gap-6" aria-label="Footer">
            <Link href={docsRoute} className="hover:text-fd-foreground">
              Docs
            </Link>
            <Link href={privacyRoute} className="hover:text-fd-foreground">
              Privacy
            </Link>
            <a href={repoUrl} className="hover:text-fd-foreground">
              GitHub
            </a>
            <a href={npmUrl} className="hover:text-fd-foreground">
              npm
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
