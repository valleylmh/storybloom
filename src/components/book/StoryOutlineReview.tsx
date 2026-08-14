"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createStoryOutlineDraft,
  createStoryOutlineEditorFields,
  updateStoryOutlineText,
  validateStoryOutlinePages,
  type StoryOutlineTextField,
} from "@/components/book/story-outline-controller";
import type { GenerateResponse, StoryPage } from "@/types";
import styles from "./StoryOutlineReview.module.css";

type AppLocale = "zh" | "en";

interface Props {
  locale: AppLocale;
  result: GenerateResponse;
  onConfirm: (pages: StoryPage[]) => Promise<void>;
  onBack: () => void;
}

const COPY = {
  zh: {
    eyebrow: "PARENT REVIEW",
    title: "先确认故事大纲",
    description:
      "请逐页检查并修改文字。确认后才会开始生成插画，避免把还没定稿的内容送去绘制。",
    page: (page: number) => `第 ${page} 页`,
    pageProgress: (page: number) => `${page} / 8`,
    zhText: "中文内容",
    enText: "英文内容",
    required: "这一页的文字不能为空。",
    invalidStructure: "故事必须包含连续的 8 页，请返回后重新生成。",
    saveError: "大纲暂时无法保存，请稍后再试。",
    back: "放弃这次并重新填写",
    confirm: "确认大纲并生成插画",
    confirming: "正在保存大纲…",
  },
  en: {
    eyebrow: "PARENT REVIEW",
    title: "Review the story outline first",
    description:
      "Review and edit each page. Illustrations start only after you confirm, so unfinished text is never sent for drawing.",
    page: (page: number) => `Page ${page}`,
    pageProgress: (page: number) => `${page} / 8`,
    zhText: "Chinese text",
    enText: "English text",
    required: "The text for this page cannot be empty.",
    invalidStructure: "The story must contain 8 consecutive pages. Please go back and regenerate it.",
    saveError: "The outline could not be saved. Please try again.",
    back: "Start over",
    confirm: "Confirm and create illustrations",
    confirming: "Saving outline…",
  },
};

export default function StoryOutlineReview({
  locale,
  result,
  onConfirm,
  onBack,
}: Props) {
  const [draftPages, setDraftPages] = useState(() =>
    createStoryOutlineDraft(result.pages),
  );
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const text = COPY[locale];
  const editorFields = useMemo(
    () => createStoryOutlineEditorFields(draftPages, result.input.language),
    [draftPages, result.input.language],
  );
  const validation = useMemo(
    () => validateStoryOutlinePages(draftPages, result.input.language),
    [draftPages, result.input.language],
  );

  useEffect(() => {
    setDraftPages(createStoryOutlineDraft(result.pages));
    setSubmitted(false);
    setSaveError(null);
  }, [result.storyId]);

  function handleTextChange(
    pageNumber: number,
    field: StoryOutlineTextField,
    value: string,
  ) {
    setDraftPages((current) =>
      updateStoryOutlineText(current, pageNumber, field, value),
    );
    setSaveError(null);
  }

  async function handleConfirm() {
    setSubmitted(true);
    setSaveError(null);
    if (!validation.valid) return;

    setSaving(true);
    try {
      await onConfirm(createStoryOutlineDraft(draftPages));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : text.saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.shell} aria-labelledby="story-outline-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}>{text.eyebrow}</p>
        <h1 id="story-outline-title">{text.title}</h1>
        <p>{text.description}</p>
      </header>

      <div className={styles.pages}>
        {draftPages.map((page) => (
          <section className={styles.pageCard} key={page.page}>
            <div className={styles.pageHeading}>
              <h2>{text.page(page.page)}</h2>
              <span>{text.pageProgress(page.page)}</span>
            </div>

            {editorFields
              .filter((editorField) => editorField.page === page.page)
              .map((editorField) => {
              const { field, inputId, value } = editorField;
              const invalid = Boolean(
                submitted &&
                  validation.missingFieldsByPage[page.page]?.includes(field),
              );

              return (
                <label className={styles.field} htmlFor={inputId} key={field}>
                  <span>{field === "zhText" ? text.zhText : text.enText}</span>
                  <textarea
                    id={inputId}
                    value={value}
                    required
                    aria-invalid={invalid}
                    aria-describedby={invalid ? `${inputId}-error` : undefined}
                    onChange={(event) =>
                      handleTextChange(page.page, field, event.target.value)
                    }
                  />
                  {invalid ? (
                    <p className={styles.fieldError} id={`${inputId}-error`}>
                      {text.required}
                    </p>
                  ) : null}
                </label>
              );
            })}
          </section>
        ))}
      </div>

      {submitted && !validation.structureValid ? (
        <p className={styles.notice} role="alert">
          {text.invalidStructure}
        </p>
      ) : null}
      {saveError ? (
        <p className={styles.notice} role="alert">
          {saveError}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button
          className={styles.backButton}
          type="button"
          disabled={saving}
          onClick={onBack}
        >
          {text.back}
        </button>
        <button
          className={styles.confirmButton}
          type="button"
          disabled={saving}
          onClick={() => void handleConfirm()}
        >
          {saving ? text.confirming : text.confirm}
        </button>
      </div>
    </section>
  );
}
