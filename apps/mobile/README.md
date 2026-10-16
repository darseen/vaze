# Vaze Mobile

The Vaze app for Android and iOS, built with Expo. Add your Vaze servers,
sign in with your account, and browse, upload and manage files from your
phone. Every request to a server goes through [`@darseen/vaze`](../../packages/sdk).

## Requirements

- A Vaze server with session support in the SDK (`/api/me`, `/api/stats` and
  the Better Auth Expo plugin). Older servers show an "update it" message.
- A development build. Expo Go doesn't include every native module the app
  uses.
- For Android builds, JDK 17. Newer JDKs fail the CMake step of
  `react-native-screens` and `react-native-worklets`.

## Running

Build the SDK once (the app imports its `dist`), then start a dev build:

```bash
pnpm --filter @darseen/vaze build
cd apps/mobile
JAVA_HOME=/path/to/jdk-17 pnpm android   # or: pnpm ios
```

After the first build, `pnpm start` is enough until native dependencies change.

An Android emulator reaches a server on your machine at `10.0.2.2`, so start
the server with `BASE_URL=http://10.0.2.2:3000` and add `10.0.2.2:3000` in the
app. Plain `http://` works for LAN servers on both platforms.

## How it fits together

- `src/app`: routes. `index.tsx` is the server list; `server/[id]/(tabs)`
  holds the dashboard and file browser for one server, and `server/[id]/view`
  is the full-screen file viewer above the tabs.
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
