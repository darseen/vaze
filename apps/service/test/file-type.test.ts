import mime from "mime-types";
import { describe, expect, it } from "vitest";
import { getPreviewKind } from "@/utils/file-type";

// the same lookup an upload uses to fill in `mimeType`
function previewOf(name: string) {
  return getPreviewKind(name, mime.lookup(name) || "application/octet-stream");
}

describe("getPreviewKind", () => {
  it("previews the formats a browser can render", () => {
    expect(previewOf("photo.jpg")).toBe("image");
    expect(previewOf("logo.svg")).toBe("image");
    expect(previewOf("clip.mp4")).toBe("video");
    expect(previewOf("song.mp3")).toBe("audio");
    expect(previewOf("report.pdf")).toBe("pdf");
    expect(previewOf("notes.md")).toBe("text");
    expect(previewOf("server.log")).toBe("text");
  });

  it("previews code as text even when its mime type says otherwise", () => {
    expect(previewOf("index.ts")).toBe("text");
    expect(previewOf("main.go")).toBe("text");
    expect(previewOf("data.json")).toBe("text");
  });

  it("skips images most browsers can't decode", () => {
    expect(previewOf("photo.heic")).toBeNull();
    expect(previewOf("scan.tiff")).toBeNull();
  });

  it("skips formats it has no preview for", () => {
    expect(previewOf("backup.zip")).toBeNull();
    expect(previewOf("slides.pptx")).toBeNull();
    expect(previewOf("README")).toBeNull();
  });
});
