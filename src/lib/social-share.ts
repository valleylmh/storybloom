import type { StoryPage } from "@/types";

export type CanvasImage = HTMLImageElement & {
  cleanupObjectUrl?: () => void;
};

export async function createImage(src: string) {
  let imageSrc = src;
  let objectUrl: string | null = null;

  if (!src.startsWith("data:")) {
    const response = await fetch(src, { mode: "cors" });
    if (!response.ok) {
      throw new Error(`图片加载失败，无法生成分享图：HTTP ${response.status}`);
    }

    objectUrl = URL.createObjectURL(await response.blob());
    imageSrc = objectUrl;
  }

  return new Promise<CanvasImage>((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      reject(new Error("图片加载超时，无法生成分享图。"));
    }, 45_000);

    image.onload = () => {
      window.clearTimeout(timeout);
      if (objectUrl) {
        (image as CanvasImage).cleanupObjectUrl = () =>
          URL.revokeObjectURL(objectUrl);
      }
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      reject(new Error("图片加载失败，无法生成分享图。"));
    };
    image.src = imageSrc;
  });
}

export function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const lines: string[] = [];
  let current = "";

  for (const character of Array.from(text)) {
    const next = current + character;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current.trimEnd());
      current = character.trimStart();
    } else {
      current = next;
    }
  }

  if (current.trim()) {
    lines.push(current.trim());
  }

  return lines;
}

export function wrapWords(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const lines: string[] = [];
  let current = "";

  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

export function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  maxLines?: number,
) {
  const visibleLines =
    typeof maxLines === "number" ? lines.slice(0, maxLines) : lines;
  visibleLines.forEach((line, index) => {
    const suffix =
      maxLines && index === maxLines - 1 && lines.length > maxLines
        ? "..."
        : "";
    ctx.fillText(`${line}${suffix}`, x, y + index * lineHeight);
  });

  return y + visibleLines.length * lineHeight;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("社交分享图片生成失败。"));
      }
    }, "image/png");
  });
}

export function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: CanvasImage,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(
    image,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

export function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-").slice(0, 48);
}

export function createBilingualStoryText(title: string, pages: StoryPage[]) {
  return [
    title,
    "",
    ...pages.map(
      (page) =>
        `Page ${page.page}\n中文：${page.zhText || ""}\nEnglish: ${page.enText || ""}`,
    ),
  ].join("\n\n");
}

function copyTextWithSelection(text: string) {
  const activeElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.inset = "0 auto auto -9999px";
  document.body.appendChild(textarea);
  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    return document.execCommand("copy");
  } finally {
    textarea.remove();
    if (activeElement?.isConnected) {
      activeElement.focus();
    }
  }
}

export async function copyTextToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Embedded browsers may deny clipboard permission; use selection fallback.
  }

  try {
    if (copyTextWithSelection(text)) {
      return;
    }
  } catch {
    // Use the same actionable message for unsupported legacy copy paths.
  }

  throw new Error("当前浏览器无法自动复制，请手动选择文本复制。");
}

export function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}

/**
 * 生成社交分享包文件：逐页 1080x1440 图片（底部叠加中英文文字）、
 * story-bilingual.txt 全文和 README.txt。生成区与绘本馆共用同一交互。
 */
export async function createSocialShareFiles(
  title: string,
  pages: StoryPage[],
  bilingualText?: string,
) {
  const storyText = bilingualText ?? createBilingualStoryText(title, pages);
  const loadedImages = await Promise.all(
    pages.map((page) => (page.imageUrl ? createImage(page.imageUrl) : null)),
  );

  try {
    const files: File[] = [];
    const width = 1080;
    const height = 1440;
    const textX = 72;
    const textMaxWidth = width - textX * 2;

    for (const [index, page] of pages.entries()) {
      const image = loadedImages[index];
      if (!image) {
        continue;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("当前浏览器不支持 Canvas。");
      }

      drawImageCover(ctx, image, width, height);
      ctx.font = "700 40px Microsoft YaHei, sans-serif";
      const zhLines = page.zhText
        ? wrapText(ctx, page.zhText, textMaxWidth)
        : [];
      ctx.font = "400 28px Arial, sans-serif";
      const enLines = page.enText
        ? wrapWords(ctx, page.enText, textMaxWidth)
        : [];
      const visibleZhLines = Math.min(3, zhLines.length);
      const visibleEnLines = Math.min(3, enLines.length);
      const languageGap = visibleZhLines > 0 && visibleEnLines > 0 ? 12 : 0;
      const textBlockHeight =
        visibleZhLines * 54 + languageGap + visibleEnLines * 40;
      const textTop = height - 62 - textBlockHeight;

      const overlay = ctx.createLinearGradient(
        0,
        Math.max(700, textTop - 190),
        0,
        height,
      );
      overlay.addColorStop(0, "rgba(25, 18, 14, 0)");
      overlay.addColorStop(0.52, "rgba(25, 18, 14, 0.28)");
      overlay.addColorStop(1, "rgba(25, 18, 14, 0.88)");
      ctx.fillStyle = overlay;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "rgba(255, 252, 247, 0.9)";
      ctx.font = "700 25px Arial, Microsoft YaHei, sans-serif";
      ctx.fillText(`STORYBLOOM  ·  ${String(page.page).padStart(2, "0")}`, textX, 76);

      ctx.textBaseline = "top";
      let textY = textTop;
      ctx.fillStyle = "#fffaf4";
      ctx.font = "700 40px Microsoft YaHei, sans-serif";
      if (visibleZhLines > 0) {
        textY = drawWrappedText(ctx, zhLines, textX, textY, 54, 3);
      }
      if (visibleEnLines > 0) {
        textY += languageGap;
        ctx.fillStyle = "rgba(255, 250, 244, 0.82)";
        ctx.font = "400 28px Arial, sans-serif";
        drawWrappedText(ctx, enLines, textX, textY, 40, 3);
      }
      ctx.textBaseline = "alphabetic";

      const pngBlob = await canvasToPngBlob(canvas);
      files.push(
        new File(
          [pngBlob],
          `images/page-${String(page.page).padStart(2, "0")}.png`,
          { type: "image/png" },
        ),
      );
    }

    const readme = [
      "StoryBloom 社交分享包",
      "",
      "images/：适合微信、小红书发布的逐页图片，图片底部已叠加中英文文字。",
      `story-bilingual.txt：按 Page 1 到 Page ${pages.length} 排列的中英文故事全文。`,
    ].join("\n");

    files.push(
      new File([storyText], "story-bilingual.txt", {
        type: "text/plain;charset=utf-8",
      }),
      new File([readme], "README.txt", { type: "text/plain;charset=utf-8" }),
    );
    return files;
  } finally {
    loadedImages.forEach((image) => image?.cleanupObjectUrl?.());
  }
}
