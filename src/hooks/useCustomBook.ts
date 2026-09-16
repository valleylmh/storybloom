"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import type {
  CustomWorkbenchDraft,
  WorkbenchAsset,
} from "@/lib/custom-workbench";

export type LiveCustomJob = {
  id: string;
  status: "outline" | "review" | "images" | "retryable" | "complete" | "failed";
  cursor: number;
  totalUnits: number;
  attempts: number;
  leaseUntil: string | null;
  error: string | null;
  model: string;
  quotaState: "reserved" | "committed" | "refunded";
  result: CustomWorkbenchDraft;
  updatedAt: string;
};
type Quota = {
  remaining: number;
  credits: number;
  resetsAt: string;
  model: string;
  jobs: Array<
    Pick<LiveCustomJob, "id" | "status"> & {
      created_at: string;
      quota_state: string;
    }
  >;
};
export function useCustomBook(
  onResult: (draft: CustomWorkbenchDraft) => void,
  onMessage: (message: string) => void,
) {
  const { session } = useAuth();
  const [quota, setQuota] = useState<Quota | null>(null);
  const [job, setJob] = useState<LiveCustomJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const resultRef = useRef(onResult);
  resultRef.current = onResult;
  const messageRef = useRef(onMessage);
  messageRef.current = onMessage;
  const epoch = useRef(0);
  const pending = useRef<{ id: string; draft: unknown } | null>(null);
  const active = useRef(false);
  const api = useCallback(
    async (path: string, body?: unknown) => {
      if (!session) throw new Error("请先登录后再生成绘本。");
      const response = await fetch(`/api/custom/${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          ...(body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
        },
        body:
          body === undefined
            ? undefined
            : body instanceof FormData
              ? body
              : JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok)
        throw Object.assign(
          new Error(result.error || "工作台请求失败，请重试。"),
          { status: response.status },
        );
      return result;
    },
    [session],
  );
  const refresh = useCallback(async () => {
    if (!session) return;
    const version = epoch.current;
    const q = await api("jobs");
    if (version === epoch.current) setQuota(q);
    return q as Quota;
  }, [api, session]);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const userId = session?.user.id;
  useEffect(() => {
    epoch.current++;
    setJob(null);
    setQuota(null);
    setError("");
    pending.current = null;
    if (userId) refreshRef.current().catch((e) => setError(e.message));
  }, [userId]);
  function accept(next: LiveCustomJob) {
    setJob(next);
    resultRef.current(next.result);
  }
  async function guarded(action: (version: number) => Promise<void>) {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setError("");
    const version = epoch.current;
    try {
      await action(version);
    } catch (e) {
      if (version === epoch.current) {
        const m = e instanceof Error ? e.message : "操作失败";
        setError(m);
        messageRef.current(m);
      }
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  async function run(initial: LiveCustomJob, version: number, retry = false) {
    let current = initial;
    while (
      version === epoch.current &&
      (current.status === "outline" || current.status === "images" || retry)
    ) {
      const next = await api(`jobs/${current.id}`, {
        action: "advance",
        retry,
      });
      retry = false;
      if (version !== epoch.current) return;
      accept(next);
      if (next.updatedAt === current.updatedAt || next.leaseUntil) {
        messageRef.current(
          "任务正在处理中。可稍后点击“继续任务”，或重新打开工作台恢复。",
        );
        break;
      }
      current = next;
    }
    if (version === epoch.current) await refresh();
  }
  async function prepare(draft: CustomWorkbenchDraft) {
    const clean = structuredClone(draft);
    const cache = new Map<string, WorkbenchAsset>();
    async function asset(
      a?: WorkbenchAsset,
      retainGenerated = false,
    ): Promise<WorkbenchAsset | undefined> {
      if (
        !a ||
        a.origin === "sample" ||
        a.src.startsWith("/sample-books/") ||
        (a.origin === "generated" && !retainGenerated)
      )
        return undefined;
      if (cache.has(a.id)) return cache.get(a.id);
      let storagePath = a.storagePath;
      if (!storagePath) {
        if (!a.src.startsWith("blob:"))
          throw new Error("参考图片已失效，请重新上传。");
        const blob = await (await fetch(a.src)).blob();
        const form = new FormData();
        form.append("file", blob, a.name);
        storagePath = (await api("assets", form)).storagePath;
      }
      const result = { ...a, storagePath, src: "", id: crypto.randomUUID() };
      cache.set(a.id, result);
      return result;
    }
    clean.cover = await asset(clean.cover);
    for (const c of clean.characters) c.asset = await asset(c.asset, true);
    for (let i = 0; i < clean.pages.length; i++)
      clean.pages[i].asset =
        i < clean.pageCount ? await asset(clean.pages[i].asset) : undefined;
    return clean;
  }
  const start = (draft: CustomWorkbenchDraft) =>
    guarded(async (version) => {
      if (
        !draft.title.trim() ||
        !draft.theme.trim() ||
        draft.characters.some((c) => !c.name.trim())
      )
        throw new Error("请先填写绘本标题、主题和人物名字。");
      if (!pending.current)
        pending.current = {
          id: crypto.randomUUID(),
          draft: await prepare(draft),
        };
      if (version !== epoch.current) return;
      let next: LiveCustomJob;
      try {
        next = await api("jobs", pending.current);
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (status && status >= 400 && status < 500) pending.current = null;
        throw error;
      }
      if (version !== epoch.current) return;
      pending.current = null;
      accept(next);
      await run(next, version);
    });
  const resume = (id: string) =>
    guarded(async (version) => {
      const next = await api(`jobs/${id}`);
      if (version !== epoch.current) return;
      accept(next);
      await run(next, version);
    });
  const retry = () =>
    guarded(async (version) => {
      if (job) await run(job, version, true);
    });
  const confirm = (draft: CustomWorkbenchDraft) =>
    guarded(async (version) => {
      if (!job) return;
      const next = await api(`jobs/${job.id}`, {
        action: "confirm",
        pages: draft.pages
          .slice(0, draft.pageCount)
          .map(
            ({
              text,
              scene,
              characters,
              layout,
              textTreatment,
              artDirection,
            }) => ({
              text,
              scene,
              characters,
              layout,
              textTreatment,
              artDirection,
            }),
          ),
      });
      if (version !== epoch.current) return;
      accept(next);
      await run(next, version);
    });
  const cancel = () =>
    guarded(async (version) => {
      if (!job) return;
      const next = await api(`jobs/${job.id}`, { action: "cancel" });
      if (version !== epoch.current) return;
      accept(next);
      await refresh();
    });
  const saveLayout = (draft: CustomWorkbenchDraft) =>
    guarded(async (version) => {
      if (!job) return;
      const next = await api(`jobs/${job.id}`, {
        action: "layout",
        title: draft.title,
        subtitle: draft.subtitle,
        author: draft.author,
        typography: draft.typography,
        pageLayouts: draft.pages
          .slice(0, draft.pageCount)
          .map(({ layout, textTreatment }) => ({ layout, textTreatment })),
        texts: draft.pages.slice(0, draft.pageCount).map((p) => p.text),
      });
      if (version !== epoch.current) return;
      accept(next);
      messageRef.current("文字与排版已保存，不消耗生成机会。");
    });
  const redeem = (code: string) =>
    guarded(async (version) => {
      const data = await api("redeem", { code });
      if (version !== epoch.current) return;
      await refresh();
      messageRef.current(
        data.alreadyRedeemed
          ? "该兑换码已兑换到当前账号，不会重复增加次数。"
          : "兑换成功，已增加 1 次绘本生成机会。",
      );
    });
  return {
    session,
    quota,
    job,
    busy,
    error,
    start,
    resume,
    retry,
    confirm,
    cancel,
    redeem,
    saveLayout,
    refresh,
    clearJob: () => {
      if (!busy) {
        setJob(null);
        pending.current = null;
      }
    },
  };
}
