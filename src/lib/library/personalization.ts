import {
  getBook,
  getSeries,
} from "@/lib/library";
import { resolveLibraryBookMetadata } from "@/lib/library/metadata";
import type {
  AgeGroup,
  LibraryStorySpec,
} from "@/types";

const TONE_BY_CATEGORY: Record<string, string> = {
  idiom: "清晰、温暖、有具体行动，不说教",
  classic: "有冒险感但不刺激，保留经典故事的勇气与幽默",
  science: "好奇、准确、易懂，用生活化观察解释知识",
  bedtime: "安静、舒缓、低刺激，适合睡前共读",
  "family-growth": "真实、温柔、尊重家庭事实与关系",
};

function compact(value: string | undefined, maxLength: number) {
  return (value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function resolveAgeGroup(min: number, max: number): AgeGroup {
  if (max <= 3) return "2-3";
  if (min >= 6) return "6-8";
  return "4-5";
}

export function getLibraryStorySpecByContentId(
  contentId: string,
): LibraryStorySpec | null {
  const [seriesId, bookId, ...rest] = contentId.split("/");
  if (!seriesId || !bookId || rest.length > 0) return null;

  const series = getSeries(seriesId);
  const book = getBook(seriesId, bookId);
  if (!series || !book || book.comingSoon) return null;

  const metadata = resolveLibraryBookMetadata(book);
  if (!metadata.personalizationEnabled) return null;

  const theme = compact(
    book.question ||
      book.idiomMeaning?.zh ||
      book.moral?.zh ||
      `${book.title}：${book.subtitle}`,
    220,
  );

  return {
    version: 1,
    sourceLibraryBookId: `${seriesId}/${bookId}`,
    sourceTitle: book.title,
    sourceSeriesId: series.id,
    sourceSeriesTitle: series.title,
    sourceSeriesOrder: metadata.seriesOrder,
    category: metadata.category,
    ageGroup: resolveAgeGroup(metadata.ageRange.min, metadata.ageRange.max),
    theme,
    tone: TONE_BY_CATEGORY[metadata.category] || TONE_BY_CATEGORY.classic,
    storyBeats: book.pages.map((page) => ({
      page: page.page,
      narrativeBeat: compact(page.zhText, 260),
      scene: compact(page.illustrationPrompt, 360),
    })),
    replaceableRoles: ["孩子主角", "同行角色"],
    tags: [...metadata.tags],
  };
}

export function getLibraryPersonalizationContext(contentId: string) {
  const storySpec = getLibraryStorySpecByContentId(contentId);
  if (!storySpec) return null;

  return {
    storySpec,
    suggestedPrompt: compact(
      `让孩子成为《${storySpec.sourceTitle}》的主角，保留原故事主题和结构，用我家的角色重新讲`,
      100,
    ),
  };
}
