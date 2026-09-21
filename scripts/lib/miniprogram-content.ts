import type { LibraryBook, LibrarySeries } from "../../src/types/library";
import { createLibraryBookSummary } from "../../src/lib/library/catalog";
import type { Book, Catalog, GuideSection } from "../../miniprogram/src/core/types";

/** Paths to audio that has already been generated and uploaded; never provider signed URLs. */
export type AudioManifest = Record<string, Array<{ zh?: string; en?: string }>>;
export interface MiniExport {
  catalog: Catalog;
  books: Record<string, Book>;
  images: Array<{ source: string; destination: string }>;
  audioSegments: number;
}

export function normalizeMediaBase(value: string): string {
  if (!value) return "";
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("mediaBaseUrl 必须是无凭证、查询参数或片段的 HTTPS 地址");
  }
  return url.toString().replace(/\/+$/, "");
}

export function publicMediaPath(path: string): string {
  const clean = path.replace(/^\//, "");
  if (!/^(library|audio)\/[a-zA-Z0-9_./-]+$/.test(clean) || clean.split("/").some(part => part === ".." || part === "." || !part)) {
    throw new Error("媒体资源必须使用 library/ 或 audio/ 下的相对路径");
  }
  return clean;
}

function guideFor(book: LibraryBook): GuideSection[] {
  const guide: GuideSection[] = [];
  const add = (title: string, body?: string) => { if (body?.trim()) guide.push({ title, body }); };
  add("关于这本书", book.subtitle);
  add("故事出处", book.origin);
  add(book.metadata?.tags?.includes("谚语故事") ? "谚语释义" : "成语释义", book.idiomMeaning && `${book.idiomMeaning.zh}\n\n${book.idiomMeaning.en}`);
  add("故事里的小启发", book.moral && `${book.moral.zh}\n\n${book.moral.en}`);
  if (book.poem) {
    add("原诗", `${book.poem.dynasty} · ${book.poem.author}\n\n${book.poem.originalLines.join("\n")}\n\n${book.poem.englishLines.join("\n")}`);
    add("读一读，想一想", `${book.poem.appreciation.zh}\n\n${book.poem.appreciation.en}`);
  }
  if (book.classic) {
    add("经典原文", `${book.classic.workTitle}\n\n${book.classic.originalLines.join("\n")}`);
    add("说给孩子听", `${book.classic.childExplanation.zh}\n\n${book.classic.childExplanation.en}`);
    add("理解古今的不同", book.classic.historicalContext);
  }
  if (book.parentGuide) {
    const parent = book.parentGuide;
    add("家长锦囊", `${parent.goal}\n\n${parent.reminder}`);
    add("一起聊一聊", parent.questions.map((question, index) => `${index + 1}. ${question}`).join("\n\n"));
    add("一起做一做", parent.activity);
    add("不同年龄怎么读", `4–5 岁\n${parent.ageTips.age4to5}\n\n6–8 岁\n${parent.ageTips.age6to8}`);
  }
  return guide;
}

export function exportMiniContent(
  series: LibrarySeries[],
  getBooks: (id: string) => LibraryBook[],
  mediaBase = "",
  audio: AudioManifest = {},
): MiniExport {
  const base = normalizeMediaBase(mediaBase);
  const url = (path: string) => {
    const safe = publicMediaPath(path);
    return base ? `${base}/${safe}` : "";
  };
  const result: MiniExport = { catalog: { version: 1, series: [], books: [] }, books: {}, images: [], audioSegments: 0 };
  for (const item of series) {
    if (item.comingSoon) continue;
    const published = getBooks(item.id).filter(book => !book.comingSoon && book.pages.length > 0 &&
      book.pages.every(page => page.imageStatus === "complete" && page.imageUrl))
      .sort((a, b) => a.order - b.order);
    if (!published.length) continue;
    result.catalog.series.push({ id: item.id, title: item.title });
    for (const book of published) {
      const summary = createLibraryBookSummary(item, book);
      const id = summary.contentId;
      if (result.books[id]) throw new Error(`重复绘本 ID: ${id}`);
      result.catalog.books.push({
        id, seriesId: item.id, seriesTitle: item.title,
        title: book.episodeNumber ? `第 ${book.episodeNumber} 回 · ${book.title}` : book.title,
        subtitle: book.subtitle, ageLabel: book.ageLabel,
        pageCount: book.pages.length, cover: url(book.pages[0].imageUrl!),
        searchText: summary.searchText,
      });
      result.books[id] = {
        id, title: book.title, guide: guideFor(book),
        pages: book.pages.map((page, index) => {
          const image = publicMediaPath(page.imageUrl!);
          result.images.push({ source: `public/${image}`, destination: image });
          const segments = audio[id]?.[index];
          const audioUrl = (language: "zh" | "en") => {
            const path = segments?.[language];
            if (!path) return "";
            if (!path.endsWith(".mp3")) throw new Error(`音频必须是 MP3: ${id} 第 ${index + 1} 页`);
            const resolved = url(path);
            if (resolved) result.audioSegments++;
            return resolved;
          };
          return { zh: page.zhText, en: page.enText, image: url(image), audio: { zh: audioUrl("zh"), en: audioUrl("en") } };
        }),
      };
    }
  }
  for (const [id, pages] of Object.entries(audio)) {
    if (!result.books[id] || !Array.isArray(pages) || pages.length !== result.books[id].pages.length) {
      throw new Error(`音频清单的绘本或页数不匹配: ${id}`);
    }
  }
  return result;
}
