import { describe, expect, it } from "vitest";
import {
  isValidKey,
  isValidName,
  joinKey,
  keyToUrl,
  normalizeKey,
  parentKeyOf,
  toStoragePath,
} from "@/app/api/_utils";
import { BASE_UPLOADS_PATH } from "@/constants";
import path from "node:path";

describe("isValidName", () => {
  it("accepts ordinary names, including dotted ones", () => {
    for (const name of ["photo.png", "v1.0", "my.project", "no-extension"]) {
      expect(isValidName(name), name).toBe(true);
    }
  });

  it("rejects traversal, separators and NUL", () => {
    for (const name of ["..", ".", "a/b", "a\\b", "a\0b", "", "   "]) {
      expect(isValidName(name), JSON.stringify(name)).toBe(false);
    }
  });

  it("rejects non-strings", () => {
    for (const value of [null, undefined, 42, {}]) {
      expect(isValidName(value)).toBe(false);
    }
  });
});

describe("normalizeKey", () => {
  it("strips leading, trailing and repeated slashes", () => {
    expect(normalizeKey("/projects/demo/")).toBe("projects/demo");
    expect(normalizeKey("projects//demo")).toBe("projects/demo");
    expect(normalizeKey("")).toBe("");
    expect(normalizeKey("/")).toBe("");
  });
});

describe("isValidKey", () => {
  it("accepts the root key and nested keys", () => {
    expect(isValidKey("")).toBe(true);
    expect(isValidKey("projects")).toBe(true);
    expect(isValidKey("projects/demo/photo.png")).toBe(true);
  });

  it("rejects any key with a traversal segment", () => {
    for (const key of ["..", "../etc", "projects/../../etc", "a/./b", "a\0/b"]) {
      expect(isValidKey(key), key).toBe(false);
    }
  });
});

describe("joinKey / parentKeyOf", () => {
  it("round-trips", () => {
    expect(joinKey("", "photo.png")).toBe("photo.png");
    expect(joinKey("projects/demo", "photo.png")).toBe(
      "projects/demo/photo.png",
    );
    expect(parentKeyOf("projects/demo/photo.png")).toBe("projects/demo");
    expect(parentKeyOf("photo.png")).toBe("");
  });
});

describe("toStoragePath", () => {
  it("resolves keys under the uploads root", () => {
    expect(toStoragePath("")).toBe(path.resolve(BASE_UPLOADS_PATH));
    expect(toStoragePath("a/b.png")).toBe(
      path.join(path.resolve(BASE_UPLOADS_PATH), "a", "b.png"),
    );
  });

  it("throws rather than resolving outside the uploads root", () => {
    for (const key of ["../secrets", "a/../../secrets", "../../etc/passwd"]) {
      expect(() => toStoragePath(key), key).toThrow(/outside the uploads root/);
    }
  });
});

describe("keyToUrl", () => {
  it("encodes each segment but keeps the separators", () => {
    expect(keyToUrl("projects/demo/photo.png")).toBe(
      "api/hosting/projects/demo/photo.png",
    );
    expect(keyToUrl("my folder/a#b?c.png")).toBe(
      "api/hosting/my%20folder/a%23b%3Fc.png",
    );
  });
});
