import { describe, expect, it } from "vitest";
import { createZipBlob } from "@/lib/client-zip";

describe("createZipBlob", () => {
  it("stores UTF-8 file names and bilingual story text", async () => {
    const story = "Page 1\n中文：月光糖\nEnglish: moonlight candy";
    const blob = await createZipBlob([
      { name: "story-bilingual.txt", data: story },
      { name: "images/page-01.png", data: new Uint8Array([1, 2, 3]) },
    ]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const decoded = new TextDecoder().decode(bytes);

    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(decoded).toContain("story-bilingual.txt");
    expect(decoded).toContain("images/page-01.png");
    expect(decoded).toContain(story);
  });
});
