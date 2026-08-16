"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, MagnifyingGlass, Sparkle, X } from "@phosphor-icons/react";
import { useFavorites } from "@/hooks/useFavorites";
import { useAuth } from "@/hooks/useAuth";
import { createFavoriteKey, FAVORITES_CHANGED_EVENT } from "@/lib/favorites";
import type { LibraryBookSummary } from "@/lib/library/catalog";
import {
  createPrivateStorySearchText,
  DEFAULT_LIBRARY_DISCOVERY_FILTERS,
  filterLibraryBooks,
  LIBRARY_AGE_FILTER_OPTIONS,
  normalizeSearchText,
  searchPrivateStoryItems,
  selectTonightRecommendation,
  type LibraryAgeFilter,
  type LibraryDiscoveryFilters,
  type LibraryDurationFilter,
  type LibraryLanguageFilter,
} from "@/lib/library/discovery";
import { LIBRARY_CATEGORY_LABELS } from "@/lib/library/metadata";
import { localStoryRepository } from "@/lib/repositories/local-story-repository";
import { createCloudStoryRepository } from "@/lib/repositories/cloud-story-repository";
import type { SavedStory } from "@/lib/repositories/story-repository";
import {
  listReadingProgress,
  READING_PROGRESS_CHANGED_EVENT,
  type ReadingProgressRecord,
} from "@/lib/reading-progress";
import type { LibraryCategory } from "@/types/library";
import { mergeStoryCopies } from "@/components/account/device-cloud-story-library-model";
import ReadingSyncControl from "@/components/library/ReadingSyncControl";
import LibraryCatalogCard from "@/components/library/LibraryCatalogCard";

type SeriesSummary = {
  id: string;
  title: string;
  subtitle: string;
};

type PrivateStorySearchItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  actionLabel: string;
  sourceLabel: string;
  coverImage?: string;
  searchText: string;
};

const CATEGORY_ORDER: LibraryCategory[] = [
  "idiom",
  "classic",
  "science",
  "bedtime",
  "family-growth",
];
const TONIGHT_AGE_PREFERENCE_KEY = "storybloom.library.tonight-age.v1";
const SERIES_PREVIEW_COUNT = 4;

function readingMap(records: ReadingProgressRecord[]) {
  return new Map(
    records.map((record) => [record.contentId, record] as const),
  );
}

function privateSearchItem(
  local: SavedStory | undefined,
  cloud: SavedStory | undefined,
): PrivateStorySearchItem | null {
  const story = local || cloud;
  if (!story) return null;
  const firstImage = story.result.pages.find(
    (page) => page.imageStatus === "complete" && page.imageUrl,
  )?.imageUrl;
  const hasLocalCopy = Boolean(local);
  const hasCloudCopy = Boolean(cloud);
  return {
    id: story.clientStoryId,
    title: story.result.coverTitle,
    subtitle:
      story.result.input.customTheme?.trim() ||
      `${story.result.input.childName}的家庭专属故事`,
    href: hasLocalCopy
      ? `/?book=${encodeURIComponent(story.clientStoryId)}`
      : "/me/books",
    actionLabel: hasLocalCopy ? "打开私人绘本" : "去书架保存到本机并打开",
    sourceLabel:
      hasLocalCopy && hasCloudCopy
        ? "私人绘本 · 本机和云端"
        : hasLocalCopy
          ? "私人绘本 · 仅本机"
          : "私人绘本 · 仅云端",
    ...(firstImage ? { coverImage: firstImage } : {}),
    searchText: createPrivateStorySearchText(story.result),
  };
}

