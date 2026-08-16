import type { LibraryBookSummary } from "@/lib/library/catalog";
import type { GenerateResponse } from "@/types";
import type { LibraryCategory } from "@/types/library";

export type LibraryAgeFilter = "all" | "2-3" | "4-5" | "6-8" | "9-12";
export type LibraryDurationFilter = "all" | "short" | "medium" | "long";
export type LibraryLanguageFilter = "all" | "zh" | "en" | "bilingual";

export type LibraryDiscoveryFilters = {
  category: LibraryCategory | "all";
  age: LibraryAgeFilter;
  duration: LibraryDurationFilter;
  language: LibraryLanguageFilter;
  seriesId: string | "all";
  theme: string | "all";
  bedtimeOnly: boolean;
};

export const DEFAULT_LIBRARY_DISCOVERY_FILTERS: LibraryDiscoveryFilters = {
  category: "all",
  age: "all",
  duration: "all",
  language: "all",
  seriesId: "all",
  theme: "all",
  bedtimeOnly: false,
};

export const LIBRARY_AGE_FILTER_OPTIONS: Array<{
  value: LibraryAgeFilter;
  label: string;
}> = [
  { value: "all", label: "全部年龄" },
  { value: "2-3", label: "2-3 岁" },
  { value: "4-5", label: "4-5 岁" },
  { value: "6-8", label: "6-8 岁" },
  { value: "9-12", label: "9-12 岁" },
];

const AGE_RANGES: Record<Exclude<LibraryAgeFilter, "all">, {
  min: number;
  max: number;
}> = {
  "2-3": { min: 2, max: 3 },
  "4-5": { min: 4, max: 5 },
  "6-8": { min: 6, max: 8 },
  "9-12": { min: 9, max: 12 },
};

const PRIVATE_THEME_LABELS: Record<GenerateResponse["input"]["theme"], string> = {
  courage: "勇气冒险",
  friendship: "友谊分享",
  nature: "自然探索",
  family: "家庭成长",
  fear: "克服害怕",
  creativity: "想象创造",
  custom: "自定义故事",
};

function rangesOverlap(
  left: { min: number; max: number },
  right: { min: number; max: number },
) {
  return left.min <= right.max && right.min <= left.max;
}

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function createSearchText(values: Array<string | undefined | null>) {
  return normalizeSearchText(values.filter(Boolean).join(" "));
}

export function matchesSearchText(searchText: string, query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  const normalizedSearchText = normalizeSearchText(searchText);
  return normalizedQuery
    .split(" ")
    .filter(Boolean)
    .every((token) => normalizedSearchText.includes(token));
}

function matchesAge(
  book: LibraryBookSummary,
  age: LibraryDiscoveryFilters["age"],
) {
  if (age === "all") return true;
  return rangesOverlap(book.metadata.ageRange, AGE_RANGES[age]);
}

function matchesDuration(
  estimatedMinutes: number,
  duration: LibraryDurationFilter,
) {
  if (duration === "all") return true;
  if (duration === "short") return estimatedMinutes <= 5;
  if (duration === "medium") {
    return estimatedMinutes >= 6 && estimatedMinutes <= 10;
  }
  return estimatedMinutes > 10;
}

function matchesLanguage(
  book: LibraryBookSummary,
  language: LibraryLanguageFilter,
) {
  if (language === "all") return true;
  if (language === "bilingual") {
    return (
      book.metadata.languages.includes("zh") &&
      book.metadata.languages.includes("en")
    );
  }
  return book.metadata.languages.includes(language);
}

export function filterLibraryBooks(
  books: LibraryBookSummary[],
  input: {
    query?: string;
    filters?: Partial<LibraryDiscoveryFilters>;
  } = {},
) {
  const filters = {
    ...DEFAULT_LIBRARY_DISCOVERY_FILTERS,
    ...input.filters,
  };

  return books.filter((book) => {
    if (book.comingSoon) return false;
    if (!matchesSearchText(book.searchText, input.query || "")) return false;
    if (
      filters.category !== "all" &&
      book.metadata.category !== filters.category
    ) {
      return false;
    }
    if (!matchesAge(book, filters.age)) return false;
    if (!matchesDuration(book.metadata.estimatedMinutes, filters.duration)) {
      return false;
    }
    if (!matchesLanguage(book, filters.language)) return false;
    if (filters.seriesId !== "all" && book.seriesId !== filters.seriesId) {
      return false;
    }
    if (
      filters.theme !== "all" &&
      !book.metadata.tags.includes(filters.theme)
    ) {
      return false;
    }
    if (filters.bedtimeOnly && !book.metadata.bedtimeSuitable) return false;
    return true;
  });
}

export function getUtcDayNumber(date = new Date()) {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) /
      86_400_000,
  );
}

export type TonightRecommendation = {
  book: LibraryBookSummary;
  explanation: string;
};

