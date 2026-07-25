import Link from "next/link";
import type { LibraryBook, LibrarySeries } from "@/types/library";

export default function LibraryBookCard({
  series,
  book,
}: {
  series: LibrarySeries;
  book: LibraryBook;
}) {
  const coverPage = book.pages[0];
  // 草稿书的 imageUrl 可能先于图片文件存在；只有已完成的图才能当封面。
  const cover =
    coverPage?.imageStatus === "complete" ? coverPage.imageUrl : null;

  const card = (
    <>
      <div
        className="library-book-cover"
        style={{ backgroundColor: `${series.accent}22` }}
      >
        {cover ? (
          <img src={cover} alt={`${book.title}封面`} loading="lazy" />
        ) : (
          <span
            className="library-book-cover-fallback"
            style={{ color: series.accent }}
          >
            {book.title.slice(0, 4)}
          </span>
        )}
        {book.comingSoon ? (
          <span className="library-book-soon">即将上线</span>
        ) : null}
      </div>
      <h3>
        {book.episodeNumber ? `第 ${book.episodeNumber} 回 · ` : ""}
        {book.title}
      </h3>
      <p className="library-book-subtitle">{book.subtitle}</p>
      {book.idiomMeaning ? (
        <p className="library-book-meaning">{book.idiomMeaning.zh}</p>
      ) : null}
      {!book.comingSoon ? (
        <span className="library-book-open">打开绘本 →</span>
      ) : null}
    </>
  );

  return book.comingSoon ? (
    <div
      className="library-book-card library-book-card-soon"
      aria-disabled="true"
    >
      {card}
    </div>
  ) : (
    <Link
      href={`/library/${series.id}/${book.id}`}
      className="library-book-card"
    >
      {card}
    </Link>
  );
}
