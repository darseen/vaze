import type { Metadata } from "next";
import Link from "next/link";
import { appName, contactEmail, docsRoute, repoUrl } from "@/lib/shared";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `How the ${appName} app, the ${appName} server and this website handle your data.`,
  alternates: {
    canonical: "/privacy",
  },
};

const effectiveDate = "October 18, 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-16 pb-24 sm:px-6 sm:pt-24">
      <h1 className="font-display text-4xl font-bold tracking-[-0.03em] sm:text-5xl">
        Privacy policy
      </h1>
      <p className="mt-3 text-fd-muted-foreground">
        Effective {effectiveDate}
      </p>

      <div className="mt-10 rounded-xl border border-fd-border bg-fd-card p-5 sm:p-6">
        <p className="font-medium">The short version</p>
        <p className="mt-2 leading-relaxed text-fd-muted-foreground">
          The {appName} app only talks to the {appName} servers you add to it.
          We don&apos;t run a service that receives your files or your
          account details, and the app contains no analytics, advertising or
          tracking.
        </p>
      </div>

      <article className="prose mt-12 max-w-none">
        <p>
          This policy covers the {appName} mobile app (package{" "}
          <code>dev.darseen.vaze</code>), the {appName} server software and
          this website. {appName} is made by darseen, an independent
          developer, referred to here as &quot;we&quot;.
        </p>

        <h2>Who controls your data</h2>
        <p>
          {appName} is self-hosted. Your files and accounts live on a{" "}
          {appName} server run by you, or by whoever gave you an account on
          theirs. That person decides how the server is run and how long
          data is kept on it. We have no access to any {appName} server or
          to anything stored on one.
        </p>

        <h2>What the app keeps on your device</h2>
        <ul>
          <li>
            <strong>The servers you add:</strong> each server&apos;s address,
            the name you gave it, and the name and email of the account last
            signed in there, so the server list can show them.
          </li>
          <li>
            <strong>Your sign-in sessions:</strong> a session token for each
            server, kept in the device&apos;s encrypted secure storage. Your
            password is never saved on the device.
          </li>
          <li>
            <strong>Preferences:</strong> your theme, how files are sorted,
            and whether folders show as a grid or a list.
          </li>
          <li>
            <strong>Temporary files:</strong> thumbnails of files you have
            viewed, and short-lived copies of files while they upload,
            download or are shared. These sit in the app&apos;s cache, which
            the app and Android both clear.
          </li>
        </ul>
        <p>
          None of this leaves your device except as described below.
          Removing a server in the app signs you out of it and deletes its
          saved session. Uninstalling the app deletes everything it stored.
        </p>

        <h2>What the app sends, and where</h2>
        <p>
          The app sends data only to the server whose address you entered,
          and only to do what you ask:
        </p>
        <ul>
          <li>
            Your email and password when you sign in, or when you create the
            first admin account on a new server.
          </li>
          <li>Your session token with each request.</li>
          <li>
            The files you upload, with their names, and the changes you make
            to files, folders, users, API keys and settings.
          </li>
          <li>
            When you sign in, a short device description such as{" "}
            <code>Vaze/1.0.0 (Android 15)</code>, so the server&apos;s list
            of signed-in devices can show which session is the app.
          </li>
        </ul>
        <p>
          Like any server, a {appName} server also sees the network address
          your requests come from, and keeps it with your session so you can
          review and sign out devices.
        </p>
        <p>
          The app allows plain <code>http://</code> addresses so that servers
          on your home network work. When you connect over the internet, use
          an <code>https://</code> address so your password and files are
          encrypted on the way.
        </p>

        <h2>What we don&apos;t collect</h2>
        <p>
          We don&apos;t collect, receive, share or sell personal data
          through the app. It has no analytics, no advertising identifiers,
          no third-party crash reporting and no tracking of any kind. It
          doesn&apos;t access your location, contacts, camera or microphone.
        </p>

        <h2>Permissions and device features</h2>
        <ul>
          <li>
            <strong>Network access</strong> to reach the servers you add.
          </li>
          <li>
            <strong>Photo and file pickers:</strong> uploads use the
            system&apos;s photo picker and document picker, so the app only
            receives the items you choose. It has no general access to your
            photo library or storage.
          </li>
          <li>
            <strong>Saving to Downloads:</strong> on Android 10 and later,
            files you download are saved to your Downloads folder without a
            storage permission. On older versions the app opens the share
            sheet instead.
          </li>
          <li>
            <strong>Audio settings</strong> to play audio and video files you
            open.
          </li>
          <li>
            <strong>Vibration</strong> for haptic feedback.
          </li>
          <li>
            <strong>Clipboard:</strong> the app writes to the clipboard only
            when you tap to copy a link or a new API key. It never reads the
            clipboard.
          </li>
        </ul>

        <h2>The {appName} server</h2>
        <p>
          When you run the {appName} server, its database, files, logs and
          statistics stay on the machine you run it on. The server
          doesn&apos;t send usage data or telemetry to us or to anyone else.
          The{" "}
          <Link href={`${docsRoute}/getting-started/configuration`}>
            configuration docs
          </Link>{" "}
          explain how long activity and request history are kept and how to
          change it.
        </p>

        <h2>This website</h2>
        <p>
          This website doesn&apos;t use cookies or advertising. It counts
          visits with Cloudflare Web Analytics, which doesn&apos;t use cookies
          or follow you across other sites. For each visit it records the
          page you opened, the page that linked you there, your browser,
          operating system, device type and country, and how quickly the
          page loaded.
        </p>
        <p>
          If you pick a light or dark theme, that choice is saved in your
          browser&apos;s local storage. The site is hosted by Netlify and
          served through Cloudflare, and both may keep standard server logs,
          such as IP addresses and the pages requested, to keep the site
          running and secure.
        </p>

        <h2>Children</h2>
        <p>
          {appName} isn&apos;t directed at children under 13, and we
          don&apos;t knowingly collect personal data from anyone, including
          children.
        </p>

        <h2>Deleting your data</h2>
        <p>
          We don&apos;t hold any of your data, so there is nothing for us to
          delete. To remove what the app stores, remove the server in the
          app or uninstall it. To delete your account or files on a server,
          ask the server&apos;s admin. Admins can delete accounts from the
          Users page and files from the Files page.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          If this policy changes, we will update this page and the effective
          date at the top. Significant changes will also be mentioned in the
          release notes on <a href={`${repoUrl}/releases`}>GitHub</a>.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about privacy can go to{" "}
          <a href={`mailto:${contactEmail}`}>{contactEmail}</a> or to the{" "}
          <a href={`${repoUrl}/issues`}>issue tracker on GitHub</a>.
        </p>
      </article>
    </main>
  );
}