export function selectTonightRecommendation(
  books: LibraryBookSummary[],
  input: {
    age?: LibraryAgeFilter;
    date?: Date;
  } = {},
): TonightRecommendation | null {
  const publishedBooks = books.filter((book) => !book.comingSoon);
  if (publishedBooks.length === 0) return null;

  const age = input.age || "all";
  const ageMatched = (book: LibraryBookSummary) => matchesAge(book, age);
  const tiers: Array<{
    books: LibraryBookSummary[];
    explanation: string;
  }> = age === "all"
    ? [
        {
          books: publishedBooks.filter(
            (book) => book.metadata.featured && book.metadata.bedtimeSuitable,
          ),
          explanation: "从精选且适合睡前的故事中按日期轮换。",
        },
        {
          books: publishedBooks.filter((book) => book.metadata.featured),
          explanation: "从编辑精选故事中按日期轮换。",
        },
        {
          books: publishedBooks,
          explanation: "从已发布馆藏中按日期轮换。",
        },
      ]
    : [
        {
          books: publishedBooks.filter(
            (book) =>
              ageMatched(book) &&
              book.metadata.featured &&
              book.metadata.bedtimeSuitable,
          ),
          explanation: `优先选择适合 ${age} 岁、编辑精选且适合睡前的故事。`,
        },
        {
          books: publishedBooks.filter(
            (book) => ageMatched(book) && book.metadata.featured,
          ),
          explanation: `从适合 ${age} 岁的编辑精选故事中按日期轮换。`,
        },
        {
          books: publishedBooks.filter(
            (book) => ageMatched(book) && book.metadata.bedtimeSuitable,
          ),
          explanation: `从适合 ${age} 岁且适合睡前的故事中按日期轮换。`,
        },
        {
          books: publishedBooks.filter(ageMatched),
          explanation: `从适合 ${age} 岁的馆藏中按日期轮换。`,
        },
        {
          books: publishedBooks.filter(
            (book) => book.metadata.featured && book.metadata.bedtimeSuitable,
          ),
          explanation: `暂时没有精确匹配 ${age} 岁的精选内容，已从睡前精选中轮换。`,
        },
        {
          books: publishedBooks,
          explanation: "从已发布馆藏中按日期轮换。",
        },
      ];

  const selectedTier = tiers.find((tier) => tier.books.length > 0);
  if (!selectedTier) return null;
  const candidates = [...selectedTier.books].sort((left, right) =>
    left.contentId.localeCompare(right.contentId),
  );
  const day = getUtcDayNumber(input.date);
  return {
    book: candidates[((day % candidates.length) + candidates.length) % candidates.length],
    explanation: selectedTier.explanation,
  };
}

export type LibraryRecommendation = {
  book: LibraryBookSummary;
  reason: string;
};

export function getLibraryRecommendations(
  current: LibraryBookSummary,
  books: LibraryBookSummary[],
  limit = 4,
): LibraryRecommendation[] {
  return books
    .filter((book) => !book.comingSoon && book.contentId !== current.contentId)
    .map((book) => {
      const sharedTags = book.metadata.tags.filter((tag) =>
        current.metadata.tags.includes(tag),
      );
      const nextInSeries =
        book.seriesId === current.seriesId &&
        book.metadata.seriesOrder === current.metadata.seriesOrder + 1;
      const sameSeries = book.seriesId === current.seriesId;
      const seriesDistance = Math.abs(
        book.metadata.seriesOrder - current.metadata.seriesOrder,
      );
      const similarAge = rangesOverlap(
        book.metadata.ageRange,
        current.metadata.ageRange,
      );
      const durationDifference = Math.abs(
        book.metadata.estimatedMinutes - current.metadata.estimatedMinutes,
      );
      const score =
        (nextInSeries
          ? 150
          : sameSeries
            ? 110 - Math.min(60, seriesDistance)
            : 0) +
        Math.min(3, sharedTags.length) * 18 +
        (book.metadata.category === current.metadata.category ? 14 : 0) +
        (similarAge ? 8 : 0) +
        Math.max(0, 5 - durationDifference) +
        (book.metadata.featured ? 1 : 0);
      const reason = nextInSeries
        ? "同系列下一本"
        : sameSeries
          ? "同系列故事"
          : sharedTags[0]
            ? `同主题 · ${sharedTags[0]}`
            : similarAge
              ? "适合相近年龄"
              : "阅读时长相近";
      return { book, reason, score };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.book.contentId.localeCompare(right.book.contentId),
    )
    .slice(0, Math.max(0, limit))
    .map(({ book, reason }) => ({ book, reason }));
}

export function createPrivateStorySearchText(result: GenerateResponse) {
  return createSearchText([
    result.coverTitle,
    result.input.childName,
    PRIVATE_THEME_LABELS[result.input.theme],
    result.input.customTheme,
    result.input.sourceLibraryBookId,
    result.input.familyCharacters?.map((character) => character.name).join(" "),
  ]);
}

export function searchPrivateStoryItems<T extends { searchText: string }>(
  items: T[],
  query: string,
) {
  if (!normalizeSearchText(query)) return [];
  return items.filter((item) => matchesSearchText(item.searchText, query));
}
