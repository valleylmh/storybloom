"use client";
import Link from "next/link";
import integratedSample from "../../../public/sample-books/integrated-garden/draft.json";
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  createWorkbenchDraft,
  makeAsset,
  nextWeeklyReset,
  serializeWorkbench,
  setWorkbenchPageCount,
  spreadStart,
  toggleWorkbenchSpread,
  type CustomWorkbenchDraft,
  type WorkbenchAsset,
  type WorkbenchCharacter,
} from "@/lib/custom-workbench";
import { normalizeFamilyImageCrop } from "@/lib/family-image-crop";
import WorkbenchCanvas from "./WorkbenchCanvas";
import WorkbenchBook, { ImmersiveWorkbenchReader } from "./WorkbenchBook";
import { useCustomBook } from "@/hooks/useCustomBook";
import { exportCustomBookPdf } from "@/lib/custom-book/pdf";
import s from "./CustomWorkbench.module.css";
import { BOOK_LAYOUTS, type BookLayout } from "@/lib/custom-book/layout";

const steps = ["基础信息", "人物与素材", "故事分镜", "画风排版", "确认生成"];
const styles = {
  watercolor: "温柔水彩",
  cartoon: "趣味卡通",
  fairytale: "梦幻童话",
};
type AssetTarget =
  | { kind: "cover" }
  | { kind: "page"; index: number }
  | { kind: "character"; id: string };
