import { PDFDocument } from "pdf-lib";
import type { CustomWorkbenchDraft } from "@/lib/custom-workbench";
import { drawWorkbench } from "@/components/custom/WorkbenchCanvas";

import { pdfPageNumbers } from "./reader";
export { pdfPageNumbers } from "./reader";
export async function exportCustomBookPdf(
  draft: CustomWorkbenchDraft,
  onProgress?: (value: string) => void,
) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(draft.title);
  pdf.setAuthor(draft.author || "StoryBloom");
  pdf.setCreator("StoryBloom 绘本定制工作台");
  const pages = pdfPageNumbers(draft);
  await document.fonts.ready;
  for (const [i, number] of pages.entries()) {
    onProgress?.(`正在排版 ${i + 1} / ${pages.length}`);
    const canvas = document.createElement("canvas");
    const { overflow, contentMismatch } = await drawWorkbench(
      canvas,
      draft,
      number,
    );
    if (contentMismatch)
      throw new Error("正文与图中文字不一致，请重新生成后下载 PDF。");
    if (overflow)
      throw new Error(
        `${number === 0 ? "封面" : `第 ${number} 页`}文字超出书页，请调整后再下载 PDF。`,
      );
    const jpg = canvas.toDataURL("image/jpeg", 0.98);
    const image = await pdf.embedJpg(jpg);
    const height = 595.28;
    const width = (height * canvas.width) / canvas.height;
    const page = pdf.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });
  }
  return new Blob([new Uint8Array(await pdf.save())], {
    type: "application/pdf",
  });
}
