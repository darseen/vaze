import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { highlight } from "fumadocs-core/highlight";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { directionOf, formatValue } from "@/components/benchmarks/charts";
import { CopyCommand } from "@/components/landing/copy-command";
import {
  BrowserFrame,
  PhoneFrame,
  Screenshot,
} from "@/components/landing/screenshots";
import {
  allScenarios,
  benchmarkRun,
  memoryMB,
  scenario,
  speedup,
} from "@/lib/benchmarks";
import {
  absoluteUrl,
  appName,
  benchmarksRoute,
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

type Note = { term: string; detail: ReactNode };

const fileNotes: Note[] = [
  {
    term: "Previews",
    detail:
      "Images, video, audio, PDFs and text open in a full-screen viewer, so you rarely need to download first.",
  },
  {
    term: "Search and filter",
    detail:
      "Find files and folders by name, or narrow a folder down to images, videos or documents.",
  },
  {
    term: "Selections",
    detail:
      "Move, delete or zip many files at once, and restore deleted ones from Recently deleted.",
  },
];

// a hosting link split into the parts a reader should notice
const linkParts: { text: string; note?: string; highlight?: boolean }[] = [
  { text: "https://files.example.com", note: "Your server" },
  { text: "/api/hosting/" },
  {
    text: "website/hero.jpg",
    note: "The folder and name you uploaded",
    highlight: true,
  },
  {
    text: "?w=800&format=webp",
    note: "Optional: an 800 px WebP copy, made once and kept",
    highlight: true,
  },
];

const hostingRequests: { id: string; request: ReactNode; response: ReactNode }[] =
  [
    {
      id: "get",
      request: (
        <code>
          GET /api/hosting/
          <wbr />
          website/hero.jpg
        </code>
      ),
      response: (
        <>
          <code>200</code> with the file&apos;s own Content-Type, so it works in
          an <code>&lt;img&gt;</code> or <code>&lt;video&gt;</code> tag. Public
          files need no sign-in.
        </>
      ),
    },
    {
      id: "range",
      request: <code>Range: bytes=500-</code>,
      response: (
        <>
          <code>206 Partial Content</code>, so players can seek. Safari
          won&apos;t play a video without it.
        </>
      ),
    },
    {
      id: "etag",
      request: <code>If-None-Match: &quot;a-6899f2c1&quot;</code>,
      response: (
        <>
          <code>304 Not Modified</code> with no body, as long as the file is
          unchanged.
        </>
      ),
    },
    {
      id: "private",
      request: "A private file, unsigned",
      response: (
        <>
          <code>404</code>, the same answer as for a file that doesn&apos;t
          exist.
        </>
      ),
    },
    {
      id: "signed",
      request: <code>{"?exp=1786291200&sig=…"}</code>,
      response: "The private file, until the signed link expires.",
    },
  ];

const conversionNotes: Note[] = [
  {
    term: "Video",
    detail:
      "MP4, WebM, MOV, MKV or GIF, resized, trimmed or muted on the way. Give it a size, like 25 MB, and the video is fitted into it.",
  },
  {
    term: "Sound only",
    detail:
      "Pick MP3 to keep only a video's sound, trimmed to the part you want.",
  },
  {
    term: "Images",
    detail:
      "HEIC photos from a phone and most other images become WebP, JPG, PNG or AVIF, shrunk for the web if you like.",
  },
  {
    term: "Metadata",
    detail:
      "Results leave out where and when a photo or video was taken, so sharing one doesn't share that too.",
  },
];

const roles: { name: string; can: string }[] = [
  { name: "Admin", can: "Everything, including users and instance settings" },
  { name: "Editor", can: "Upload, edit and delete files, and create API keys" },
  { name: "Viewer", can: "Browse and download files" },
  { name: "Custom", can: "Only the scopes you tick" },
];

const accessNotes: Note[] = [
  {
    term: "API keys",
    detail:
      "Keys for your apps can read, write or delete and nothing more, and can expire on a date you set.",
  },
  {
    term: "Activity and alerts",
    detail:
      "Sign-ins, uploads, deletions and account changes are logged. The dashboard warns about low disk space, failed uploads, and keys that are about to expire or sit unused.",
  },
];

const phoneScreens: { name: string; alt: string; caption: string }[] = [
  {
    name: "files",
    alt: "A folder of travel photos shown as thumbnails in the app",
    caption: "Folders and thumbnails",
  },
  {
    name: "tools",
    alt: "The app's Tools tab with the video and image converters",
    caption: "Converters in the Tools tab",
  },
  {
    name: "viewer",
    alt: "A photo of a rocky coastline open in the app's viewer",
    caption: "The photo viewer",
  },
];

// the benchmark rows shown here, named to make sense without the full page
const benchmarkRows: { id: string; label: string }[] = [
  { id: "large_download", label: "Download a 1 GiB file" },
  { id: "list", label: "List a folder of 1,000 files" },
  { id: "rename", label: "Rename a file" },
  { id: "public_burst", label: "Serve a public file to 2,000 visitors" },
];

const textLink =
  "rounded-sm font-medium text-fd-foreground underline decoration-gold decoration-2 underline-offset-4 transition-[text-decoration-thickness] hover:decoration-[3px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

function Section({
  title,
  intro,
  actions,
  aside = false,
  children,
}: {
  title: string;
  intro: ReactNode;
  actions?: ReactNode;
  /** Puts the heading beside the content on wide screens instead of above it. */
  aside?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`border-t border-fd-border py-16 sm:py-20 ${aside ? "grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16" : ""}`}
    >
      <div>
        <h2 className="max-w-3xl font-display text-[clamp(1.75rem,1.4rem+1.4vw,2.5rem)] leading-tight font-semibold tracking-tight text-balance">
          {title}
        </h2>
        <div className="mt-4 max-w-2xl text-lg leading-relaxed text-pretty text-fd-muted-foreground">
          {intro}
        </div>
        {actions && (
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">{actions}</div>
        )}
      </div>
      <div className={aside ? "min-w-0" : "mt-10 sm:mt-12"}>{children}</div>
    </section>
  );
}