function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  let bound = false;
  const fields = Children.map(children, (child) => {
    if (
      !bound &&
      isValidElement(child) &&
      ["input", "select", "textarea"].includes(String(child.type))
    ) {
      bound = true;
      return cloneElement(child as ReactElement<{ id?: string }>, { id });
    }
    return child;
  });
  return (
    <div className={s.field}>
      {bound ? <label htmlFor={id}>{label}</label> : <span>{label}</span>}
      {fields}
    </div>
  );
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={s.dialog}
      onCancel={onClose}
    >
      <header>
        <h2 id={titleId}>{title}</h2>
        <button onClick={onClose} aria-label="关闭弹窗">
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
export default function CustomWorkbench() {
  const [draft, setDraft] = useState(() => createWorkbenchDraft());
  const [step, setStep] = useState(0);
  const [page, setPage] = useState(0);
  const [mobile, setMobile] = useState("config");
  const [modal, setModal] = useState<"read" | "pay" | "reset" | null>(null);
  const [editing, setEditing] = useState<{
    target: AssetTarget;
    asset: WorkbenchAsset;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [proofread, setProofread] = useState(false);
  useEffect(() => setProofread(false), [draft]);
  const hasEmbeddedArtwork =
    !!draft.cover?.embeddedText ||
    draft.pages.slice(0, draft.pageCount).some((p) => p.asset?.embeddedText);
  const [resetDate, setResetDate] = useState("");
  const urls = useRef(new Set<string>());
  const [redeemCode, setRedeemCode] = useState("");
  const live = useCustomBook((result) => {
    setDraft(result);
    setDirty(false);
  }, setMessage);
  const activeJob = live.job?.quotaState === "reserved";
  useEffect(() => {
    if (live.job?.status === "review") setStep(2);
  }, [live.job?.status]);
  useEffect(() => {
    setResetDate(
      new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(nextWeeklyReset())),
    );
    return () => {
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function update(fn: (d: CustomWorkbenchDraft) => CustomWorkbenchDraft) {
    if (live.busy || (activeJob && live.job?.status !== "review")) {
      setMessage("生成期间配置已锁定；完成后可以继续调整文字与排版。");
      return;
    }
    setDraft(fn);
    setDirty(true);
  }
  function patch(value: Partial<CustomWorkbenchDraft>) {
    update((d) => ({ ...d, ...value }));
  }
  function characterPatch(id: string, value: Partial<WorkbenchCharacter>) {
    update((d) => ({
      ...d,
      characters: d.characters.map((c) =>
        c.id === id ? { ...c, ...value } : c,
      ),
    }));
  }
  function pagePatch(
    index: number,
    value: Partial<CustomWorkbenchDraft["pages"][number]>,
  ) {
    update((d) => ({
      ...d,
      pages: d.pages.map((p, i) => (i === index ? { ...p, ...value } : p)),
    }));
  }
  function saveAsset(target: AssetTarget, asset?: WorkbenchAsset) {
    if (target.kind === "cover") patch({ cover: asset });
    else if (target.kind === "character") characterPatch(target.id, { asset });
    else pagePatch(target.index, { asset });
  }
  async function upload(file: File | undefined, target: AssetTarget) {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 15 * 1024 * 1024
    ) {
      setMessage("请选择 15 MB 以内的 JPG、PNG 或 WebP 图片。");
      return;
    }
    const src = URL.createObjectURL(file);
    urls.current.add(src);
    const img = new Image();
    img.src = src;
    try {
      await img.decode();
      setEditing({ target, asset: makeAsset(src, file.name, target.kind) });
    } catch {
      URL.revokeObjectURL(src);
      urls.current.delete(src);
      setMessage("无法读取这张图片，请选择其他图片。");
    }
  }
  function assetControl(target: AssetTarget, asset?: WorkbenchAsset) {
    return (
      <fieldset className={s.assetRow} disabled={activeJob || live.busy}>
        {asset ? (
          <img src={asset.src} alt={asset.name} />
        ) : (
          <span className={s.uploadIllustration} aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            >
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <circle cx="8" cy="8" r="1.5" />
              <path d="m3 17 5-5 4 4 4-6 5 7" />
            </svg>
          </span>
        )}
        <div className={s.assetContent}>
          <strong className={s.assetTitle}>
            {target.kind === "character"
              ? "人物参考照片"
              : target.kind === "cover"
                ? "封面插画"
                : "内页插画"}
          </strong>
          <div className={s.assetActions}>
            <label className={s.upload}>
              <span aria-hidden="true">＋</span>{" "}
              {asset ? "更换图片" : "选择图片"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-label={`${target.kind === "character" ? "人物参考" : target.kind === "cover" ? "封面" : "内页"}图片`}
                onChange={(e) => {
                  void upload(e.target.files?.[0], target);
                  e.target.value = "";
                }}
              />
            </label>
            {asset && (
              <>
                <button
                  disabled={!!asset.embeddedText}
                  title={
                    asset.embeddedText
                      ? "图文一体成品保留完整画面，修改需要重新生成"
                      : undefined
                  }
                  onClick={() =>
                    setEditing({ target, asset: structuredClone(asset) })
                  }
                >
                  处理 / 裁剪
                </button>
                <button onClick={() => saveAsset(target)}>移除</button>
              </>
            )}
          </div>
          <small>{asset ? asset.name : "JPG / PNG / WebP · 最大 15 MB"}</small>
        </div>
      </fieldset>
    );
  }
  const activePage = Math.max(1, page);
  const current = draft.pages[activePage - 1];
  const spread = spreadStart(draft, page);
  const imageIndex = (spread || activePage) - 1;
  function navigate(next: number) {
    setPage(Math.min(draft.pageCount, Math.max(0, next)));
  }
  async function exportPdf() {
    if (hasEmbeddedArtwork && !proofread) {
      setMessage("请先逐页核对图中文字和人物，再确认校对并下载。");
      return;
    }
    setExporting(true);
    try {
      const blob = await exportCustomBookPdf(draft, setMessage);
      download(blob, `${draft.title || "我的绘本"}.pdf`);
      setMessage("整本 PDF 已下载，包含封面、全部内页和连续跨页。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "PDF 导出失败");
    } finally {
      setExporting(false);
    }
  }
  return (
    <main className={s.workbench}>
      <header className={s.topbar}>
        <Link href="/" className={s.brand}>
          ✳{" "}
          <span>
            StoryBloom<small>让每个故事，都有你的名字</small>
          </span>
        </Link>
        <div className={s.topActions}>
          <span className={s.quota}>
            {!live.session
              ? "登录后每周免费 1 本"
              : live.quota
                ? `本周免费 ${live.quota.remaining} 本 · 兑换机会 ${live.quota.credits} 本`
                : "正在读取账号额度"}
            <small>{resetDate || "每周一 00:00"} 重置（北京时间）</small>
          </span>
          <button
            onClick={() => {
              download(
                new Blob([serializeWorkbench(draft)], {
                  type: "application/json",
                }),
                "绘本配置.json",
              );
              setMessage(
                "已导出 JSON 配置，不包含图片文件；请另外保存原图。本地图片离开页面后需重新上传。",
              );
            }}
          >
            导出配置 ↗
          </button>
        </div>
      </header>
      <section className={s.heading}>
        <div>
          <span className={s.eyebrow}>YOUR LITTLE BOOK STUDIO</span>
          <h1>
            绘本定制工作台 <em>GPT Image 2</em>
          </h1>
          <p>从一个小小的想法，开始一本属于你的绘本。</p>
        </div>
        <button
          disabled={live.busy || activeJob}
          onClick={() => setModal("reset")}
        >
          新建 / 载入示例
        </button>
      </section>
      <div className={s.mobileTabs}>
        <button
          aria-pressed={mobile === "config"}
          onClick={() => setMobile("config")}
        >
          配置绘本
        </button>
        <button
          aria-pressed={mobile === "preview"}
          onClick={() => setMobile("preview")}
        >
          查看预览
        </button>
      </div>
      <div className={s.workspace}>
        <section
          className={`${s.editor} ${mobile !== "config" ? s.mobileHidden : ""}`}
          aria-label="绘本配置"
        >
          <nav className={s.steps} aria-label="定制步骤">
            {steps.map((label, i) => (
              <button
                key={label}
                aria-current={step === i ? "step" : undefined}
                onClick={() => {
                  setStep(i);
                  if (i === 2 && page === 0) setPage(1);
                }}
              >
                <b>{i + 1}</b>
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className={s.panel}>
            <div className={s.panelTitle}>
              <span>STEP 0{step + 1}</span>
              <h2>{steps[step]}</h2>
              <p>
                {
                  [
                    "先给这本书一个名字，故事就从这里开始。",
                    "让孩子、家人，或一只小猫成为故事主角。",
                    "把故事拆成一页一页，留下你想说的话。",
                    "让画面与文字，一起讲述你的故事。",
                    "检查创作设定，再开始这一趟旅程。",
                  ][step]
                }
              </p>
            </div>
            <fieldset
              className={s.controls}
              disabled={
                live.busy ||
                !!(activeJob && (live.job?.status !== "review" || step !== 2))
              }
            >
              {step === 0 && (
                <>
                  <Field label="绘本标题">
                    <input
                      value={draft.title}
                      placeholder="给你的绘本起个名字"
                      onChange={(e) => patch({ title: e.target.value })}
                    />
                  </Field>
                  <Field label="故事主题">
                    <div className={s.chips}>
                      {[
                        "勇气与成长",
                        "亲情与陪伴",
                        "友谊与分享",
                        "自然与探索",
                      ].map((t) => (
                        <button
                          key={t}
                          aria-pressed={draft.theme === t}
                          onClick={() => patch({ theme: t })}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <input
                      aria-label="自定义主题"
                      value={draft.theme}
                      onChange={(e) => patch({ theme: e.target.value })}
                      placeholder="也可以输入自己的主题"
                    />
                  </Field>
                  <div className={s.two}>
                    <Field label="适读年龄">
                      <select
                        value={draft.age}
                        onChange={(e) => patch({ age: e.target.value })}
                      >
                        {["2–3 岁", "4–5 岁", "6–8 岁"].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="故事语言">
                      <select
                        value={draft.language}
                        onChange={(e) => patch({ language: e.target.value })}
                      >
                        {["中文", "英文", "中英双语"].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label={`正文页数 · ${draft.pageCount} 页`}>
                    <input
                      aria-label="正文页数"
                      type="range"
                      min="4"
                      max="12"
                      step="1"
                      value={draft.pageCount}
                      onChange={(e) => {
                        const count = Number(e.target.value);
                        update((d) => setWorkbenchPageCount(d, count));
                        setPage((p) => Math.min(p, count));
                      }}
                    />
                    <div className={s.rangeLabels}>
                      <span>4 页 · 短故事</span>
                      <span>12 页 · 完整冒险</span>
                    </div>
                  </Field>
                  <p className={s.hint}>
                    封面单独计算。减少页数会暂时收起内容，恢复页数即可找回。
                  </p>
                  <Field label="封面副标题">
                    <input
                      value={draft.subtitle}
                      onChange={(e) => patch({ subtitle: e.target.value })}
                    />
                  </Field>
                  <Field label="作者 / 署名">
                    <input
                      value={draft.author}
                      placeholder="例如：小满和妈妈"
                      onChange={(e) => patch({ author: e.target.value })}
                    />
                  </Field>
                  {assetControl({ kind: "cover" }, draft.cover)}
                </>
              )}
              {step === 1 && (
                <>
                  <div className={s.note}>
                    图片先在本地预览；提交生成时私密上传。动漫化、拟人化和修图会在生成步骤中由
                    GPT 处理。
                  </div>
                  {draft.characters.map((c, index) => (
                    <article className={s.character} key={c.id}>
                      <header>
                        <strong>
                          角色 {String(index + 1).padStart(2, "0")}
                        </strong>
                        {index > 0 && (
                          <button
                            onClick={() =>
                              update((d) => ({
                                ...d,
                                characters: d.characters.filter(
                                  (v) => v.id !== c.id,
                                ),
                                pages: d.pages.map((p) => ({
                                  ...p,
                                  characters: p.characters.filter(
                                    (id) => id !== c.id,
                                  ),
                                })),
                              }))
                            }
                          >
                            删除角色
                          </button>
                        )}
                      </header>
                      <div className={s.two}>
                        <Field label="名字">
                          <input
                            value={c.name}
                            onChange={(e) =>
                              characterPatch(c.id, { name: e.target.value })
                            }
                          />
                        </Field>
                        <Field label="身份">
                          <input
                            value={c.role}
                            onChange={(e) =>
                              characterPatch(c.id, { role: e.target.value })
                            }
                          />
                        </Field>
                      </div>
                      {(["appearance", "personality", "outfit"] as const).map(
                        (key, i) => (
                          <Field
                            key={key}
                            label={["外貌特征", "性格", "服装"][i]}
                          >
                            <input
                              value={c[key]}
                              onChange={(e) =>
                                characterPatch(c.id, { [key]: e.target.value })
                              }
                            />
                          </Field>
                        ),
                      )}
                      {assetControl({ kind: "character", id: c.id }, c.asset)}
                    </article>
                  ))}
                  <button
                    className={s.add}
                    onClick={() =>
                      patch({
                        characters: [
                          ...draft.characters,
                          {
                            id: crypto.randomUUID(),
                            name: "",
                            role: "配角",
                            appearance: "",
                            personality: "",
                            outfit: "",
                          },
                        ],
                      })
                    }
                  >
                    ＋ 添加家人、朋友或宠物
                  </button>
                </>
              )}
              {step === 2 && (
                <>
                  {live.job?.status === "review" && (
                    <div className={s.note}>
                      <strong>分镜已生成，请逐页检查</strong>
                      <p>
                        确认文案和画面描述后开始生成插图；角色、页数和画风已按本次任务锁定。
                      </p>
                      <button
                        className={s.primary}
                        disabled={live.busy}
                        onClick={() => {
                          setStep(4);
                          void live.confirm(draft);
                        }}
                      >
                        确认分镜，生成插图
                      </button>
                    </div>
                  )}
                  <Field label="整体故事 / 故事梗概">
                    <textarea
                      rows={5}
                      value={draft.story}
                      placeholder="写下一次冒险，或者一件发生过的小事……"
                      onChange={(e) => patch({ story: e.target.value })}
                    />
                  </Field>
                  <p className={s.hint}>
                    这里保存故事设定，不会自动改写已编辑分镜。可载入示例后手动逐页编辑。
                  </p>
                  <button
                    disabled={activeJob}
                    onClick={() => setModal("reset")}
                  >
                    载入示例分镜
                  </button>
                  <div className={s.pageSelect}>
                    <strong>当前编辑</strong>
                    <select
                      aria-label="编辑内页"
                      value={activePage}
                      onChange={(e) => navigate(Number(e.target.value))}
                    >
                      {Array.from({ length: draft.pageCount }, (_, i) => (
                        <option value={i + 1} key={i}>
                          第 {i + 1} 页
                        </option>
                      ))}
                    </select>
                  </div>
                  <Field label={`第 ${activePage} 页正文`}>
                    <textarea
                      rows={4}
                      value={current.text}
                      onChange={(e) => {
                        if (!page) setPage(1);
                        pagePatch(activePage - 1, { text: e.target.value });
                      }}
                    />
                  </Field>
                  <Field label="画面描述">
                    <textarea
                      rows={3}
                      value={current.scene}
                      onChange={(e) =>
                        pagePatch(activePage - 1, { scene: e.target.value })
                      }
                    />
                  </Field>
                  <div className={s.field}>
                    <span>出场人物</span>
                    <div className={s.chips}>
                      {draft.characters.map((c) => (
                        <button
                          key={c.id}
                          aria-pressed={current.characters.includes(c.id)}
                          onClick={() =>
                            pagePatch(activePage - 1, {
                              characters: current.characters.includes(c.id)
                                ? current.characters.filter((id) => id !== c.id)
                                : [...current.characters, c.id],
                            })
                          }
                        >
                          {c.name || "未命名角色"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {draft.renderingMode === "integrated" && (
                    <Field label="本页图文构图与断行要求">
                      <textarea
                        value={current.artDirection || ""}
                        placeholder="例如：文字放在左上天空，分成三行；人物在右下，不加字幕条。留空时由分镜模型设计。"
                        onChange={(e) =>
                          pagePatch(activePage - 1, {
                            artDirection: e.target.value,
                          })
                        }
                      />
                    </Field>
                  )}
                  <p className={s.hint}>
                    {spread
                      ? `第 ${spread}–${spread + 1} 页共用左页插图，正文分别编辑。`
                      : "上传已有插图，立即查看图文排版。"}
                  </p>
                  {assetControl(
                    { kind: "page", index: imageIndex },
                    draft.pages[imageIndex].asset,
                  )}
                  <Field label="跨页画面">
                    <div className={s.chips}>
                      {Array.from(
                        { length: Math.floor((draft.pageCount - 1) / 2) },
                        (_, i) => (i + 1) * 2,
                      ).map((n) => (
                        <button
                          key={n}
                          aria-pressed={draft.spreads.includes(n)}
                          disabled={activeJob}
                          onClick={() => {
                            update((d) => toggleWorkbenchSpread(d, n));
                            navigate(n);
                          }}
                        >
                          {n}–{n + 1} 页{" "}
                          {draft.spreads.includes(n) ? "✓" : "＋"}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <p className={s.hint}>
                    第 1
                    页独立；跨页使用左页图片，原右页图片仍保留。取消跨页后恢复。
                  </p>
                </>
              )}
              {step === 3 && (
                <>
                  <Field label="成书方式">
                    <select
                      value={draft.renderingMode || "editable"}
                      disabled={
                        !!live.job &&
                        live.job.status !== "complete" &&
                        live.job.status !== "failed"
                      }
                      onChange={(e) =>
                        patch({
                          renderingMode: e.target.value as
                            | "integrated"
                            | "editable",
                        })
                      }
                    >
                      <option value="integrated">
                        精品图文一体 · 插画与文字共同设计
                      </option>
                      <option value="editable">
                        可编辑文字 · 插画与文字分别排版
                      </option>
                    </select>
                  </Field>
                  {draft.renderingMode === "integrated" && (
                    <div className={s.note}>
                      <strong>以《把夏天装进口袋》为设计方向</strong>
                      <p>
                        先确认正文与每页构图，再生成封面和内页。文字直接融入天空、路径等自然留白；不套文字框。已有图片仅作配置预览，新生成后才能看到图文一体效果。
                      </p>
                      <p>
                        成品需要逐页核对错字、漏字和人物一致性；正文、版式和断行的成品修改需要重新生成。
                      </p>
                    </div>
                  )}
                  <Field label="当前排版页面">
                    <select
                      value={spread || page}
                      onChange={(e) => navigate(Number(e.target.value))}
                    >
                      <option value={0}>封面（独立排版）</option>
                      {Array.from({ length: draft.pageCount }, (_, i) => i + 1)
                        .filter((n) => spreadStart(draft, n) !== n - 1)
                        .map((n) => (
                          <option key={n} value={n}>
                            {spreadStart(draft, n)
                              ? `第 ${n}–${n + 1} 页 · 跨页`
                              : `第 ${n} 页`}
                          </option>
                        ))}
                    </select>
                  </Field>
                  {page > 0 && draft.renderingMode !== "integrated" && (
                    <>
                      <Field label="构图版式">
                        <div className={s.layoutCards}>
                          {(Object.keys(BOOK_LAYOUTS) as BookLayout[]).map(
                            (layout) => (
                              <button
                                key={layout}
                                aria-pressed={
                                  (draft.pages[imageIndex].layout ||
                                    "panorama") === layout
                                }
                                onClick={() => {
                                  pagePatch(imageIndex, { layout });
                                  setMessage(
                                    "版式已更新。当前使用已有插图排版；自然留白与人物构图需在新的生成操作中完成。",
                                  );
                                }}
                              >
                                <span
                                  className={`${s.layoutSketch} ${s[layout]}`}
                                  aria-hidden="true"
                                >
                                  <i />
                                  <b />
                                </span>
                                <strong>{BOOK_LAYOUTS[layout].name}</strong>
                                <small>
                                  {BOOK_LAYOUTS[layout].description}
                                </small>
                              </button>
                            ),
                          )}
                        </div>
                      </Field>
                      <Field label="文字融入方式">
                        <select
                          value={
                            draft.pages[imageIndex].textTreatment ||
                            (draft.typography.backing ? "soft" : "natural")
                          }
                          onChange={(e) =>
                            pagePatch(imageIndex, {
                              textTreatment: e.target.value as
                                | "natural"
                                | "soft",
                            })
                          }
                        >
                          <option value="natural">
                            自然留白 · 直接排入画面
                          </option>
                          <option value="soft">
                            柔和衬底 · 局部渐变保护文字
                          </option>
                        </select>
                      </Field>
                      <p className={s.hint}>
                        跨页共用版式，左右正文独立。文字区域避开中缝；过长正文会提示溢出。已有图片的版式预览包含裁切，不代表已重新构图。
                      </p>
                    </>
                  )}
                  {draft.renderingMode !== "integrated" && (
                    <>
                      <button
                        className={s.add}
                        onClick={() => {
                          update((d) => ({
                            ...d,
                            pages: d.pages.map((p, i) =>
                              i >= d.pageCount
                                ? p
                                : {
                                    ...p,
                                    layout:
                                      i === d.pageCount - 1
                                        ? "minimal"
                                        : p.text.length > 65
                                          ? "panorama"
                                          : (
                                              [
                                                "embrace",
                                                "panorama",
                                                "panorama",
                                                "sidebar",
                                              ] as BookLayout[]
                                            )[i % 4],
                                  },
                            ),
                          }));
                          setMessage(
                            "已按正文长度和页序编排四种版式，可逐页修改。已有插图尚未重新生成，请检查裁切与文字溢出。",
                          );
                        }}
                      >
                        自动编排整本版式
                      </button>
                      <p className={s.hint}>
                        按正文长度与页序搭配版式，结尾保留留白；点击会替换当前内页版式，不修改文案和图片。
                      </p>
                    </>
                  )}
                  <div className={s.styleCards}>
                    {(Object.keys(styles) as Array<keyof typeof styles>).map(
                      (style, i) => (
                        <button
                          key={style}
                          aria-pressed={draft.style === style}
                          onClick={() => patch({ style })}
                        >
                          <span
                            className={s.styleSwatch}
                            style={{
                              background: [
                                "linear-gradient(140deg,#cfddc1,#f8deb3,#b4c9cc)",
                                "linear-gradient(140deg,#f4bf77,#e9a5a0,#9dbb9e)",
                                "linear-gradient(140deg,#b9b2d6,#e4c7d7,#d9ddba)",
                              ][i],
                            }}
                          >
                            ✦
                          </span>
                          {styles[style]}
                        </button>
                      ),
                    )}
                  </div>
                  <p className={s.hint}>
                    色卡为风格方向参考；已有插图不会随选择自动转换。
                  </p>
                  <Field label="画幅">
                    <select
                      value={draft.format}
                      onChange={(e) =>
                        patch({
                          format: e.target
                            .value as CustomWorkbenchDraft["format"],
                        })
                      }
                    >
                      <option value="square">方形 · 1:1</option>
                      <option value="portrait">竖版 · 4:5</option>
                      <option value="landscape">横版 · 4:3</option>
                    </select>
                  </Field>
                  {draft.renderingMode !== "integrated" && (
                    <>
                      <div className={s.note}>
                        文字是书页画面的一部分，可随时编辑。导出时与插图合为一张图片。
                      </div>
                      <Field label={`字号 · ${draft.typography.size}`}>
                        <input
                          type="range"
                          min="18"
                          max="60"
                          value={draft.typography.size}
                          onChange={(e) =>
                            patch({
                              typography: {
                                ...draft.typography,
                                size: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </Field>
                      <div className={s.two}>
                        <Field label="文字位置">
                          <select
                            value={draft.typography.position}
                            onChange={(e) =>
                              patch({
                                typography: {
                                  ...draft.typography,
                                  position: e.target.value as
                                    | "top"
                                    | "middle"
                                    | "bottom",
                                },
                              })
                            }
                          >
                            <option value="top">上方</option>
                            <option value="middle">居中</option>
                            <option value="bottom">下方</option>
                          </select>
                        </Field>
                        <Field label="对齐">
                          <select
                            value={draft.typography.align}
                            onChange={(e) =>
                              patch({
                                typography: {
                                  ...draft.typography,
                                  align: e.target.value as
                                    | "left"
                                    | "center"
                                    | "right",
                                },
                              })
                            }
                          >
                            <option value="left">左对齐</option>
                            <option value="center">居中</option>
                            <option value="right">右对齐</option>
                          </select>
                        </Field>
                      </div>
                      <div className={s.two}>
                        <Field label="文字颜色">
                          <input
                            type="color"
                            value={draft.typography.color}
                            onChange={(e) =>
                              patch({
                                typography: {
                                  ...draft.typography,
                                  color: e.target.value,
                                },
                              })
                            }
                          />
                        </Field>
                        <Field label="书页底色">
                          <input
                            type="color"
                            value={draft.typography.background}
                            onChange={(e) =>
                              patch({
                                typography: {
                                  ...draft.typography,
                                  background: e.target.value,
                                },
                              })
                            }
                          />
                        </Field>
                      </div>
                      <label className={s.check}>
                        <input
                          type="checkbox"
                          checked={draft.typography.backing}
                          onChange={(e) =>
                            patch({
                              typography: {
                                ...draft.typography,
                                backing: e.target.checked,
                              },
                            })
                          }
                        />
                        添加柔和文字底衬
                      </label>
                    </>
                  )}
                </>
              )}
            </fieldset>
            {step === 4 && (
              <>
                <div className={s.summary}>
                  <h3>{draft.title || "未命名绘本"}</h3>
                  <p>
                    {draft.theme} · {draft.age} · {draft.language}
                  </p>
                  <p>
                    {draft.pageCount} 页正文 ＋ 封面 · {styles[draft.style]}
                  </p>
                  <p>
                    人物：
                    {draft.characters.map((c) => c.name || "未命名").join("、")}
                  </p>
                  <p>
                    成书方式：
                    {draft.renderingMode === "integrated"
                      ? "精品图文一体（需逐页校对）"
                      : "可编辑文字"}
                  </p>
                  <p>
                    生图模型：
                    {live.job?.model || live.quota?.model || "gpt-image-2"}
                  </p>
                </div>
                <div className={s.note}>
                  <strong>每周一本，慢慢创作</strong>
                  <p>
                    登录账号每周免费一本，周一北京时间 00:00
                    重置。兑换码可增加额外生成机会。
                  </p>
                  <p>
                    先生成故事分镜，确认后处理人物与插图。编辑和 PDF
                    下载不限次，失败保留完成的内容，最终失败退还机会。
                  </p>
                  <p>
                    参考照片会私密上传并发送给模型服务用于本次生成。开启生成前请确认已获得照片使用许可。
                  </p>
                </div>
                {live.error && (
                  <p role="alert" className={s.hint}>
                    {live.error}
                  </p>
                )}
                {!live.session ? (
                  <Link href="/login?next=/custom" className={s.upload}>
                    登录后开始生成 →
                  </Link>
                ) : (
                  !activeJob && (
                    <button
                      className={s.primary}
                      disabled={live.busy || !live.quota}
                      onClick={() => {
                        if (
                          live.quota &&
                          live.quota.remaining + live.quota.credits === 0
                        )
                          setModal("pay");
                        else void live.start(draft);
                      }}
                    >
                      {live.busy
                        ? "正在提交…"
                        : live.quota &&
                            live.quota.remaining + live.quota.credits === 0
                          ? "兑换生成机会"
                          : "生成故事分镜 →"}
                    </button>
                  )
                )}
                {live.job && (
                  <div className={s.summary} aria-live="polite">
                    <strong>
                      {
                        (
                          {
                            outline: "正在生成故事分镜",
                            review: "故事分镜待确认",
                            images: "正在生成绘本插图",
                            retryable: "生成中断，可继续恢复",
                            complete: "绘本生成完成",
                            failed: "任务已结束",
                          } as const
                        )[live.job.status]
                      }
                    </strong>
                    <p>
                      插图进度：{live.job.cursor} / {live.job.totalUnits}
                      （含人物参考图和封面）
                    </p>
                    {live.job.error && <p>{live.job.error}</p>}
                    {live.job.quotaState === "refunded" && (
                      <p>本次生成机会已退还。</p>
                    )}
                    {live.job.status === "review" && (
                      <button
                        className={s.primary}
                        disabled={live.busy}
                        onClick={() => void live.confirm(draft)}
                      >
                        确认分镜，生成插图
                      </button>
                    )}
                    {activeJob && live.job.status !== "review" && (
                      <button
                        disabled={live.busy}
                        onClick={() => void live.retry()}
                      >
                        {live.busy
                          ? "正在生成，请稍候…"
                          : "继续任务 / 重试当前步骤"}
                      </button>
                    )}
                    {activeJob && (
                      <button
                        disabled={live.busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              "取消任务？AI 已开始工作时将使用本次机会，已完成内容仍会保留。",
                            )
                          )
                            void live.cancel();
                        }}
                      >
                        取消任务
                      </button>
                    )}
                  </div>
                )}
                {live.job?.status === "complete" && (
                  <button
                    disabled={live.busy}
                    onClick={() => void live.saveLayout(draft)}
                  >
                    保存文字与排版
                  </button>
                )}
                {live.session && (
                  <button onClick={() => setModal("pay")}>我有兑换码</button>
                )}
                {!!live.quota?.jobs.length && (
                  <details className={s.demo}>
                    <summary>我的绘本任务 · 刷新后可从这里恢复</summary>
                    {live.quota.jobs.map((j) => (
                      <button
                        key={j.id}
                        disabled={live.busy}
                        onClick={() => void live.resume(j.id)}
                      >
                        {new Date(j.created_at).toLocaleDateString("zh-CN")} ·{" "}
                        {
                          (
                            {
                              outline: "分镜生成",
                              review: "待确认",
                              images: "插图生成",
                              retryable: "可重试",
                              complete: "已完成",
                              failed: "已结束",
                            } as const
                          )[j.status]
                        }{" "}
                        · 打开
                      </button>
                    ))}
                  </details>
                )}
              </>
            )}
            <div className={s.stepFooter}>
              <span>0{step + 1} / 05</span>
              <button
                className={s.primary}
                onClick={() => {
                  if (step < 4) {
                    setStep(step + 1);
                    if (step === 1 && page === 0) setPage(1);
                  } else setModal("read");
                }}
              >
                {step < 4 ? `下一步：${steps[step + 1]} →` : "查看整本绘本 →"}
              </button>
            </div>
          </div>
        </section>
        <section
          className={`${s.preview} ${mobile !== "preview" ? s.mobileHidden : ""}`}
          aria-label="实时绘本预览"
        >
          <header className={s.previewHeader}>
            <div>
              <span className={s.liveDot} />
              实时预览 <small>每一个小改动，都看得见</small>
            </div>
            <button onClick={() => setModal("read")}>整本阅读 ↗</button>
          </header>
          <div className={s.stage}>
            <WorkbenchBook draft={draft} page={page} onNavigate={navigate} />
          </div>
          <div className={s.thumbnails}>
            {Array.from({ length: draft.pageCount + 1 }, (_, i) => (
              <button
                key={i}
                aria-label={i ? `预览第 ${i} 页` : "预览封面"}
                aria-pressed={page === i}
                onClick={() => navigate(i)}
              >
                <span>
                  {(i === 0
                    ? draft.cover
                    : draft.pages[(spreadStart(draft, i) || i) - 1]?.asset
                  )?.src ? (
                    <img
                      src={
                        (i === 0
                          ? draft.cover
                          : draft.pages[(spreadStart(draft, i) || i) - 1]?.asset
                        )?.src
                      }
                      alt=""
                    />
                  ) : (
                    <b>✧</b>
                  )}
                </span>
                {i === 0 ? "封面" : String(i).padStart(2, "0")}
              </button>
            ))}
          </div>
          {hasEmbeddedArtwork && (
            <label className={s.proofread}>
              <input
                type="checkbox"
                checked={proofread}
                onChange={(e) => setProofread(e.target.checked)}
              />
              我已逐页核对错字、漏字、人物和中缝。此为人工校对确认。
            </label>
          )}
          <footer className={s.previewFooter}>
            <span>
              {draft.pageCount} 页正文 ＋ 封面
              <small>图文一体 · 整本 PDF 下载</small>
            </span>
            <button
              onClick={() => void exportPdf()}
              disabled={exporting || live.busy || !!activeJob}
            >
              {exporting ? "正在排版…" : "下载整本 PDF ↓"}
            </button>
          </footer>
          <div className={s.context}>
            ✦ {draft.theme} ·{" "}
            {draft.characters.map((c) => c.name || "未命名角色").join("、")}
            {page > 0 && <p>{current.scene || "为这一页写下画面描述…"}</p>}
            <small>
              语言和人物设定用于后续生成；修改不会自动翻译或重绘已有内容。
            </small>
          </div>
        </section>
      </div>
      {message && (
        <div className={s.message} role="status">
          <span>{message}</span>
          <button aria-label="关闭提示" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}
      {editing && (
        <Modal title="图片处理" onClose={() => setEditing(null)}>
          <div className={s.cropPreview}>
            <WorkbenchCanvas
              hideText
              draft={{
                ...draft,
                cover: editing.asset,
                pages: draft.pages.map((p, i) =>
                  editing.target.kind === "page" && i === editing.target.index
                    ? { ...p, asset: editing.asset }
                    : p,
                ),
                spreads: draft.spreads,
              }}
              page={
                editing.target.kind === "page" ? editing.target.index + 1 : 0
              }
            />
          </div>
          <p className={s.hint}>
            保留原图。裁剪立即预览；AI 处理在正式生成时执行。
          </p>
          <Field label="裁剪比例">
            <select
              value={editing.asset.ratio}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  asset: {
                    ...editing.asset,
                    ratio: e.target.value as WorkbenchAsset["ratio"],
                  },
                })
              }
            >
              <option value="page">跟随书页</option>
              <option value="square">方形</option>
              <option value="portrait">竖版 4:5</option>
              <option value="landscape">横版 4:3</option>
            </select>
          </Field>
          {(["zoom", "x", "y"] as const).map((key, i) => (
            <Field key={key} label={["缩放", "水平位置", "垂直位置"][i]}>
              <input
                type="range"
                min={key === "zoom" ? 1 : 0}
                max={key === "zoom" ? 2 : 100}
                step={key === "zoom" ? 0.01 : 1}
                value={editing.asset.crop[key]}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    asset: {
                      ...editing.asset,
                      crop: normalizeFamilyImageCrop({
                        ...editing.asset.crop,
                        [key]: Number(e.target.value),
                      }),
                    },
                  })
                }
              />
            </Field>
          ))}
          <button
            onClick={() =>
              setEditing({
                ...editing,
                asset: {
                  ...editing.asset,
                  ratio: "page",
                  crop: normalizeFamilyImageCrop(null),
                },
              })
            }
          >
            恢复原图裁剪
          </button>
          <Field label="外观处理">
            <select
              value={editing.asset.appearance}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  asset: {
                    ...editing.asset,
                    appearance: e.target.value as "original" | "anime",
                  },
                })
              }
            >
              <option value="original">保留原貌</option>
              <option value="anime">动漫化</option>
            </select>
          </Field>
          <label className={s.check}>
            <input
              type="checkbox"
              checked={editing.asset.anthropomorphic}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  asset: {
                    ...editing.asset,
                    anthropomorphic: e.target.checked,
                  },
                })
              }
            />
            拟人化 · 适合动物或物品角色
          </label>
          <div className={s.chips}>
            {["去背景", "去除杂物", "调整明暗", "修复瑕疵"].map((v) => (
              <button
                key={v}
                aria-pressed={editing.asset.retouch.includes(v)}
                onClick={() =>
                  setEditing({
                    ...editing,
                    asset: {
                      ...editing.asset,
                      retouch: editing.asset.retouch.includes(v)
                        ? editing.asset.retouch.filter((x) => x !== v)
                        : [...editing.asset.retouch, v],
                    },
                  })
                }
              >
                {v}
              </button>
            ))}
          </div>
          <Field label="补充修图要求">
            <textarea
              value={editing.asset.instructions}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  asset: { ...editing.asset, instructions: e.target.value },
                })
              }
            />
          </Field>
          <div className={s.modalActions}>
            <button onClick={() => setEditing(null)}>取消</button>
            <button
              className={s.primary}
              onClick={() => {
                saveAsset(editing.target, editing.asset);
                setEditing(null);
                setMessage("已保存裁剪与修图要求，将在生成时处理。");
              }}
            >
              确认使用
            </button>
          </div>
        </Modal>
      )}
      {modal === "read" && (
        <ImmersiveWorkbenchReader
          draft={draft}
          page={page}
          onNavigate={navigate}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "pay" && (
        <Modal title="兑换绘本生成机会" onClose={() => setModal(null)}>
          <div className={s.summary}>
            <h3>一个兑换码 · 一本绘本</h3>
            <p>
              兑换码一次有效，兑换后绑定当前登录账号。每周免费额度用完后，可使用兑换机会。
            </p>
          </div>
          {!live.session ? (
            <Link href="/login?next=/custom">先登录再兑换</Link>
          ) : (
            <>
              <Field label="兑换码">
                <input
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value)}
                  placeholder="输入你的兑换码"
                  autoComplete="off"
                />
              </Field>
              <button
                className={s.primary}
                disabled={live.busy || !redeemCode.trim()}
                onClick={() => void live.redeem(redeemCode)}
              >
                {live.busy ? "正在兑换…" : "兑换 1 次生成机会"}
              </button>
            </>
          )}
        </Modal>
      )}
      {modal === "reset" && (
        <Modal title="从这里，开始一本书" onClose={() => setModal(null)}>
          <p className={s.startIntro}>
            先翻翻一本成品，或把自己的故事写进空白页。
          </p>
          <div className={s.resetOptions}>
            <button
              className={s.featuredSample}
              aria-label="载入精品样书：雨后的小小花园"
              onClick={() => {
                live.clearJob();
                setDraft(
                  structuredClone(integratedSample) as CustomWorkbenchDraft,
                );
                setPage(0);
                setStep(3);
                setDirty(true);
                setModal(null);
                setMessage(
                  "已载入真实 GPT 图文一体样书：封面＋4页正文，包含2–3页跨页。可翻阅、校对并导出 PDF。",
                );
              }}
            >
              <span className={s.sampleCover}>
                <img src="/sample-books/integrated-garden/cover.jpg" alt="" />
              </span>
              <span className={s.sampleDescription}>
                <span className={s.sampleBadge}>先体验一本完整绘本</span>
                <strong>雨后的小小花园</strong>
                <span className={s.sampleBlurb}>
                  跟着小禾走进雨后的花园，
                  <br />
                  看看文字如何长进画面里。
                </span>
                <span className={s.sampleMeta}>
                  4 页正文 · 连续跨页 · 可下载 PDF
                </span>
                <span className={s.sampleCta}>
                  载入精品样书 <span aria-hidden="true">↗</span>
                </span>
              </span>
            </button>
            <div className={s.startChoices}>
              <button
                className={s.startChoice}
                onClick={() => {
                  live.clearJob();
                  setDraft(createWorkbenchDraft(false));
                  setPage(0);
                  setStep(0);
                  setDirty(true);
                  setModal(null);
                }}
              >
                <span className={s.choiceIcon} aria-hidden="true">
                  ＋
                </span>
                <strong>
                  从空白开始 <span aria-hidden="true">↗</span>
                </strong>
                <span>写下名字，让故事从你开始。</span>
                <small>新建一份空白草稿</small>
              </button>
              <button
                className={s.startChoice}
                onClick={() => {
                  live.clearJob();
                  setDraft(createWorkbenchDraft());
                  setPage(0);
                  setDirty(true);
                  setModal(null);
                }}
              >
                <span className={s.choiceThumbnail} aria-hidden="true">
                  <img
                    src="/sample-books/gpt-image-2/brave-cloud/1.webp"
                    alt=""
                  />
                </span>
                <strong>
                  跟着示例试一试 <span aria-hidden="true">↗</span>
                </strong>
                <span>小云朵勇敢飞 · 8 页故事</span>
                <small>载入完整配置，逐项探索</small>
              </button>
            </div>
            <button
              className={s.storyboardOption}
              onClick={() => {
                const sample = createWorkbenchDraft();
                update((d) => ({
                  ...d,
                  story: sample.story,
                  pages: sample.pages.map((p) => ({
                    ...p,
                    characters: d.characters.length ? [d.characters[0].id] : [],
                  })),
                  spreads: [],
                }));
                setPage(1);
                setStep(2);
                setModal(null);
              }}
            >
              <span>
                <strong>只想试试故事分镜？</strong>
                <small>保留基础信息和人物，替换故事、正文与页面素材。</small>
              </span>
              <span className={s.storyboardCta}>
                载入分镜 <span aria-hidden="true">→</span>
              </span>
            </button>
          </div>
          <p className={s.replaceNote}>
            <span aria-hidden="true">ⓘ</span>{" "}
            选择新草稿或完整示例会替换当前草稿。想保留现在的内容，请先导出配置并保存原图。
          </p>
        </Modal>
      )}
    </main>
  );
}
