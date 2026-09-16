import { artworkMatchesText, artworkText } from "./integrated";
import "server-only";
import crypto from "node:crypto";
import { getSupabaseAdmin } from "@/lib/email/supabase-admin";
import {
  allAssets,
  assertOwnedAssets,
  imageUnits,
  type CustomBookJob,
  type ServerDraft,
  type ServerAsset,
} from "./schema";
import {
  cropReference,
  customImageConfig,
  generateCustomOutline,
  imagePrompt,
  imageSize,
  needsProcessing,
  requestCustomImage,
  type Reference,
} from "./provider";

export const CUSTOM_BUCKET = "custom-books";
function databaseError(error: { message?: string } | null) {
  if (error) throw new Error(error.message || "DATABASE_UNAVAILABLE");
}
export async function getCustomJob(
  userId: string,
  id: string,
): Promise<CustomBookJob> {
  const { data, error } = await getSupabaseAdmin()
    .from("custom_book_jobs")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  databaseError(error);
  if (!data) throw new Error("NOT_FOUND");
  return data as CustomBookJob;
}
export async function reserveCustomJob(
  userId: string,
  id: string,
  draft: ServerDraft,
) {
  assertOwnedAssets(draft, userId);
  const config = customImageConfig();
  // Verify each supplied path before spending a quota opportunity. No client URLs are fetched.
  for (const a of allAssets(draft)) await readImage(a.storagePath);
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(draft))
    .digest("hex");
  const { data, error } = await getSupabaseAdmin().rpc("custom_book_reserve", {
    p_user: userId,
    p_id: id,
    p_hash: hash,
    p_draft: draft,
    p_model: config.model,
  });
  databaseError(error);
  return data as CustomBookJob;
}
export async function customQuota(userId: string) {
  const db = getSupabaseAdmin();
  const { data: usage, error } = await db
    .from("custom_book_usage")
    .select("week_start,reserved,used")
    .eq("user_id", userId)
    .order("week_start", { ascending: false })
    .limit(1);
  databaseError(error);
  const { data: credit, error: ce } = await db
    .from("custom_book_credits")
    .select("available")
    .eq("user_id", userId)
    .maybeSingle();
  databaseError(ce);
  const { data: jobs, error: je } = await db
    .from("custom_book_jobs")
    .select("id,status,created_at,updated_at,quota_state,lease_until,error")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  databaseError(je);
  const now = new Date();
  const local = new Date(now.getTime() + 8 * 3600000);
  local.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
  local.setUTCHours(0, 0, 0, 0);
  const start = new Date(local.getTime() - 8 * 3600000);
  const week =
    usage?.[0] && new Date(usage[0].week_start).getTime() === start.getTime()
      ? usage[0]
      : null;
  return {
    remaining: week ? Math.max(0, 1 - week.reserved - week.used) : 1,
    credits: credit?.available || 0,
    resetsAt: new Date(start.getTime() + 7 * 86400000).toISOString(),
    jobs: jobs || [],
    model: customImageConfig().model,
  };
}
export async function publicCustomJob(job: CustomBookJob) {
  const result = structuredClone(job.result);
  const cache = new Map<string, string>();
  for (const a of allAssets(result)) {
    let src = cache.get(a.storagePath);
    if (!src) {
      const { data, error } = await getSupabaseAdmin()
        .storage.from(CUSTOM_BUCKET)
        .createSignedUrl(a.storagePath, 3600);
      databaseError(error);
      src = data!.signedUrl;
      cache.set(a.storagePath, src);
    }
    Object.assign(a, { src });
  }
  return {
    id: job.id,
    status: job.status,
    cursor: job.cursor,
    totalUnits: imageUnits(job.result).length,
    attempts: job.attempts,
    error: job.error,
    model: job.model,
    quotaSource: job.quota_source,
    quotaState: job.quota_state,
    leaseUntil: job.lease_until,
    result,
    updatedAt: job.updated_at,
  };
}
async function readImage(path: string) {
  const { data, error } = await getSupabaseAdmin()
    .storage.from(CUSTOM_BUCKET)
    .download(path);
  databaseError(error);
  if (!data) throw new Error("参考图片已失效，请重新上传。");
  if (data.size > 20 * 1024 * 1024) throw new Error("图片过大。");
  return Buffer.from(await data.arrayBuffer());
}
async function finish(
  job: CustomBookJob,
  lease: string,
  result: ServerDraft,
  status: string,
  cursor: number,
  error?: string,
) {
  const { data, error: failure } = await getSupabaseAdmin().rpc(
    "custom_book_finish",
    {
      p_user: job.user_id,
      p_id: job.id,
      p_lease: lease,
      p_result: result,
      p_status: status,
      p_cursor: cursor,
      p_error: error || null,
    },
  );
  databaseError(failure);
  return data as CustomBookJob;
}
function generatedAsset(
  path: string,
  purpose: ServerAsset["purpose"],
): ServerAsset {
  return {
    id: crypto.randomUUID(),
    name: "GPT 生成插图",
    purpose,
    storagePath: path,
    crop: { x: 50, y: 50, zoom: 1 },
    ratio: "page",
    appearance: "original",
    anthropomorphic: false,
    retouch: [],
    instructions: "",
    origin: "generated",
  };
}
export async function advanceCustomJob(
  userId: string,
  id: string,
  retry = false,
): Promise<CustomBookJob> {
  const lease = crypto.randomUUID();
  const db = getSupabaseAdmin();
  const { data, error } = await db.rpc("custom_book_claim", {
    p_user: userId,
    p_id: id,
    p_lease: lease,
    p_retry: retry,
  });
  databaseError(error);
  if (!data) return getCustomJob(userId, id);
  const job = data as CustomBookJob;
  const result = structuredClone(job.result);
  try {
    if (job.attempts > 3)
      return finish(
        job,
        lease,
        result,
        "failed",
        job.cursor,
        "任务多次中断，机会已退还。",
      );
    if (job.status === "outline")
      return finish(
        job,
        lease,
        await generateCustomOutline(result),
        "review",
        0,
      );
    const units = imageUnits(result);
    const unit = units[job.cursor];
    if (!unit) return finish(job, lease, result, "complete", job.cursor);
    const original =
      unit.kind === "character"
        ? result.characters[unit.index].asset
        : unit.kind === "cover"
          ? result.cover
          : result.pages[unit.index].asset;
    let output: ServerAsset;
    if (
      original &&
      !needsProcessing(original) &&
      !(result.renderingMode === "integrated" && unit.kind !== "character")
    ) {
      output = original;
    } else {
      const path = `${userId}/jobs/${id}/unit-${job.cursor}.jpg`;
      // If publication failed after upload, recover the exact durable image before another AI call.
      const existing = await db.storage.from(CUSTOM_BUCKET).download(path);
      if (
        existing.error &&
        !/not found|does not exist|404/i.test(existing.error.message)
      )
        throw new Error("暂时无法确认图片保存状态，请稍后重试。");
      if (!existing.data) {
        const refs: Reference[] = [];
        const ratio =
          unit.kind === "page" && unit.spread
            ? result.format === "portrait"
              ? 1.6
              : result.format === "landscape"
                ? 8 / 3
                : 2
            : result.format === "portrait"
              ? 0.8
              : result.format === "landscape"
                ? 4 / 3
                : 1;
        if (original)
          refs.push({
            bytes: await cropReference(
              await readImage(original.storagePath),
              original,
              ratio,
            ),
            label:
              "Source illustration to edit; follow its processing instructions.",
          });
        if (unit.kind !== "character") {
          const cast =
            unit.kind === "cover"
              ? result.characters.map((c) => c.id)
              : result.pages
                  .slice(unit.index, unit.index + (unit.spread ? 2 : 1))
                  .flatMap((p) => p.characters);
          for (const c of result.characters.filter((c) => cast.includes(c.id)))
            if (c.asset)
              refs.push({
                bytes: await cropReference(
                  await readImage(c.asset.storagePath),
                  c.asset,
                  1,
                ),
                label: `Character ${c.id}: ${c.name}. Appearance: ${c.appearance}. Outfit: ${c.outfit}. Preserve this identity.`,
              });
        }
        if (
          unit.kind === "page" &&
          result.renderingMode === "integrated" &&
          result.cover
        ) {
          refs.push({
            bytes: await readImage(result.cover.storagePath),
            label:
              "Approved book cover: visual style and character consistency reference only. Never repeat its title on an interior page.",
          });
        }
        const bytes = await requestCustomImage(
          imagePrompt(result, unit),
          refs,
          imageSize(result, unit),
          job.model,
        );
        const upload = await db.storage
          .from(CUSTOM_BUCKET)
          .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
        if (
          upload.error &&
          !/already exists|duplicate/i.test(upload.error.message)
        )
          throw new Error("插图保存失败，请重试恢复任务。");
      }
      output = generatedAsset(
        path,
        unit.kind === "character"
          ? "character"
          : unit.kind === "cover"
            ? "cover"
            : "page",
      );
    }
    if (result.renderingMode === "integrated" && unit.kind !== "character") {
      output.embeddedText =
        unit.kind === "cover"
          ? [result.title, result.subtitle, result.author]
          : result.pages
              .slice(unit.index, unit.index + (unit.spread ? 2 : 1))
              .map((p) => p.text);
    }
    if (unit.kind === "character") result.characters[unit.index].asset = output;
    else if (unit.kind === "cover") result.cover = output;
    else result.pages[unit.index].asset = output;
    const next = job.cursor + 1;
    return finish(
      job,
      lease,
      result,
      next >= units.length ? "complete" : "images",
      next,
    );
  } catch (error) {
    const safe =
      error instanceof Error &&
      /^(GPT|故事|参考图片|图片|插图|暂时无法)/.test(error.message)
        ? error.message
        : "生成暂时失败，已保留完成的内容，请重试。";
    return finish(job, lease, result, "retryable", job.cursor, safe);
  }
}
export async function confirmCustomOutline(
  userId: string,
  id: string,
  pages: Array<{ text: string; scene: string; characters: string[] }>,
) {
  const job = await getCustomJob(userId, id);
  if (pages.length !== job.result.pageCount)
    throw new Error("分镜页数与任务不一致。");
  const ids = new Set(job.result.characters.map((c) => c.id));
  if (
    pages.some(
      (p) =>
        !p.text.trim() ||
        !p.scene.trim() ||
        p.characters.some((id) => !ids.has(id)),
    )
  )
    throw new Error("请填写每页正文、画面描述并选择有效人物。");
  const next = job.result.pages.map((p, i) =>
    i < pages.length ? { ...p, ...pages[i] } : p,
  );
  const { data, error } = await getSupabaseAdmin().rpc("custom_book_confirm", {
    p_user: userId,
    p_id: id,
    p_pages: next,
  });
  databaseError(error);
  return data as CustomBookJob;
}
export async function cancelCustomJob(userId: string, id: string) {
  const job = await getCustomJob(userId, id);
  if (job.quota_state !== "reserved") return job;
  if (job.lease_until && new Date(job.lease_until).getTime() > Date.now())
    throw new Error("任务正在生成，请等待当前步骤结束后取消。");
  // CAS lease acquisition also allows review cancellation; row identity prevents racing generation.
  const lease = crypto.randomUUID();
  const { data, error } = await getSupabaseAdmin()
    .from("custom_book_jobs")
    .update({
      lease_id: lease,
      lease_until: new Date(Date.now() + 300000).toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("quota_state", "reserved")
    .eq("updated_at", job.updated_at)
    .select("id");
  databaseError(error);
  if (!data?.length) throw new Error("任务状态已更新，请重试。");
  const unused = job.status === "outline" && job.attempts === 0;
  return finish(
    job,
    lease,
    job.result,
    unused ? "failed" : "cancelled",
    job.cursor,
    unused
      ? "任务已取消，生成机会已退还。"
      : "任务已取消。AI 已开始工作，本次机会已使用。",
  );
}

/** Text/layout corrections are free; this route cannot change generation inputs or image ownership. */
export async function saveCustomLayout(
  userId: string,
  id: string,
  layout: {
    title: string;
    subtitle: string;
    author: string;
    typography: ServerDraft["typography"];
    texts: string[];
    pageLayouts?: Array<
      Pick<ServerDraft["pages"][number], "layout" | "textTreatment">
    >;
  },
) {
  const job = await getCustomJob(userId, id);
  if (job.status !== "complete")
    throw new Error("任务状态尚未完成，暂不能保存成品排版。");
  if (
    layout.texts.length !== job.result.pageCount ||
    (layout.pageLayouts && layout.pageLayouts.length !== job.result.pageCount)
  )
    throw new Error("分镜页数与任务不一致。");
  const proposed = {
    ...job.result,
    ...layout,
    pages: job.result.pages.map((p, i) => ({
      ...p,
      text: layout.texts[i] ?? p.text,
    })),
  };
  for (const unit of imageUnits(job.result)) {
    if (unit.kind === "character") continue;
    const page = unit.kind === "cover" ? 0 : unit.index + 1;
    const asset =
      page === 0 ? job.result.cover : job.result.pages[page - 1].asset;
    if (
      asset?.embeddedText &&
      !artworkMatchesText(asset.embeddedText, artworkText(proposed, page))
    )
      throw new Error(
        "正文已融入插画，修改文字需要新的生成操作；不能将文字修改保存为已更新的成品。",
      );
  }
  const result = {
    ...job.result,
    title: layout.title,
    subtitle: layout.subtitle,
    author: layout.author,
    typography: layout.typography,
    pages: job.result.pages.map((p, i) =>
      i < layout.texts.length
        ? { ...p, ...layout.pageLayouts?.[i], text: layout.texts[i] }
        : p,
    ),
  };
  const { data, error } = await getSupabaseAdmin()
    .from("custom_book_jobs")
    .update({ result, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "complete")
    .eq("updated_at", job.updated_at)
    .select("*")
    .maybeSingle();
  databaseError(error);
  if (!data) throw new Error("任务状态已更新，请重新打开后保存。");
  return data as CustomBookJob;
}