function Notes({ notes, className }: { notes: Note[]; className: string }) {
  return (
    <dl className={className}>
      {notes.map(({ term, detail }) => (
        <div key={term} className="border-t border-fd-border pt-4">
          <dt className="font-medium">{term}</dt>
          <dd className="mt-1 text-sm leading-relaxed text-pretty text-fd-muted-foreground">
            {detail}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function LinkParts() {
  return (
    <p className="flex flex-wrap gap-y-6 font-mono text-base sm:text-xl">
      {linkParts.map(({ text, note, highlight }) => (
        <span key={text} className="flex flex-col">
          <span
            className={highlight ? "text-fd-foreground" : "text-fd-muted-foreground"}
          >
            {text}
          </span>
          <span
            aria-hidden
            className={`mx-1 mt-2 h-0.5 rounded-full ${highlight ? "bg-gold" : "bg-fd-border"}`}
          />
          {note && (
            // zero width so the note wraps inside its part instead of widening it
            <span className="mt-2 w-0 min-w-full px-1 pr-4 font-sans text-sm leading-snug text-pretty text-fd-muted-foreground">
              {note}
            </span>
          )}
        </span>
      ))}
    </p>
  );
}

function HostingRequests() {
  return (
    <div className="@container">
      <h3 className="font-medium">What a request gets back</h3>
      <dl className="mt-4 [&_code]:font-mono [&_code]:text-[0.8125rem]">
        {hostingRequests.map(({ id, request, response }) => (
          <div
            key={id}
            className="grid gap-1 border-t border-fd-border py-3 @md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] @md:gap-6"
          >
            <dt className="text-sm wrap-break-word">{request}</dt>
            <dd className="text-sm leading-relaxed text-pretty text-fd-muted-foreground [&_code]:text-fd-foreground">
              {response}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function BenchmarkTable() {
  const { machine, runs, date } = benchmarkRun;
  return (
    <table className="w-full max-w-3xl text-left text-sm">
      <caption className="mt-3 caption-bottom text-left text-fd-muted-foreground">
        Medians of {runs} runs per server on an {machine.cpu} with{" "}
        {machine.memory}, measured {date}.
      </caption>
      <thead>
        <tr className="border-b border-fd-border">
          <th scope="col" className="py-2 pr-4 font-medium">
            Operation
          </th>
          <th scope="col" className="px-4 py-2 text-right font-medium">
            {appName}
          </th>
          <th scope="col" className="py-2 pl-4 text-right font-medium">
            Seafile
          </th>
        </tr>
      </thead>
      <tbody>
        {benchmarkRows.map(({ id, label }) => {
          const row = scenario(id);
          return (
            <tr key={id} className="border-b border-fd-border">
              <th scope="row" className="py-3 pr-4 font-normal">
                {label}
                <span className="block text-xs text-fd-muted-foreground first-letter:uppercase">
                  {directionOf(row)}
                </span>
              </th>
              <td className="px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums">
                {formatValue(row.results.vaze.median)} {row.unit}
              </td>
              <td className="py-3 pl-4 text-right whitespace-nowrap text-fd-muted-foreground tabular-nums">
                {formatValue(row.results.seafile.median)} {row.unit}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

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

  const operations = allScenarios.length;
  const faster = allScenarios.filter((entry) => speedup(entry) > 1).length;

  return (
    <main className="flex flex-1 flex-col overflow-x-clip">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <section className="mx-auto w-full max-w-6xl px-4 pt-12 sm:px-6 sm:pt-20">
        <h1 className="max-w-5xl font-display text-[clamp(2.5rem,1.5rem+3.75vw,4.5rem)] leading-[1.02] font-bold tracking-[-0.035em] text-balance">
          Store and host your files on a server you own
        </h1>
        <div className="mt-8 grid gap-8 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-end lg:gap-16">
          <div>
            <p className="max-w-xl text-lg leading-relaxed text-pretty text-fd-muted-foreground sm:text-xl">
              {appName} is a file server that runs in one Docker container.
              Manage files from the web dashboard or the Android app, link to
              them from anywhere, and use it as the storage behind your own
              projects.
            </p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
              <Link href={docsRoute} className={textLink}>
                Read the docs
              </Link>
              <a href={repoUrl} className={textLink}>
                Source on GitHub
              </a>
            </div>
          </div>
          <div className="min-w-0">
            <CopyCommand command={installCommand} />
            <p className="mt-3 text-sm text-fd-muted-foreground">
              Needs Docker with the Compose plugin.{" "}
              <Link
                href={`${docsRoute}/getting-started/installation`}
                className={textLink}
              >
                Other ways to install
              </Link>
            </p>
          </div>
        </div>

        <div className="relative mt-14 pb-[14%] sm:mt-20 sm:pb-[9%]">
          <div className="w-[90%] sm:w-[86%]">
            <BrowserFrame address={`${serverAddress}/dashboard`}>
              <Screenshot
                kind="web"
                name="dashboard"
                alt="The Vaze web dashboard with storage, hosting traffic and files added over the last 30 days"
                sizes="(min-width: 72rem) 990px, 90vw"
                eager="lcp"
              />
            </BrowserFrame>
          </div>
          <div className="absolute right-0 bottom-0 w-[27%] sm:w-[20%]">
            <PhoneFrame>
              <Screenshot
                kind="mobile"
                name="home"
                alt="The same dashboard in the Vaze Android app"
                sizes="(min-width: 72rem) 230px, 27vw"
                eager
              />
            </PhoneFrame>
          </div>
        </div>
      </section>

      <div className="mx-auto mt-20 w-full max-w-6xl px-4 sm:mt-28 sm:px-6">
        <Section
          title="Upload whole folders and keep their structure"
          intro={
            <p>
              Drop a folder on the dashboard and {appName} recreates it on the
              server, with progress, speed and a cancel button for every file.
            </p>
          }
        >
          <BrowserFrame address={`${serverAddress}/dashboard/files/photos`}>
            <Screenshot
              kind="web"
              name="files"
              alt="A folder of travel photos shown as a thumbnail grid"
              sizes="(min-width: 72rem) 1104px, 92vw"
            />
          </BrowserFrame>
          <Notes
            notes={fileNotes}
            className="mt-10 grid gap-x-10 gap-y-6 sm:grid-cols-3"
          />
        </Section>

        <Section
          title="Every file gets a link you can predict"
          intro={
            <p>
              Files keep the names you upload them with, so a file&apos;s link
              is its folder and name. It stays the same until you rename or
              move the file.
            </p>
          }
        >
          <LinkParts />
          <div className="mt-14 grid grid-cols-1 items-start gap-12 lg:grid-cols-2 lg:gap-16">
            <HostingRequests />
            <figure>
              <BrowserFrame address={`${serverAddress}/dashboard`}>
                <Screenshot
                  kind="web"
                  name="traffic"
                  alt="Recent files, the most requested hosted files and API requests per day"
                  sizes="(min-width: 72rem) 520px, 92vw"
                />
              </BrowserFrame>
              <figcaption className="mt-3 text-sm leading-relaxed text-pretty text-fd-muted-foreground">
                The dashboard counts requests and bytes served, ranks your most
                requested files and flags links that found nothing.
              </figcaption>
            </figure>
          </div>
        </Section>

        <Section
          title="Convert video and images where they're stored"
          intro={
            <p>
              Compress a video, cut it down or change its format from the
              dashboard or the app. Files never go to a third-party service.
            </p>
          }
        >
          <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16">
            <div className="relative pb-[12%]">
              <div className="w-[88%]">
                <BrowserFrame
                  address={`${serverAddress}/dashboard/conversion/video`}
                >
                  <Screenshot
                    kind="web"
                    name="video"
                    alt="A 410 MB video converted to a 720p WebM, 98% smaller"
                    sizes="(min-width: 72rem) 560px, 82vw"
                  />
                </BrowserFrame>
              </div>
              <div className="absolute right-0 bottom-0 w-[24%]">
                <PhoneFrame>
                  <Screenshot
                    kind="mobile"
                    name="video"
                    alt="A coastal video fitted to 25 MB in the app"
                    sizes="(min-width: 72rem) 160px, 24vw"
                  />
                </PhoneFrame>
              </div>
            </div>
            <Notes notes={conversionNotes} className="grid gap-6" />
          </div>
        </Section>

        <Section
          title="Give each person only the access they need"
          intro={
            <p>
              {appName} starts with one admin account. Add people when you need
              to, with a role or exactly the scopes you pick.
            </p>
          }
        >
          <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <div className="lg:col-start-2 lg:row-start-1">
              <BrowserFrame address={`${serverAddress}/dashboard/users`}>
                <Screenshot
                  kind="web"
                  name="users"
                  alt="The users page with an admin, editors, a custom role and a disabled account"
                  sizes="(min-width: 72rem) 640px, 92vw"
                />
              </BrowserFrame>
            </div>
            <div className="lg:col-start-1 lg:row-start-1">
              <h3 className="font-medium">Roles</h3>
              <dl className="mt-3 text-sm">
                {roles.map(({ name, can }) => (
                  <div
                    key={name}
                    className="grid grid-cols-[5rem_minmax(0,1fr)] gap-4 border-t border-fd-border py-2.5"
                  >
                    <dt className="font-medium">{name}</dt>
                    <dd className="text-pretty text-fd-muted-foreground">
                      {can}
                    </dd>
                  </div>
                ))}
              </dl>
              <Notes notes={accessNotes} className="mt-8 grid gap-6" />
            </div>
          </div>
        </Section>

        <Section
          aside
          title="An Android app for the same server"
          intro={
            <p>
              Add a home server and a VPS side by side, upload from your phone
              with live progress, and save files to Downloads or hand them to
              another app. A LAN address like 192.168.1.20:3000 works too.
            </p>
          }
        >
          <div className="grid grid-cols-3 gap-3 sm:gap-6">
            {phoneScreens.map(({ name, alt, caption }) => (
              <figure key={name}>
                <PhoneFrame>
                  <Screenshot
                    kind="mobile"
                    name={name}
                    alt={alt}
                    sizes="(min-width: 72rem) 200px, 30vw"
                  />
                </PhoneFrame>
                <figcaption className="mt-3 text-center text-xs text-balance text-fd-muted-foreground sm:text-sm">
                  {caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </Section>

        <Section
          aside
          title="Use it as your app's file storage"
          intro={
            <p>
              Upload, list, sign and delete files over a JSON API, or let the
              TypeScript SDK do it for you.
            </p>
          }
          actions={
            <>
              <Link href={`${docsRoute}/sdk`} className={textLink}>
                SDK guide
              </Link>
              <Link href={`${docsRoute}/api-reference`} className={textLink}>
                API reference
              </Link>
            </>
          }
        >
          {sdkCode}
        </Section>

        <Section
          title={
            faster === operations
              ? `Faster than Seafile in all ${operations} operations we measured`
              : `Faster than Seafile in ${faster} of ${operations} operations we measured`
          }
          intro={
            <p>
              Both ran on the same machine. {appName} also started in{" "}
              {formatValue(memoryMB.fresh.vaze)} MB of memory, against{" "}
              {formatValue(memoryMB.fresh.seafile)} MB for Seafile with its
              database and cache.
            </p>
          }
        >
          <BenchmarkTable />
          <p className="mt-8">
            <Link href={benchmarksRoute} className={textLink}>
              All {operations} results and how they were measured
            </Link>
          </p>
        </Section>

        <Section
          title="Install it in a few minutes"
          intro={
            <p>
              The installer checks Docker, writes your config with a fresh
              secret and starts {appName}. Run it again later to upgrade.
            </p>
          }
        >
          <div className="max-w-3xl">
            <CopyCommand command={installCommand} />
          </div>
          <ol className="mt-8 flex max-w-2xl list-decimal flex-col gap-3 pl-5 leading-relaxed text-pretty text-fd-muted-foreground marker:text-fd-muted-foreground">
            <li>
              Run it on the machine that will host {appName}. It asks where to
              install and which address you&apos;ll open it on.
            </li>
            <li>
              Open that address in a browser. By default it&apos;s the
              machine&apos;s address on your network, on port 3000 or the next
              free one.
            </li>
            <li>
              Register. The first account becomes the admin, and sign-ups close
              after it.
            </li>
          </ol>
        </Section>
      </div>

      <footer className="border-t border-fd-border">
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
          <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Footer">
            <Link href={docsRoute} className="hover:text-fd-foreground">
              Docs
            </Link>
            <Link href={benchmarksRoute} className="hover:text-fd-foreground">
              Benchmarks
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
