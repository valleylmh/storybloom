"use client";
import { useEffect, useRef, useState } from "react";
import {
  spreadStart,
  type CustomWorkbenchDraft,
  type WorkbenchAsset,
} from "@/lib/custom-workbench";

import { artworkText, artworkMatchesText } from "@/lib/custom-book/integrated";
import { layoutTextBox } from "@/lib/custom-book/layout";

export function pageDimensions(
  format: CustomWorkbenchDraft["format"],
): [number, number] {
  return format === "portrait"
    ? [720, 900]
    : format === "landscape"
      ? [960, 720]
      : [800, 800];
}
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片无法读取，请替换图片后重试。"));
    img.src = src;
  });
}
export async function drawWorkbench(
  canvas: HTMLCanvasElement,
  draft: CustomWorkbenchDraft,
  page: number,
  hideText = false,
) {
  const [pw, h] = pageDimensions(draft.format);
  const start = spreadStart(draft, page);
  const w = start ? pw * 2 : pw;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("浏览器暂不支持画布。");
  ctx.fillStyle = draft.typography.background;
  ctx.fillRect(0, 0, w, h);
  const asset: WorkbenchAsset | undefined =
    page === 0 ? draft.cover : draft.pages[(start || page) - 1]?.asset;
  const pageConfig = page === 0 ? undefined : draft.pages[(start || page) - 1];
  const layout = pageConfig?.layout || "panorama";
  if (asset) {
    const img = await loadImage(asset.src);
    if (asset.embeddedText) {
      const scale = Math.min(w / img.width, h / img.height);
      ctx.drawImage(
        img,
        (w - img.width * scale) / 2,
        (h - img.height * scale) / 2,
        img.width * scale,
        img.height * scale,
      );
      return {
        overflow: false,
        contentMismatch: !artworkMatchesText(
          asset.embeddedText,
          artworkText(draft, page),
        ),
      };
    }
    const ratio =
      asset.ratio === "square"
        ? 1
        : asset.ratio === "portrait"
          ? 0.8
          : asset.ratio === "landscape"
            ? 4 / 3
            : w / h;
    const sw0 = Math.min(img.width, img.height * ratio);
    const sh0 = sw0 / ratio;
    const sw = sw0 / asset.crop.zoom,
      sh = sh0 / asset.crop.zoom;
    const sx = ((img.width - sw) * asset.crop.x) / 100,
      sy = ((img.height - sh) * asset.crop.y) / 100;
    const scale = Math.max(w / sw, h / sh);
    const dw = sw * scale,
      dh = sh * scale;
    ctx.save();
    if (layout === "minimal") {
      const inset = pw * 0.09,
        panelHeight = h * 0.58;
      const scale = Math.max((w - inset * 2) / sw, panelHeight / sh);
      ctx.beginPath();
      ctx.rect(inset, inset, w - inset * 2, panelHeight);
      ctx.clip();
      ctx.drawImage(
        img,
        sx,
        sy,
        sw,
        sh,
        (w - sw * scale) / 2,
        inset + (panelHeight - sh * scale) / 2,
        sw * scale,
        sh * scale,
      );
    } else
      ctx.drawImage(img, sx, sy, sw, sh, (w - dw) / 2, (h - dh) / 2, dw, dh);
    ctx.restore();
  } else {
    ctx.fillStyle = "#e2e8d7";
    ctx.beginPath();
    ctx.arc(w * 0.7, h * 0.4, h * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b2bea5";
    ctx.font = "24px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("在这里放入你的故事画面", w / 2, h * 0.4);
  }
  if (layout === "sidebar") {
    ctx.fillStyle = draft.typography.background;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.68);
    ctx.bezierCurveTo(w * 0.25, h * 0.81, w * 0.6, h * 0.58, w, h * 0.7);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
  }
  if (layout === "embrace") {
    const mist = ctx.createLinearGradient(0, h * 0.48, 0, h);
    mist.addColorStop(0, draft.typography.background + "00");
    mist.addColorStop(0.55, draft.typography.background + "e6");
    mist.addColorStop(1, draft.typography.background);
    ctx.fillStyle = mist;
    ctx.fillRect(0, h * 0.48, w, h * 0.52);
  }
  if (layout === "minimal") {
    ctx.strokeStyle = draft.typography.color + "55";
    ctx.lineWidth = 1;
    for (let side = 0; side < (start ? 2 : 1); side++) {
      ctx.beginPath();
      ctx.moveTo(side * pw + pw * 0.12, h * 0.7);
      ctx.lineTo(side * pw + pw * 0.23, h * 0.7);
      ctx.stroke();
    }
  }
  if (hideText) return { overflow: false };
  let overflow = false;
  const texts =
    page === 0
      ? [
          [
            draft.title || "未命名绘本",
            draft.subtitle,
            draft.author && `作者 · ${draft.author}`,
          ]
            .filter(Boolean)
            .join("\n"),
        ]
      : start
        ? [draft.pages[start - 1].text, draft.pages[start].text]
        : [draft.pages[page - 1].text];
  texts.forEach((text, index) => {
    const size =
      page === 0 ? draft.typography.size * 1.5 : draft.typography.size;
    ctx.font = `${page === 0 ? "600" : "400"} ${size}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    const box = layoutTextBox(layout, pw, h, index);
    const margin = 48,
      maxWidth = box.width,
      lineHeight = size * 1.55;
    const lines: string[] = [];
    for (const paragraph of text.split("\n")) {
      let line = "";
      for (const character of Array.from(paragraph)) {
        if (line && ctx.measureText(line + character).width > maxWidth) {
          lines.push(line);
          line = character;
        } else line += character;
      }
      lines.push(line);
    }
    if (!text) return;
    const boxHeight = lines.length * lineHeight + 32;
    if (boxHeight > box.height) overflow = true;
    const y =
      draft.typography.position === "top"
        ? box.y
        : draft.typography.position === "middle"
          ? box.y + (box.height - boxHeight) / 2
          : box.y + box.height - boxHeight;
    const x = box.x;
    const backing = pageConfig?.textTreatment
      ? pageConfig.textTreatment === "soft"
      : draft.typography.backing;
    if (backing && layout === "panorama") {
      const gradient = ctx.createLinearGradient(
        0,
        y - 12,
        0,
        y + boxHeight + 12,
      );
      gradient.addColorStop(0, "rgba(255,252,243,0)");
      gradient.addColorStop(0.15, "rgba(255,252,243,.92)");
      gradient.addColorStop(0.85, "rgba(255,252,243,.92)");
      gradient.addColorStop(1, "rgba(255,252,243,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(x - 16, y - 12, maxWidth + 32, boxHeight + 24);
    }
    ctx.fillStyle = draft.typography.color;
    ctx.textAlign = draft.typography.align;
    ctx.textBaseline = "top";
    const tx =
      draft.typography.align === "left"
        ? x
        : draft.typography.align === "right"
          ? x + maxWidth
          : x + maxWidth / 2;
    lines.forEach((line, i) => ctx.fillText(line, tx, y + 16 + i * lineHeight));
  });
  return { overflow };
}
export default function WorkbenchCanvas({
  draft,
  page,
  onStatus,
  hideText = false,
}: {
  draft: CustomWorkbenchDraft;
  page: number;
  hideText?: boolean;
  onStatus?: (error: string) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [warning, setWarning] = useState("");
  useEffect(() => {
    let active = true;
    const buffer = document.createElement("canvas");
    drawWorkbench(buffer, draft, page, hideText)
      .then(({ overflow, contentMismatch }) => {
        if (!active || !ref.current) return;
        ref.current.width = buffer.width;
        ref.current.height = buffer.height;
        ref.current.getContext("2d")?.drawImage(buffer, 0, 0);
        const message = contentMismatch
          ? "正文已修改，但图中文字尚未更新；请重新生成后导出。"
          : overflow
            ? "文字超出书页，请缩小字号或精简文案后再导出。"
            : "";
        setWarning(message);
        onStatus?.(message);
      })
      .catch((error) => {
        if (active) {
          setWarning(error.message);
          onStatus?.(error.message);
        }
      });
    return () => {
      active = false;
    };
  }, [draft, page, onStatus, hideText]);
  return (
    <>
      <canvas
        ref={ref}
        role="img"
        aria-label={
          page === 0
            ? `封面：${draft.title}`
            : `第 ${page} 页：${draft.pages[page - 1]?.text}`
        }
        style={{ width: "100%", height: "auto", display: "block" }}
      />
      {warning && <p role="alert">{warning}</p>}
    </>
  );
}
