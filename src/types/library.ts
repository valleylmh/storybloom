import type { StoryPage } from "@/types";

export interface BilingualText {
  zh: string;
  en: string;
}

/** Reserved for task F (post-reading quiz). Type only for now — no UI. */
export interface LibraryQuizQuestion {
  question: string;
  questionEn?: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface LibrarySeries {
  /** URL slug, e.g. "chengyu" */
  id: string;
  title: string;
  subtitle: string;
  /** Series page intro, also used as SEO description */
  description: string;
  /** Optional until cover art exists; pages render an accent-colored fallback when absent */
  coverImage?: string;
  accent: string;
  ageRange: string;
  bookCount: number;
  comingSoon?: boolean;
}

export interface LibraryBook {
  /** URL slug, e.g. "shou-zhu-dai-tu" */
  id: string;
  seriesId: string;
  /** e.g. 「守株待兔」 */
  title: string;
  subtitle: string;
  /** Source of the classic tale, e.g. 《韩非子·五蠹》 */
  origin?: string;
  /** One-line takeaway, bilingual */
  moral?: BilingualText;
  /** Idiom meaning with English translation (chengyu series only) */
  idiomMeaning?: BilingualText;
  /** Reuses the shared bilingual page structure from @/types */
  pages: StoryPage[];
  ageLabel: string;
  publishedAt: string;
  /** Position within the series */
  order: number;
  /** Serialized episode number (e.g. 西游记 第 N 回); series with episodes render 「第 N 回」 */
  episodeNumber?: number;
  /** The original child question (科普问答 series), used in SEO titles */
  question?: string;
  /** Listed on the series page but not yet readable */
  comingSoon?: boolean;
  quiz?: LibraryQuizQuestion[];
}
