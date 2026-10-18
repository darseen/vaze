/* eslint-disable @next/next/no-img-element -- the card renderer only reads plain <img> */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import { appName, siteUrl } from "@/lib/shared";

export const ogSize = { width: 1200, height: 630 };

const colors = {
  background: "#0c0c0c",
  foreground: "#fafafa",
  muted: "#a3a3a3",
  subtle: "#737373",
  gold: "#e3b341",
  border: "#2a2a2a",
};

const fontFamily = "Schibsted Grotesk";

// Google Fonts answers a client it doesn't recognize with TTF, which the renderer needs
async function loadFont(weight: number): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@${weight}`,
  ).then((res) => res.text());
  const url = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/.exec(
    css,
  )?.[1];
  if (!url) throw new Error(`No TTF for ${fontFamily} ${weight}`);
  return fetch(url).then((res) => res.arrayBuffer());
}

let fonts: ReturnType<typeof loadFonts> | undefined;

function loadFonts() {
  return Promise.all(
    ([400, 700] as const).map(async (weight) => ({
      name: fontFamily,
      data: await loadFont(weight),
      weight,
      style: "normal" as const,
    })),
  );
}

async function asset(path: string, type: string) {
  const data = await readFile(join(process.cwd(), path));
  return `data:${type};base64,${data.toString("base64")}`;
}

async function render(card: ReactElement) {
  fonts ??= loadFonts();
  return new ImageResponse(card, { ...ogSize, fonts: await fonts });
}

function Wordmark({ logo }: { logo: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      {/* the logo is 579 by 630 */}
      <img src={logo} width={53} height={58} alt="" />
      <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -0.5 }}>
        {appName}
      </div>
    </div>
  );
}

const host = new URL(siteUrl).host;

/** The card shared for the landing page: the headline beside the dashboards. */
export async function homeCard() {
  const [logo, dashboard, phone] = await Promise.all([
    asset("public/vaze.png", "image/png"),
    asset("assets/og/dashboard.jpg", "image/jpeg"),
    asset("assets/og/phone.jpg", "image/jpeg"),
  ]);

  return render(
    <div
      style={{
        ...ogSize,
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background: colors.background,
        color: colors.foreground,
        fontFamily,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 620,
          top: 92,
          display: "flex",
          borderRadius: 16,
          border: `2px solid ${colors.border}`,
          overflow: "hidden",
        }}
      >
        <img src={dashboard} width={760} height={475} alt="" />
      </div>
      <div
        style={{
          position: "absolute",
          left: 950,
          top: 250,
          display: "flex",
          padding: 7,
          borderRadius: 34,
          background: "#262626",
          border: `2px solid #3a3a3a`,
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.7)",
        }}
      >
        <img
          src={phone}
          width={176}
          height={391}
          style={{ borderRadius: 27 }}
          alt=""
        />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: 560,
          padding: "64px 0 60px 72px",
        }}
      >
        <Wordmark logo={logo} />
        <div
          style={{
            fontSize: 60,
            fontWeight: 700,
            lineHeight: 1.04,
            letterSpacing: -2,
          }}
        >
          Store and host your files on a server you own
        </div>
        <div style={{ fontSize: 26, color: colors.gold }}>{host}</div>
      </div>
    </div>,
  );
}

/** The card shared for a docs page: its section, title and description. */
export async function docsCard({
  section,
  title,
  description,
  path,
}: {
  section: string;
  title: string;
  description?: string;
  path: string;
}) {
  const logo = await asset("public/vaze.png", "image/png");

  return render(
    <div
      style={{
        ...ogSize,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        padding: "64px 72px 60px",
        background: colors.background,
        color: colors.foreground,
        fontFamily,
      }}
    >
      <img
        src={logo}
        width={331}
        height={360}
        style={{ position: "absolute", right: 80, top: 135 }}
        alt=""
      />
      <Wordmark logo={logo} />
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 680 }}>
        <div style={{ fontSize: 30, color: colors.gold }}>{section}</div>
        <div
          style={{
            marginTop: 12,
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.04,
            letterSpacing: -2.5,
          }}
        >
          {title}
        </div>
        {description && (
          <div
            style={{
              marginTop: 24,
              fontSize: 32,
              lineHeight: 1.35,
              color: colors.muted,
            }}
          >
            {description}
          </div>
        )}
      </div>
      <div style={{ fontSize: 24, color: colors.subtle }}>
        {`${host}${path}`}
      </div>
    </div>,
  );
}
