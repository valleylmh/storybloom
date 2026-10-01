import type { LibraryBook, LibrarySeries } from "@/types/library";
import firstDrafts from "../../../content-drafts/chengyu/chengyu-51-60.json";
import nextDrafts from "../../../content-drafts/chengyu/chengyu-61-65.json";
import latestDrafts from "../../../content-drafts/chengyu/chengyu-66-70.json";

// Keep the reviewed artwork and narration paths stable when changing series.
export const YANYU_BOOKS: LibraryBook[] = [...firstDrafts, ...nextDrafts, ...latestDrafts]
  .filter(draft => draft.metadata.tags.includes("谚语故事"))
  .map((draft, index) => ({
    ...draft,
    seriesId: "yanyu",
    order: index + 1,
    metadata: { ...draft.metadata, category: "proverb", seriesId: "yanyu", seriesOrder: index + 1 },
    pages: draft.pages.map((page, pageIndex) => ({
      page: pageIndex + 1,
      zhText: page.zh,
      enText: page.en,
      illustrationPrompt: page.prompt,
      imageUrl: `/library/chengyu/${draft.id}/${pageIndex + 1}.webp`,
      imageStatus: "complete",
    })),
  }));

export const YANYU_SERIES: LibrarySeries = {
  id: "yanyu",
  title: "谚语故事",
  subtitle: "日常谚语，藏在温暖的小故事里",
  description: "把耳熟能详的生活谚语变成中英双语绘本。跟着可爱的小动物，在温暖的日常故事里理解合作、耐心、珍惜与感恩。",
  accent: "#527d59",
  ageRange: "4-8 岁",
  bookCount: YANYU_BOOKS.length,
};
