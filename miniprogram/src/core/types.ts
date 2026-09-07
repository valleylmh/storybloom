export interface Series { id: string; title: string }
export interface BookSummary {
  readerPath?: string;
  id: string;
  seriesId: string;
  seriesTitle: string;
  title: string;
  subtitle: string;
  ageLabel: string;
  pageCount: number;
  cover: string;
  searchText: string;
}
export interface BookPage {
  zh: string;
  en: string;
  image: string;
  audio: { zh: string; en: string };
}
export interface GuideSection { title: string; body: string }
export interface BookAudio { url: string; pageStarts: number[]; duration: number; contentHash: string }
export interface Book { chineseAudio?: BookAudio; narrationEndpoint?: string; id: string; title: string; pages: BookPage[]; guide: GuideSection[] }
export interface Catalog { version: 1; series: Series[]; books: BookSummary[] }
export type Language = "zh" | "en";
export type AudioMode = Language | "both";
export interface ReadingRecord { pageIndex: number; updatedAt: number }
export interface ShelfState {
  version: 1;
  favorites: Record<string, number>;
  progress: Record<string, ReadingRecord>;
}
