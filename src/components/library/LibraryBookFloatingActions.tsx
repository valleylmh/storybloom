"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ChatCircleDots,
  Check,
  Copy,
  DownloadSimple,
  Gift,
  Heart,
  PaperPlaneTilt,
  SpinnerGap,
  X,
} from "@phosphor-icons/react";
import { copyTextToClipboard } from "@/lib/social-share";
import styles from "./LibraryBookFloatingActions.module.css";

export type LibraryBookFloatingActionsConfig = {
  feedbackEnabled?: boolean;
  supportQrCodeUrl?: string;
  supportLabel?: string;
};

const FEEDBACK_TYPES = ["文字", "插图", "朗读", "其他建议"] as const;

export default function LibraryBookFloatingActions({
  title,
  contentId,
  pageNumbers,
  currentPage,
  feedbackEnabled,
  supportQrCodeUrl,
  supportLabel = "自愿支持绘本创作",
}: LibraryBookFloatingActionsConfig & {
  title: string;
  contentId: string;
  pageNumbers: number[];
  currentPage?: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [openDialog, setOpenDialog] = useState<"feedback" | "support" | null>(null);
  const [feedbackType, setFeedbackType] = useState<string>("其他建议");
  const [feedbackPage, setFeedbackPage] = useState("all");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackError, setFeedbackError] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [supportError, setSupportError] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const feedbackRequestIdRef = useRef<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!openDialog || !dialog) return;

    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [openDialog]);

  function openFeedback() {
    // Keep a filled or pending draft associated with its original page.
    if (!submitting && (!feedbackText.trim() || sent)) {
      const nextPage = currentPage === undefined ? "all" : String(currentPage);
      if (sent || nextPage !== feedbackPage) resetFeedbackStatus();
      if (sent) setFeedbackText("");
      setFeedbackPage(nextPage);
    }
    setOpenDialog("feedback");
  }

  function openSupport() {
    setSupportMessage("");
    setSupportError(false);
    setLinkCopied(false);
    setOpenDialog("support");
  }

  function readingUrl() {
    return `${window.location.origin}${window.location.pathname}`;
  }

  function resetFeedbackStatus() {
    setFeedbackMessage("");
    setFeedbackError(false);
    setSent(false);
    feedbackRequestIdRef.current = null;
  }

  function feedbackBody() {
    return [
      "StoryBloom 绘本反馈",
      `绘本：${title}`,
      `页面：${feedbackPage === "all" ? "整本绘本" : `第 ${feedbackPage} 页`}`,
      `类型：${feedbackType}`,
      `链接：${readingUrl()}`,
      "",
      feedbackText.trim(),
    ].join("\n");
  }

  async function prepareFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || sent) return;
    if (!feedbackText.trim()) {
      setFeedbackError(true);
      setFeedbackMessage("请先写下你的反馈。");
      return;
    }

    setFeedbackError(false);
    if (feedbackEnabled) {
      setSubmitting(true);
      setFeedbackMessage("");
      try {
        // Reuse this key when an unchanged draft retries after an ambiguous result.
        feedbackRequestIdRef.current ??= crypto.randomUUID();
        const response = await fetch("/api/library/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentId,
            page: feedbackPage === "all" ? null : Number(feedbackPage),
            type: feedbackType,
            message: feedbackText.trim(),
            requestId: feedbackRequestIdRef.current,
          }),
        });
        const result = await response.json() as { ok?: boolean; error?: string };
        if (!response.ok || result.ok !== true) {
          throw new Error(result.error || "暂时无法确认发送，请稍后重试。");
        }
        setSent(true);
        setFeedbackMessage("反馈已发送，谢谢你的建议！");
      } catch (error) {
        setFeedbackError(true);
        setFeedbackMessage(error instanceof Error ? error.message : "暂时无法确认发送，请稍后重试。");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    await copyFeedback();
  }

  async function copyFeedback() {
    try {
      await copyTextToClipboard(feedbackBody());
      setFeedbackError(false);
      setFeedbackMessage(sent ? "反馈内容已复制。" : "反馈内容已复制，尚未发送。");
    } catch {
      setFeedbackError(true);
      setFeedbackMessage("复制失败，请手动复制反馈内容。");
    }
  }

  async function copyReadingLink() {
    try {
      await copyTextToClipboard(readingUrl());
      setLinkCopied(true);
      setSupportError(false);
      setSupportMessage("阅读链接已复制，可以分享给家人朋友。");
    } catch {
      setSupportError(true);
      setSupportMessage("复制失败，请直接复制浏览器地址。");
    }
  }

  const message = openDialog === "feedback" ? feedbackMessage : supportMessage;
  const copyFailed = openDialog === "feedback" ? feedbackError : supportError;

  return (
    <>
      <div className={styles.dock} role="group" aria-label="绘本反馈与支持">
        <button
          type="button"
          className={styles.bubble}
          aria-label="意见反馈"
          aria-haspopup="dialog"
          aria-expanded={openDialog === "feedback"}
          onClick={openFeedback}
        >
          <ChatCircleDots size={20} aria-hidden="true" />
          <span>反馈</span>
        </button>
        <button
          type="button"
          className={`${styles.bubble} ${styles.supportBubble}`}
          aria-label="支持创作"
          aria-haspopup="dialog"
          aria-expanded={openDialog === "support"}
          onClick={openSupport}
        >
          <Gift size={20} aria-hidden="true" />
          <span>支持</span>
        </button>
      </div>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby="library-floating-dialog-title"
        aria-describedby="library-floating-dialog-description"
        onClose={() => setOpenDialog(null)}
        onKeyDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right ||
              event.clientY < bounds.top || event.clientY > bounds.bottom) {
            setOpenDialog(null);
          }
        }}
      >
        {openDialog ? (
          <>
            <button
              type="button"
              className={styles.close}
              aria-label={openDialog === "feedback" ? "关闭意见反馈" : "关闭支持创作"}
              onClick={() => setOpenDialog(null)}
            >
              <X size={18} aria-hidden="true" />
            </button>

            {openDialog === "feedback" ? (
              <>
                <div className={styles.dialogIcon}><ChatCircleDots size={25} aria-hidden="true" /></div>
                <p className={styles.eyebrow}>一起把绘本做得更好</p>
                <h2 id="library-floating-dialog-title">意见反馈</h2>
                <p id="library-floating-dialog-description" className={styles.description}>
                  哪一处需要改进，或者有什么新点子？我们愿意听听。
                </p>
                <p className={styles.bookContext}>正在阅读 · {title}</p>
                <form className={styles.form} onSubmit={prepareFeedback}>
                  <fieldset className={styles.categories} disabled={submitting}>
                    <legend>反馈类型</legend>
                    <div>
                      {FEEDBACK_TYPES.map((type) => (
                        <label key={type} className={feedbackType === type ? styles.selectedCategory : ""}>
                          <input
                            type="radio"
                            name="feedback-type"
                            value={type}
                            checked={feedbackType === type}
                            onChange={() => { setFeedbackType(type); resetFeedbackStatus(); }}
                          />
                          <span>{type}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label className={styles.field}>
                    <span>关联页面</span>
                    <select disabled={submitting} value={feedbackPage} onChange={(event) => { setFeedbackPage(event.target.value); resetFeedbackStatus(); }}>
                      <option value="all">整本绘本</option>
                      {pageNumbers.map((page) => <option key={page} value={page}>第 {page} 页</option>)}
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>想告诉我们的话</span>
                    <textarea
                      rows={4}
                      required
                      maxLength={1000}
                      placeholder="例如：这一页的英文有个小错误，或者想听到更慢一点的朗读……"
                      value={feedbackText}
                      disabled={submitting}
                      onChange={(event) => { setFeedbackText(event.target.value); resetFeedbackStatus(); }}
                    />
                  </label>
                  <div className={styles.formFooter}>
                    <small>会附上绘本名称、页码和阅读链接</small>
                    <span>{feedbackText.length}/1000</span>
                  </div>
                  <button type="submit" className={styles.primaryAction} disabled={submitting || sent}>
                    {submitting ? <SpinnerGap className="spin" aria-hidden="true" /> : sent ? <Check aria-hidden="true" /> : feedbackEnabled ? <PaperPlaneTilt aria-hidden="true" /> : <Copy aria-hidden="true" />}
                    {submitting ? "正在发送…" : sent ? "已发送" : feedbackEnabled ? "提交反馈" : "复制反馈内容"}
                  </button>
                  {feedbackEnabled ? (
                    <button type="button" className={styles.copyAlternative} onClick={copyFeedback} disabled={submitting || !feedbackText.trim()}>
                      <Copy size={14} aria-hidden="true" /> 复制反馈内容
                    </button>
                  ) : null}
                </form>
              </>
            ) : (
              <div className={styles.supportContent}>
                <div className={`${styles.dialogIcon} ${styles.giftIcon}`}><Gift size={30} aria-hidden="true" /></div>
                <p className={styles.eyebrow}>谢谢你喜欢这里的故事</p>
                <h2 id="library-floating-dialog-title">支持绘本创作</h2>
                <p id="library-floating-dialog-description" className={styles.description}>
                  让更多温暖的故事，陪伴孩子慢慢长大。
                </p>
                {supportQrCodeUrl ? (
                  <>
                    <div className={styles.qrFrame}>
                      <a href={supportQrCodeUrl} target="_blank" rel="noopener noreferrer" aria-label="查看支付宝收款码原图">
                        <img src={supportQrCodeUrl} alt="支持 StoryBloom 绘本创作的收款码" />
                      </a>
                    </div>
                    <p className={styles.supportLabel}>{supportLabel}</p>
                    <p className={styles.supportNote}>保存图片后，在支付宝扫一扫中从相册选择。<br />请由家长操作，自愿支持，不影响免费阅读。</p>
                  </>
                ) : (
                  <div className={styles.thankYou}>
                    <Heart size={26} weight="duotone" aria-hidden="true" />
                    <strong>每一份喜欢，都是继续创作的动力</strong>
                    <p>打赏方式正在准备中。把喜欢的绘本分享给朋友，也是一份很好的支持。</p>
                  </div>
                )}
                {supportQrCodeUrl ? (
                  <a className={styles.primaryAction} href={supportQrCodeUrl} download="StoryBloom-Alipay.png">
                    <DownloadSimple aria-hidden="true" /> 保存收款码
                  </a>
                ) : null}
                <button type="button" className={supportQrCodeUrl ? styles.copyAlternative : styles.primaryAction} onClick={copyReadingLink}>
                  {linkCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  {linkCopied ? "阅读链接已复制" : "复制链接，分享这本绘本"}
                </button>
                <p className={styles.supportSignoff}>每一次共读，都是故事最好的回响。</p>
              </div>
            )}
            {message ? <p className={`${styles.message} ${copyFailed ? styles.error : ""}`} role={copyFailed ? "alert" : "status"}>{message}</p> : null}
          </>
        ) : null}
      </dialog>
    </>
  );
}
