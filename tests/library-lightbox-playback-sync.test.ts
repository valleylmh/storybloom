import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const readerSource = readFileSync(
  fileURLToPath(
    new URL(
      "../src/components/library/LibraryBookReader.tsx",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("library lightbox playback synchronization", () => {
  it("follows reader page changes while the image preview is open", () => {
    expect(readerSource).toContain(
      "setLightboxIndex((currentIndex) =>",
    );
    expect(readerSource).toContain(
      "currentIndex === null ? null : pageIndex",
    );
  });
});
