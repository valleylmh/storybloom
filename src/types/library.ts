import type { StoryPage } from "@/types";

export interface BilingualText {
  zh: string;
  en: string;
}

export interface LibraryPoemMetadata {
  dynasty: string;
  author: string;
  originalLines: string[];
  englishLines: string[];
  appreciation: BilingualText;
}

export interface LibraryClassicMetadata {
  /** Name of the source classic, e.g. 《三字经》. */
  workTitle: string;
  /** Maintains the reviewed punctuation and line breaks used for read-aloud. */
  originalLines: string[];
  /** Child-friendly meaning rather than a word-for-word translation. */
  childExplanation: BilingualText;
  /** Chinese context for caregivers when an old idea needs modern framing. */
  historicalContext: string;
}

export interface LibraryParentGuide {
  /** The one parenting capability this book is designed to practise. */
  goal: string;
  /** A reminder that prevents the classic from becoming pressure or preaching. */
  reminder: string;
  questions: string[];
  activity: string;
  ageTips: {
    age4to5: string;
    age6to8: string;
  };
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

export type LibraryCategory =
  | "idiom"
  | "classic"
  | "science"
  | "poetry"
  | "bedtime"
  | "family-growth";

export interface LibraryBookMetadata {
  category: LibraryCategory;
  ageRange: { min: number; max: number };
  estimatedMinutes: number;
  languages: Array<"zh" | "en">;
  seriesId: string;
  seriesOrder: number;
  personalizationEnabled: boolean;
  tags: string[];
  featured: boolean;
  bedtimeSuitable: boolean;
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
  /** Original poem, authorship, translation, and child-friendly appreciation. */
  poem?: LibraryPoemMetadata;
  /** Reviewed source excerpt and modern framing for a classical text. */
  classic?: LibraryClassicMetadata;
  /** Chinese-only caregiver notes shown after the child-facing story. */
  parentGuide?: LibraryParentGuide;
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
  /** Optional source overrides; UI always consumes resolved metadata. */
  metadata?: Partial<LibraryBookMetadata>;
}
