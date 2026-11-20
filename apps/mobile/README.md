# Vaze Mobile

The Vaze app for Android and iOS, built with Expo. Add your Vaze servers,
sign in with your account, and browse, upload and manage files from your
phone. Every request to a server goes through the published
[`@darseen/vaze`](https://npmjs.com/package/@darseen/vaze) SDK from npm, not
the copy in [`packages/sdk`](../../packages/sdk). To use an SDK change in the
app, release the SDK first (bump its version and push, and CI publishes it),
then raise the version the app depends on.

## Requirements

- A Vaze server with session support in the SDK (`/api/me`, `/api/stats` and
  the Better Auth Expo plugin). Older servers show an "update it" message.
  Recently deleted needs Vaze 4.4.0, video to audio 4.5.0, image
  conversion 4.6.0, and the video converter and the PDF tools 4.8.0. On older
  servers, and on servers that turn Conversion or the PDF tools off, their
  entry points stay hidden, and so does the Tools tab when none are left.
- A development build. Expo Go doesn't include every native module the app
  uses.
- For Android builds, JDK 17. Newer JDKs fail the CMake step of
  `react-native-screens` and `react-native-worklets`.

## Running

Start a dev build:

```bash
cd apps/mobile
JAVA_HOME=/path/to/jdk-17 pnpm android   # or: pnpm ios
```

After the first build, `pnpm start` is enough until native dependencies change.

An Android emulator reaches a server on your machine at `10.0.2.2`, so start
the server with `BASE_URL=http://10.0.2.2:3000` and add `10.0.2.2:3000` in the
app. Plain `http://` works for LAN servers on both platforms.

## How it fits together

- `src/app`: routes. `index.tsx` is the server list; `server/[id]/(tabs)`
  holds the dashboard, the file browser and the Tools tab for one server, and
  `server/[id]/view` is the full-screen file viewer above the tabs, like
  `server/[id]/deleted` for Recently deleted and
  `server/[id]/conversion/[tool]` and `server/[id]/pdf/[tool]` for each tool,
  named as in the dashboard's URLs.
- `src/lib/tools.ts`: the Tools tab's sections and what each tool needs from
  the server. `vaze.tools()` says which ones a server offers, asked once as
  it opens.
- `src/lib/conversion.ts`: a stored file converts through Expo's streaming
  fetch, so the result is written to disk as it arrives. A file from the
  phone goes through React Native's XHR instead, the one client that streams
  the upload from disk with progress; its result comes back whole. Video to
  audio, images and the PDF tools share this, sending several files in order
  where a tool takes them, to the URLs the SDK gives. A video converts as a
  job instead: it starts with the upload or `startVideo`, is polled with
  `videoJob`, streams down from `videoDownloadUrl`, and is removed from the
  server with `cancelVideo` once it is on the phone or the screen closes.
- `src/lib/pdf-tools.ts`: the PDF tools' result names and their requests to
  `vaze.pdf`'s URLs.
- `modules/file-previews`: a local Expo module that grabs video frames
  (`MediaMetadataRetriever` / AVFoundation) and renders PDF pages
  (`PdfRenderer` / PDFKit) for thumbnails and the viewer. Changing it needs a
  native rebuild. `src/lib/previews.ts` queues and caches its output under the
  app's cache directory.
- `modules/downloads`: a local Android module that copies a finished download
  into the shared Downloads folder through MediaStore, like a browser, with
  no permission. `src/lib/transfer.ts` falls back to the share sheet on iOS
  and Android 9 or older.
- `src/lib/clients.ts`: one Better Auth client and one SDK client per server.
  The session cookie lives in SecureStore under a prefix per server, and the
  SDK sends it with every request.
- `src/stores`: Zustand stores. Servers and preferences persist to
  AsyncStorage; folder listings, stats and uploads are in memory.
- UI is HeroUI Native styled with Uniwind (Tailwind 4). Most actions open in
  a bottom sheet.
- Uniwind patches Metro's module graph through its own `metro` and
  `metro-cache` peers, so both are pinned to the exact Metro that Expo's
  bundler runs (the version `@expo/metro` depends on). `expo install`
  recommends an older Metro line, so `metro` is in `expo.install.exclude`.
  After an SDK upgrade, move both pins to the new `@expo/metro`'s Metro.