export default function LibraryCatalogExperience({
  books,
  series,
}: {
  books: LibraryBookSummary[];
  series: SeriesSummary[];
}) {
  const { supabase, user, loading: authLoading } = useAuth();
  const [progressRecords, setProgressRecords] = useState<
    ReadingProgressRecord[]
  >([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<LibraryDiscoveryFilters>({
    ...DEFAULT_LIBRARY_DISCOVERY_FILTERS,
  });
  const [tonightAge, setTonightAge] = useState<LibraryAgeFilter>("all");
  const [visibleCount, setVisibleCount] = useState(24);
  const [expandedSeriesIds, setExpandedSeriesIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [privateStories, setPrivateStories] = useState<
    PrivateStorySearchItem[]
  >([]);
  const [privateLoading, setPrivateLoading] = useState(false);
  const [privateError, setPrivateError] = useState("");
  const loadedPrivateKeyRef = useRef<string | null>(null);
  const privateRequestIdRef = useRef(0);
  const { records: favoriteRecords, keys: favoriteKeys, toggle } =
    useFavorites();

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void listReadingProgress().then((records) => {
        if (active) setProgressRecords(records);
      });
    };
    refresh();
    window.addEventListener(READING_PROGRESS_CHANGED_EVENT, refresh);
    window.addEventListener(FAVORITES_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener(READING_PROGRESS_CHANGED_EVENT, refresh);
      window.removeEventListener(FAVORITES_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(TONIGHT_AGE_PREFERENCE_KEY);
      if (
        LIBRARY_AGE_FILTER_OPTIONS.some((option) => option.value === stored)
      ) {
        setTonightAge(stored as LibraryAgeFilter);
      }
    } catch {
      // A blocked localStorage must not prevent anonymous library use.
    }
  }, []);

  const privateDataKey = user?.id || "anonymous";
  useEffect(() => {
    loadedPrivateKeyRef.current = null;
    privateRequestIdRef.current += 1;
    setPrivateStories([]);
    setPrivateError("");
    setPrivateLoading(false);
  }, [privateDataKey]);

  const normalizedQuery = normalizeSearchText(query);
  useEffect(() => {
    if (!normalizedQuery) {
      setPrivateLoading(false);
      return;
    }
    if (authLoading) return;
    if (loadedPrivateKeyRef.current === privateDataKey) return;

    const requestId = ++privateRequestIdRef.current;
    setPrivateLoading(true);
    setPrivateError("");
    const timer = window.setTimeout(() => {
      const localTask = localStoryRepository.list();
      const cloudTask =
        user && supabase
          ? createCloudStoryRepository(supabase, user.id).list()
          : Promise.resolve([]);
      void Promise.allSettled([localTask, cloudTask]).then(
        ([localResult, cloudResult]) => {
          if (privateRequestIdRef.current !== requestId) return;
          const localStories =
            localResult.status === "fulfilled" ? localResult.value : [];
          const cloudStories =
            cloudResult.status === "fulfilled" ? cloudResult.value : [];
          const items = mergeStoryCopies(localStories, cloudStories)
            .map((row) => privateSearchItem(row.local, row.cloud))
            .filter((item): item is PrivateStorySearchItem => Boolean(item));
          setPrivateStories(items);
          loadedPrivateKeyRef.current = privateDataKey;
          setPrivateLoading(false);
          if (
            localResult.status === "rejected" ||
            cloudResult.status === "rejected"
          ) {
            setPrivateError(
              localStories.length || cloudStories.length
                ? "部分私人绘本暂时无法读取，已显示当前可用结果。"
                : "私人书架暂时无法读取，请稍后重试。",
            );
          }
        },
      );
    }, 180);

    return () => window.clearTimeout(timer);
  }, [authLoading, normalizedQuery, privateDataKey, supabase, user]);

  useEffect(() => {
    setVisibleCount(24);
  }, [
    filters.age,
    filters.bedtimeOnly,
    filters.category,
    filters.duration,
    filters.language,
    filters.seriesId,
    filters.theme,
    normalizedQuery,
  ]);

  const publishedBooks = useMemo(
    () => books.filter((book) => !book.comingSoon),
    [books],
  );
  const progressByContent = useMemo(
    () => readingMap(progressRecords),
    [progressRecords],
  );
  const bookByContent = useMemo(
    () => new Map(publishedBooks.map((book) => [book.contentId, book] as const)),
    [publishedBooks],
  );
  const continueReading = progressRecords
    .filter((record) => !record.completedAt && record.progressPercent > 0)
    .map((record) => bookByContent.get(record.contentId))
    .filter((book): book is LibraryBookSummary => Boolean(book))
    .slice(0, 4);
  const recentBooks = progressRecords
    .map((record) => bookByContent.get(record.contentId))
    .filter((book): book is LibraryBookSummary => Boolean(book))
    .slice(0, 4);
  const favoriteBooks = favoriteRecords
    .map((record) => bookByContent.get(record.contentId))
    .filter((book): book is LibraryBookSummary => Boolean(book))
    .slice(0, 4);
  const tonightRecommendation = selectTonightRecommendation(publishedBooks, {
    age: tonightAge,
  });
  const filteredBooks = filterLibraryBooks(publishedBooks, {
    query,
    filters,
  });
  const visibleBooks = filteredBooks.slice(0, visibleCount);
  const privateResults = searchPrivateStoryItems(privateStories, query);
  const searchActive = Boolean(normalizedQuery);
  const themeOptions = useMemo(
    () =>
      Array.from(
        new Set(publishedBooks.flatMap((book) => book.metadata.tags)),
      ).sort((left, right) => left.localeCompare(right, "zh-CN")),
    [publishedBooks],
  );
  const hasActiveFilters = Object.entries(filters).some(([key, value]) =>
    key === "bedtimeOnly" ? value === true : value !== "all",
  );

  const renderCard = (
    book: LibraryBookSummary,
    compact = false,
    minimal = false,
    imagePriority = false,
  ) => (
    <LibraryCatalogCard
      key={book.contentId}
      book={book}
      progress={progressByContent.get(book.contentId)}
      favorite={favoriteKeys.has(createFavoriteKey("library", book.contentId))}
      onToggleFavorite={() => toggle("library", book.contentId)}
      compact={compact}
      minimal={minimal}
      imagePriority={imagePriority}
    />
  );

  const renderQuickItem = (
    book: LibraryBookSummary,
    showFavoriteAction = false,
  ) => {
    const progress = progressByContent.get(book.contentId);
    const status = progress?.completedAt
      ? "已读"
      : progress && progress.progressPercent > 0
        ? `当前 · 第 ${progress.pageIndex + 1} 页`
        : null;
    const title = book.episodeNumber
      ? `第 ${book.episodeNumber} 回 · ${book.title}`
      : book.title;
    const favorite = favoriteKeys.has(
      createFavoriteKey("library", book.contentId),
    );

    return (
      <article key={book.contentId} className="library-quick-list-item">
        <Link href={book.href}>
          <div
            className="library-quick-list-cover"
            style={{ backgroundColor: `${book.seriesAccent}22` }}
          >
            {book.coverImage ? (
              <Image
                src={book.coverImage}
                alt=""
                fill
                sizes="72px"
              />
            ) : (
              <span style={{ color: book.seriesAccent }}>
                {book.title.slice(0, 2)}
              </span>
            )}
          </div>
          <div className="library-quick-list-copy">
            <h3>{title}</h3>
            <p>{status ? `${status} · ${book.subtitle}` : book.subtitle}</p>
          </div>
        </Link>
        {showFavoriteAction ? (
          <button
            type="button"
            className={`library-quick-list-favorite ${
              favorite ? "library-quick-list-favorite-active" : ""
            }`}
            aria-label={
              favorite ? `取消收藏《${book.title}》` : `收藏《${book.title}》`
            }
            aria-pressed={favorite}
            onClick={() => toggle("library", book.contentId)}
          >
            <Heart aria-hidden="true" weight={favorite ? "fill" : "regular"} />
          </button>
        ) : null}
      </article>
    );
  };

  function toggleSeriesExpanded(seriesId: string) {
    setExpandedSeriesIds((current) => {
      const next = new Set(current);
      if (next.has(seriesId)) next.delete(seriesId);
      else next.add(seriesId);
      return next;
    });
  }

  function updateFilter<Key extends keyof LibraryDiscoveryFilters>(
    key: Key,
    value: LibraryDiscoveryFilters[Key],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function updateTonightAge(value: LibraryAgeFilter) {
    setTonightAge(value);
    try {
      window.localStorage.setItem(TONIGHT_AGE_PREFERENCE_KEY, value);
    } catch {
      // The recommendation remains usable for this session.
    }
  }

  return (
    <>
      <ReadingSyncControl />

      {!searchActive && continueReading.length > 0 ? (
        <section className="library-home-section" aria-labelledby="continue-reading-title">
          <header className="library-home-section-header">
            <div>
              <p>接着上次</p>
              <h2 id="continue-reading-title">继续阅读</h2>
            </div>
          </header>
          <div className="library-home-row">
            {continueReading.map((book) => renderCard(book, true))}
          </div>
        </section>
      ) : null}

      {!searchActive && (recentBooks.length > 0 || favoriteBooks.length > 0) ? (
        <div className="library-quick-panels">
          {recentBooks.length > 0 ? (
            <section className="library-quick-panel" aria-labelledby="recent-reading-title">
              <header>
                <p>最近打开</p>
                <h2 id="recent-reading-title">最近播放</h2>
              </header>
              <div className="library-quick-list">
                {recentBooks.map((book) => renderQuickItem(book))}
              </div>
            </section>
          ) : null}

          {favoriteBooks.length > 0 ? (
            <section className="library-quick-panel" aria-labelledby="favorite-books-title">
              <header>
                <p>家庭收藏</p>
                <h2 id="favorite-books-title">我的收藏</h2>
              </header>
              <div className="library-quick-list">
                {favoriteBooks.map((book) => renderQuickItem(book, true))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {!searchActive && tonightRecommendation ? (
        <section className="library-tonight" aria-labelledby="tonight-title">
          <div className="library-tonight-copy">
            <span><Sparkle weight="fill" /> 简单、可解释的日期轮换</span>
            <h2 id="tonight-title">今晚读什么</h2>
            <label className="library-tonight-age">
              <span>今晚阅读年龄</span>
              <select
                value={tonightAge}
                onChange={(event) =>
                  updateTonightAge(event.target.value as LibraryAgeFilter)
                }
              >
                {LIBRARY_AGE_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <h3>{tonightRecommendation.book.title}</h3>
            <p>{tonightRecommendation.book.subtitle}</p>
            <small>
              {tonightRecommendation.explanation} 只使用家长主动选择的年龄，
              不建立儿童行为画像。
            </small>
            <Link href={tonightRecommendation.book.href}>今晚读这本</Link>
          </div>
          <div className="library-tonight-card">
            {renderCard(tonightRecommendation.book, true, true, true)}
          </div>
        </section>
      ) : null}

      {!searchActive ? (
        <section className="library-home-section" aria-labelledby="series-stories-title">
          <header className="library-home-section-header">
            <div>
              <p>按顺序慢慢读</p>
              <h2 id="series-stories-title">系列故事</h2>
            </div>
          </header>
          <div className="library-series-overview">
            {series.map((item) => {
              const allSeriesBooks = publishedBooks.filter(
                (book) => book.seriesId === item.id,
              );
              const expanded = expandedSeriesIds.has(item.id);
              const seriesBooks = expanded
                ? allSeriesBooks
                : allSeriesBooks.slice(0, SERIES_PREVIEW_COUNT);
              return (
                <section key={item.id} className="library-series-overview-item">
                  <header>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.subtitle}</p>
                    </div>
                  </header>
                  <div className="library-home-row">
                    {seriesBooks.map((book) => renderCard(book, true, true))}
                  </div>
                  {allSeriesBooks.length > SERIES_PREVIEW_COUNT ? (
                    <button
                      type="button"
                      className="library-series-expand"
                      aria-expanded={expanded}
                      onClick={() => toggleSeriesExpanded(item.id)}
                    >
                      {expanded
                        ? "收起"
                        : `展开全部 ${allSeriesBooks.length} ${
                            allSeriesBooks.some((book) => book.episodeNumber)
                              ? "回"
                              : "本"
                          }`}
                    </button>
                  ) : null}
                </section>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="library-discovery" aria-labelledby="library-discovery-title">
        <header className="library-home-section-header">
          <div>
            <p>{searchActive ? "同时查找公共与私人内容" : "按家庭当下需要选择"}</p>
            <h2 id="library-discovery-title">
              {searchActive ? "搜索结果" : "分类与筛选"}
            </h2>
          </div>
        </header>

        <div className="library-search-box">
          <MagnifyingGlass aria-hidden="true" />
          <label htmlFor="library-search">搜索标题、系列、主题、成语或科普关键词</label>
          <input
            id="library-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="例如：西游记、勇气、天空为什么是蓝色"
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              aria-label="清空搜索"
              onClick={() => setQuery("")}
            >
              <X aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="library-filter-panel" aria-label="筛选精选馆藏">
          <label>
            <span>内容分类</span>
            <select
              value={filters.category}
              onChange={(event) =>
                updateFilter(
                  "category",
                  event.target.value as LibraryCategory | "all",
                )
              }
            >
              <option value="all">全部分类</option>
              {CATEGORY_ORDER.filter((item) =>
                publishedBooks.some((book) => book.metadata.category === item),
              ).map((item) => (
                <option key={item} value={item}>
                  {LIBRARY_CATEGORY_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>适合年龄</span>
            <select
              value={filters.age}
              onChange={(event) =>
                updateFilter("age", event.target.value as LibraryAgeFilter)
              }
            >
              {LIBRARY_AGE_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>阅读时长</span>
            <select
              value={filters.duration}
              onChange={(event) =>
                updateFilter(
                  "duration",
                  event.target.value as LibraryDurationFilter,
                )
              }
            >
              <option value="all">全部时长</option>
              <option value="short">5 分钟内</option>
              <option value="medium">6-10 分钟</option>
              <option value="long">10 分钟以上</option>
            </select>
          </label>
          <label>
            <span>支持语言</span>
            <select
              value={filters.language}
              onChange={(event) =>
                updateFilter(
                  "language",
                  event.target.value as LibraryLanguageFilter,
                )
              }
            >
              <option value="all">全部语言</option>
              <option value="zh">支持中文</option>
              <option value="en">支持英文</option>
              <option value="bilingual">中英双语</option>
            </select>
          </label>
          <label>
            <span>故事系列</span>
            <select
              value={filters.seriesId}
              onChange={(event) => updateFilter("seriesId", event.target.value)}
            >
              <option value="all">全部系列</option>
              {series.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>内容主题</span>
            <select
              value={filters.theme}
              onChange={(event) => updateFilter("theme", event.target.value)}
            >
              <option value="all">全部主题</option>
              {themeOptions.map((theme) => (
                <option key={theme} value={theme}>
                  {theme}
                </option>
              ))}
            </select>
          </label>
          <label className="library-filter-checkbox">
            <input
              type="checkbox"
              checked={filters.bedtimeOnly}
              onChange={(event) =>
                updateFilter("bedtimeOnly", event.target.checked)
              }
            />
            <span>仅看适合睡前</span>
          </label>
          <div className="library-filter-summary" aria-live="polite">
            <span>精选馆藏 {filteredBooks.length} 本</span>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={() =>
                  setFilters({ ...DEFAULT_LIBRARY_DISCOVERY_FILTERS })
                }
              >
                重置筛选
              </button>
            ) : null}
          </div>
        </div>

        {searchActive ? (
          <div className="library-search-privacy-note">
            私人作品只在当前浏览器和你的账户书架中读取并在本机匹配；
            搜索词、孩子姓名和故事内容不会写入产品埋点，也不会进入公共绘本馆。
          </div>
        ) : null}

        <section className="library-search-group" aria-labelledby="public-results-title">
          <header>
            <div>
              <span>公开精选内容</span>
              <h3 id="public-results-title">
                {searchActive ? "精选馆藏" : "全部精选绘本"}
              </h3>
            </div>
            <strong>{filteredBooks.length} 本</strong>
          </header>
          {visibleBooks.length > 0 ? (
            <div className="library-catalog-experience-grid">
              {visibleBooks.map((book) => renderCard(book))}
            </div>
          ) : (
            <p className="library-search-empty">
              没有匹配的精选绘本，可以清空搜索或重置筛选后再试。
            </p>
          )}
          {visibleBooks.length < filteredBooks.length ? (
            <button
              type="button"
              className="library-catalog-more"
              onClick={() => setVisibleCount((count) => count + 24)}
            >
              显示更多绘本
            </button>
          ) : null}
        </section>

        {searchActive ? (
          <section className="library-search-group" aria-labelledby="private-results-title">
            <header>
              <div>
                <span>默认私有，不与馆藏混合</span>
                <h3 id="private-results-title">我的私人绘本</h3>
              </div>
              <strong>{privateLoading ? "读取中" : `${privateResults.length} 本`}</strong>
            </header>
            {privateError ? (
              <p className="library-private-search-error" role="status">
                {privateError}
              </p>
            ) : null}
            {privateLoading ? (
              <p className="library-search-empty" aria-live="polite">
                正在读取当前设备和你的账户书架…
              </p>
            ) : privateResults.length > 0 ? (
              <div className="library-private-results-grid">
                {privateResults.map((story) => (
                  <article key={story.id} className="library-private-result-card">
                    <Link href={story.href}>
                      <div className="library-private-result-cover">
                        {story.coverImage ? (
                          // Private URLs can be data URLs or short-lived signed URLs.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={story.coverImage} alt={`${story.title}封面`} />
                        ) : (
                          <span>{story.title.slice(0, 4)}</span>
                        )}
                      </div>
                      <div>
                        <span>{story.sourceLabel}</span>
                        <h4>{story.title}</h4>
                        <p>{story.subtitle}</p>
                        <strong>{story.actionLabel}</strong>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <p className="library-search-empty">
                私人书架中没有匹配作品。私人内容不会自动公开到精选馆藏。
              </p>
            )}
          </section>
        ) : null}
      </section>
    </>
  );
}
