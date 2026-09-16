import { z } from "zod";

const asset = z.object({
  embeddedText: z.array(z.string().max(2500)).max(3).optional(),
  id: z.string().max(200),
  name: z.string().max(200),
  purpose: z.enum(["character", "cover", "page"]),
  storagePath: z.string().max(300),
  crop: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    zoom: z.number().min(1).max(2),
  }),
  ratio: z.enum(["page", "square", "portrait", "landscape"]),
  appearance: z.enum(["original", "anime"]),
  anthropomorphic: z.boolean(),
  retouch: z
    .array(z.enum(["去背景", "去除杂物", "调整明暗", "修复瑕疵"]))
    .max(4),
  instructions: z.string().max(1000),
  origin: z.enum(["uploaded", "generated"]).optional(),
});
export const customPageSchema = z.object({
  artDirection: z.string().max(1800).optional(),
  layout: z.enum(["panorama", "sidebar", "embrace", "minimal"]).optional(),
  textTreatment: z.enum(["natural", "soft"]).optional(),
  text: z.string().max(2500),
  scene: z.string().max(2500),
  characters: z.array(z.string().max(80)).max(6),
  asset: asset.optional(),
});
export const customDraftSchema = z
  .object({
    version: z.literal(1),
    renderingMode: z.enum(["integrated", "editable"]).optional(),
    title: z.string().trim().min(1).max(100),
    subtitle: z.string().max(200),
    author: z.string().max(100),
    theme: z.string().trim().min(1).max(300),
    age: z.enum(["2–3 岁", "4–5 岁", "6–8 岁"]),
    language: z.enum(["中文", "英文", "中英双语"]),
    pageCount: z.number().int().min(4).max(12),
    story: z.string().max(15000),
    characters: z
      .array(
        z.object({
          id: z.string().min(1).max(80),
          name: z.string().trim().min(1).max(40),
          role: z.string().max(100),
          appearance: z.string().max(1000),
          personality: z.string().max(500),
          outfit: z.string().max(500),
          asset: asset.optional(),
        }),
      )
      .min(1)
      .max(6),
    pages: z.array(customPageSchema).length(12),
    cover: asset.optional(),
    spreads: z.array(z.number().int().min(2).max(10)).max(5),
    style: z.enum(["watercolor", "cartoon", "fairytale"]),
    format: z.enum(["square", "portrait", "landscape"]),
    typography: z.object({
      size: z.number().min(18).max(60),
      position: z.enum(["top", "middle", "bottom"]),
      color: z.string().regex(/^#[0-9a-f]{6}$/i),
      align: z.enum(["left", "center", "right"]),
      backing: z.boolean(),
      background: z.string().regex(/^#[0-9a-f]{6}$/i),
    }),
  })
  .superRefine((draft, ctx) => {
    const ids = new Set(draft.characters.map((c) => c.id));
    if (ids.size !== draft.characters.length)
      ctx.addIssue({ code: "custom", message: "人物标识重复" });
    if (
      draft.spreads.some((n) => n % 2 !== 0) ||
      new Set(draft.spreads).size !== draft.spreads.length
    )
      ctx.addIssue({ code: "custom", message: "跨页配置无效" });
    if (draft.pages.some((p) => p.characters.some((id) => !ids.has(id))))
      ctx.addIssue({ code: "custom", message: "页面引用的人物不存在" });
  });
export type ServerDraft = z.infer<typeof customDraftSchema>;
export type ServerAsset = z.infer<typeof asset>;
export type CustomBookJob = {
  id: string;
  user_id: string;
  input: ServerDraft;
  result: ServerDraft;
  status: "outline" | "review" | "images" | "retryable" | "complete" | "failed";
  resume_status: string;
  cursor: number;
  attempts: number;
  lease_id: string | null;
  lease_until: string | null;
  error: string | null;
  model: string;
  quota_source: "weekly" | "paid";
  quota_state: "reserved" | "committed" | "refunded";
  created_at: string;
  updated_at: string;
};
export function allAssets(draft: ServerDraft) {
  return [
    ...draft.characters.map((c) => c.asset),
    draft.cover,
    ...draft.pages.slice(0, draft.pageCount).map((p) => p.asset),
  ].filter((a): a is ServerAsset => !!a);
}
export function assertOwnedAssets(draft: ServerDraft, userId: string) {
  for (const a of allAssets(draft))
    if (
      !new RegExp(
        `^${userId}/(?:inputs/[a-f0-9-]+|jobs/[a-f0-9-]+/[a-z0-9-]+)\\.(?:jpg|png|webp)$`,
      ).test(a.storagePath)
    )
      throw new Error("图片不属于当前账号，请重新上传。");
}
export type ImageUnit =
  | { kind: "character"; index: number }
  | { kind: "cover" }
  | { kind: "page"; index: number; spread: boolean };
export function imageUnits(draft: ServerDraft): ImageUnit[] {
  const units: ImageUnit[] = draft.characters.map((_, index) => ({
    kind: "character",
    index,
  }));
  units.push({ kind: "cover" });
  for (let page = 1; page <= draft.pageCount; page++) {
    const spread =
      draft.spreads.includes(page) &&
      page % 2 === 0 &&
      page + 1 <= draft.pageCount;
    units.push({ kind: "page", index: page - 1, spread });
    if (spread) page++;
  }
  return units;
}
