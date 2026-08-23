import type {
  LibraryBook,
  LibraryBookMetadata,
  LibraryCategory,
} from "@/types/library";

const SERIES_DEFAULTS: Record<
  string,
  {
    category: LibraryCategory;
    tags: string[];
    bedtimeSuitable: boolean;
  }
> = {
  chengyu: {
    category: "idiom",
    tags: ["成语", "经典故事", "品格启蒙"],
    bedtimeSuitable: true,
  },
  xiyouji: {
    category: "classic",
    tags: ["西游记", "经典名著", "连续故事"],
    bedtimeSuitable: true,
  },
  haoqi: {
    category: "science",
    tags: ["科普", "好奇心", "自然启蒙"],
    bedtimeSuitable: false,
  },
  tangshi: {
    category: "poetry",
    tags: ["唐诗", "古诗", "传统文化", "意境启蒙"],
    bedtimeSuitable: true,
  },
};

export const LIBRARY_CATEGORY_LABELS: Record<LibraryCategory, string> = {
  idiom: "成语故事",
  classic: "经典故事",
  science: "科普启蒙",
  poetry: "古诗启蒙",
  bedtime: "睡前故事",
  "family-growth": "家庭成长",
};

function parseAgeRange(ageLabel: string) {
  const values = ageLabel.match(/\d+/g)?.map(Number).filter(Number.isFinite);
  if (!values?.length) return { min: 4, max: 8 };
  return {
    min: Math.max(0, values[0]),
    max: Math.max(values[0], values[1] ?? values[0]),
  };
}

export function resolveLibraryBookMetadata(
  book: LibraryBook,
): LibraryBookMetadata {
  const defaults = SERIES_DEFAULTS[book.seriesId] ?? {
    category: "classic" as const,
    tags: ["精选故事"],
    bedtimeSuitable: true,
  };
  const overrides = book.metadata;
  return {
    category: overrides?.category ?? defaults.category,
    ageRange: overrides?.ageRange ?? parseAgeRange(book.ageLabel),
    estimatedMinutes:
      overrides?.estimatedMinutes ??
      Math.max(3, Math.ceil(Math.max(1, book.pages.length) * 0.6)),
    languages: overrides?.languages ?? ["zh", "en"],
    seriesId: overrides?.seriesId ?? book.seriesId,
    seriesOrder:
      overrides?.seriesOrder ?? book.episodeNumber ?? book.order,
    personalizationEnabled:
      overrides?.personalizationEnabled ?? !book.comingSoon,
    tags: Array.from(new Set(overrides?.tags ?? defaults.tags)),
    featured: overrides?.featured ?? (!book.comingSoon && book.order <= 3),
    bedtimeSuitable:
      overrides?.bedtimeSuitable ?? defaults.bedtimeSuitable,
  };
}

export function formatLibraryLanguages(
  languages: LibraryBookMetadata["languages"],
) {
  if (languages.includes("zh") && languages.includes("en")) return "中英双语";
  if (languages.includes("en")) return "English";
  return "中文";
}
