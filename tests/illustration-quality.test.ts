import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { inspectIllustrationQuality } from "@/lib/illustration-quality";

function toDataUrl(bytes: Buffer, mimeType = "image/png") {
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

async function createDetailedPng(width: number, height: number) {
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      const checker = (Math.floor(x / 12) + Math.floor(y / 12)) % 2;
      pixels[offset] = (x * 7 + y * 3 + checker * 97) % 256;
      pixels[offset + 1] = (x * 2 + y * 11 + checker * 53) % 256;
      pixels[offset + 2] = (x * 13 + y * 5 + checker * 31) % 256;
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}

describe("illustration quality inspection", () => {
  it("accepts a detailed 800 by 600 PNG and reports real dimensions", async () => {
    const report = await inspectIllustrationQuality(
      toDataUrl(await createDetailedPng(800, 600)),
    );

    expect(report).toMatchObject({
      version: 1,
      status: "warning",
      width: 800,
      height: 600,
      format: "png",
    });
    expect(report.warnings).toContain("low-resolution");
    expect(report.bytes).toBeGreaterThan(0);
    expect(report.entropy).toBeGreaterThan(2);
    expect(report.sharpness).toBeGreaterThan(0.8);
  });

  it("rejects images below the minimum usable dimensions", async () => {
    await expect(
      inspectIllustrationQuality(
        toDataUrl(await createDetailedPng(128, 128)),
      ),
    ).rejects.toMatchObject({ errorClass: "invalid_response" });
  });

  it("rejects SVG placeholders instead of treating them as real illustrations", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="100%" height="100%" fill="#fff"/></svg>',
    );

    await expect(
      inspectIllustrationQuality(toDataUrl(svg, "image/svg+xml")),
    ).rejects.toMatchObject({ errorClass: "invalid_response" });
  });

  it("rejects blank and fully transparent images", async () => {
    const solid = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: "#ffffff",
      },
    })
      .png()
      .toBuffer();
    const transparent = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 4,
        background: { r: 90, g: 120, b: 180, alpha: 0 },
      },
    })
      .png()
      .toBuffer();

    await expect(
      inspectIllustrationQuality(toDataUrl(solid)),
    ).rejects.toMatchObject({ errorClass: "invalid_response" });
    await expect(
      inspectIllustrationQuality(toDataUrl(transparent)),
    ).rejects.toMatchObject({ errorClass: "invalid_response" });
  });
});
