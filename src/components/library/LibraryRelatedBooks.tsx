"use client";

import { useFavorites } from "@/hooks/useFavorites";
import { createFavoriteKey } from "@/lib/favorites";
import type { LibraryRecommendation } from "@/lib/library/discovery";
import LibraryCatalogCard from "@/components/library/LibraryCatalogCard";

export default function LibraryRelatedBooks({
  recommendations,
}: {
  recommendations: LibraryRecommendation[];
}) {
  const { keys: favoriteKeys, toggle } = useFavorites();
  if (recommendations.length === 0) return null;

  return (
    <section className="library-related" aria-labelledby="library-related-title">
      <header className="library-home-section-header">
        <div>
          <p>简单规则推荐</p>
          <h2 id="library-related-title">读完还可以看</h2>
        </div>
      </header>
      <p className="library-related-explanation">
        只参考同系列、主题、适龄阶段和阅读时长，不建立儿童兴趣或能力画像。
      </p>
      <div className="library-home-row">
        {recommendations.map(({ book, reason }) => (
          <div key={book.contentId} className="library-related-item">
            <span>{reason}</span>
            <LibraryCatalogCard
              book={book}
              favorite={favoriteKeys.has(
                createFavoriteKey("library", book.contentId),
              )}
              onToggleFavorite={() => toggle("library", book.contentId)}
              compact
            />
          </div>
        ))}
      </div>
    </section>
  );
}
