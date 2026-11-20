import Image from "next/image";
import Link from "next/link";
import type { LibraryBook, LibrarySeries } from "@/types/library";
import { bookEnglishTitle } from "@/lib/library/english-titles";
import { libraryBookPath } from "@/lib/library/paths";
import { bookCover, bookDescription, seriesCopy } from "@/lib/library/seo";

export default function EnglishLibraryCard({ book, series }: { book: LibraryBook; series: LibrarySeries }) {
  const cover = bookCover(book);
  const title = bookEnglishTitle(book);
  return <Link href={libraryBookPath(book, "en")} className="library-book-card" prefetch={false}>
    <div className="library-book-cover" style={{ backgroundColor: `${series.accent}22` }}>
      {cover ? <Image src={cover} alt={title === book.title ? "Illustrated story cover" : `Cover of ${title}`} width={320} height={320} sizes="(max-width: 580px) 44vw, 280px" /> : <span aria-hidden="true">{book.title.slice(0, 2)}</span>}
    </div>
    <h3>{title === book.title ? <span lang="zh-CN">{book.title}</span> : <>{title} <span lang="zh-CN" className="library-book-original-title">{book.title}</span></>}</h3>
    <p className="library-book-subtitle">{bookDescription(book, "en").replace(`${title}: `, "").slice(0, 150)}</p>
    <span className="library-book-open">Read in English →</span>
    <span className="sr-only">{seriesCopy(series, "en").title}</span>
  </Link>;
}
