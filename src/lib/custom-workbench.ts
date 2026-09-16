import {
  normalizeFamilyImageCrop,
  type FamilyImageCrop,
} from "./family-image-crop";

export type WorkbenchAsset = {
  embeddedText?: string[];
  storagePath?: string;
  origin?: "sample" | "uploaded" | "generated";
  id: string;
  name: string;
  src: string;
  purpose: "character" | "cover" | "page";
  crop: FamilyImageCrop;
  ratio: "page" | "square" | "portrait" | "landscape";
  appearance: "original" | "anime";
  anthropomorphic: boolean;
  retouch: string[];
  instructions: string;
};
export type WorkbenchCharacter = {
  storagePath?: string;
  origin?: "sample" | "uploaded" | "generated";
  id: string;
  name: string;
  role: string;
  appearance: string;
  personality: string;
  outfit: string;
  asset?: WorkbenchAsset;
};
export type WorkbenchPage = {
  artDirection?: string;
  layout?: import("./custom-book/layout").BookLayout;
  textTreatment?: "natural" | "soft";
  text: string;
  scene: string;
  characters: string[];
  asset?: WorkbenchAsset;
};
export type CustomWorkbenchDraft = {
  version: 1;
  renderingMode?: "integrated" | "editable";
  title: string;
  subtitle: string;
  author: string;
  theme: string;
  age: string;
  language: string;
  pageCount: number;
  story: string;
  characters: WorkbenchCharacter[];
  pages: WorkbenchPage[];
  cover?: WorkbenchAsset;
  spreads: number[];
  style: "watercolor" | "cartoon" | "fairytale";
  format: "square" | "portrait" | "landscape";
  typography: {
    size: number;
    position: "top" | "middle" | "bottom";
    color: string;
    align: "left" | "center" | "right";
    backing: boolean;
    background: string;
  };
};
export const SAMPLE_LINES = [
  "小满在窗边看见一朵小云，它轻轻敲了敲玻璃。",
  "小云说：“山那边有一座彩虹桥，可我不敢飞过去。”",
  "小满把红围巾系在小云身上，像给它一个暖暖的拥抱。",
  "他们先飞过屋顶，再飞过会唱歌的风铃树。",
  "一阵大风吹来，小云缩成小小一团。",
  "小满说：“害怕的时候，我们可以慢慢飞。”",
  "小云一点点展开，终于看见彩虹桥在阳光里发亮。",
  "晚上，小云把一颗彩虹星送到小满枕边。",
];
export function makeAsset(
  src: string,
  name: string,
  purpose: WorkbenchAsset["purpose"],
): WorkbenchAsset {
  return {
    id: src,
    src,
    name,
    purpose,
    origin: src.startsWith("/sample-books/") ? "sample" : "uploaded",
    crop: normalizeFamilyImageCrop(null),
    ratio: "page",
    appearance: "original",
    anthropomorphic: false,
    retouch: [],
    instructions: "",
  };
}
export function createWorkbenchDraft(sample = true): CustomWorkbenchDraft {
  return {
    version: 1,
    renderingMode: "integrated",
    title: sample ? "小云朵勇敢飞" : "",
    subtitle: sample ? "给每一次勇敢出发的你" : "",
    author: "",
    theme: "勇气与成长",
    age: "4–5 岁",
    language: "中文",
    pageCount: 8,
    story: sample ? SAMPLE_LINES.join("\n") : "",
    characters: [
      {
        id: "hero",
        name: sample ? "小满" : "",
        role: "主角",
        appearance: "",
        personality: sample ? "温柔、勇敢、好奇" : "",
        outfit: sample ? "红围巾" : "",
      },
    ],
    pages: Array.from({ length: 12 }, (_, i) => ({
      text: sample ? SAMPLE_LINES[i] || "" : "",
      scene: sample && i < 8 ? `第 ${i + 1} 幕：${SAMPLE_LINES[i]}` : "",
      characters: ["hero"],
      ...(sample && i < 8
        ? {
            asset: makeAsset(
              `/sample-books/gpt-image-2/brave-cloud/${i + 1}.webp`,
              `公开示例 ${i + 1}`,
              "page",
            ),
          }
        : {}),
    })),
    cover: sample
      ? makeAsset(
          "/sample-books/gpt-image-2/brave-cloud/1.webp",
          "公开示例封面",
          "cover",
        )
      : undefined,
    spreads: [],
    style: "watercolor",
    format: "square",
    typography: {
      size: 28,
      position: "bottom",
      color: "#343b32",
      align: "left",
      backing: true,
      background: "#f7f0df",
    },
  };
}
export function setWorkbenchPageCount(
  draft: CustomWorkbenchDraft,
  count: number,
): CustomWorkbenchDraft {
  return {
    ...draft,
    pageCount: Math.min(
      12,
      Math.max(4, Math.round(Number.isFinite(count) ? count : 8)),
    ),
  };
}
export function spreadStart(
  draft: CustomWorkbenchDraft,
  page: number,
): number | null {
  const start = page % 2 === 0 ? page : page - 1;
  return page > 1 &&
    start + 1 <= draft.pageCount &&
    draft.spreads.includes(start)
    ? start
    : null;
}
export function toggleWorkbenchSpread(
  draft: CustomWorkbenchDraft,
  start: number,
): CustomWorkbenchDraft {
  if (start < 2 || start % 2 !== 0 || start + 1 > draft.pageCount) return draft;
  return {
    ...draft,
    spreads: draft.spreads.includes(start)
      ? draft.spreads.filter((p) => p !== start)
      : [...draft.spreads, start],
  };
}
export function nextWeeklyReset(now = new Date()): string {
  const shifted = new Date(now.getTime() + 8 * 3600_000);
  const days = (8 - shifted.getUTCDay()) % 7 || 7;
  shifted.setUTCDate(shifted.getUTCDate() + days);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - 8 * 3600_000).toISOString();
}
export function serializeWorkbench(draft: CustomWorkbenchDraft): string {
  return JSON.stringify(
    draft,
    (key, value) =>
      key === "src" ||
      (key === "id" &&
        typeof value === "string" &&
        /^(blob:|data:)/.test(value))
        ? undefined
        : value,
    2,
  );
}
