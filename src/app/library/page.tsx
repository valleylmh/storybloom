import type { Metadata } from "next";
import Link from "next/link";
import LibraryCatalogExperience from "@/components/library/LibraryCatalogExperience";
import {
  getAllSeries,
  getPublishedBookCount,
  getSeriesBooks,
  getUpcomingSeries,
} from "@/lib/library";
import { createLibraryBookSummary } from "@/lib/library/catalog";

const PUBLISHED_BOOK_COUNT = getPublishedBookCount();
const HAS_PUBLISHED_BOOKS = PUBLISHED_BOOK_COUNT > 0;

export const metadata: Metadata = HAS_PUBLISHED_BOOKS
  ? {
      title: "绘本馆 | 免费中英双语儿童绘本在线阅读 - StoryBloom",
      description:
        "StoryBloom 绘本馆：成语故事、唐诗启蒙、经典名著与儿童科普等系列化中英双语绘本，免费在线阅读，适合 4-8 岁亲子共读。",
      alternates: { canonical: "/library" },
      openGraph: {
        title: "StoryBloom 绘本馆",
        description: "成语、唐诗、名著与科普系列中英双语儿童绘本，免费在线阅读。",
        type: "website",
      },
    }
  : {
      title: "绘本馆 | 中英双语儿童绘本即将上线 - StoryBloom",
      description:
        "StoryBloom 绘本馆首批中英双语儿童绘本正在制作中，可提前查看成语故事等系列书目。",
      alternates: { canonical: "/library" },
      openGraph: {
        title: "StoryBloom 绘本馆 · 即将上线",
        description: "首批系列化中英双语儿童绘本正在制作中。",
        type: "website",
      },
    };

export default function LibraryPage() {
  const series = getAllSeries();
  const upcoming = getUpcomingSeries();
  const books = series.flatMap((item) =>
    getSeriesBooks(item.id).map((book) =>
      createLibraryBookSummary(item, book),
    ),
  );

  return (
    <main className="library-page library-index-page">
      <nav className="library-topbar" aria-label="页面导航">
        <Link href="/" className="library-back">
          ← 返回首页
        </Link>
      </nav>

      <header className="library-hero">
        <p className="library-kicker">STORYBLOOM 绘本馆</p>
        <h1>今晚，先读一本好故事</h1>
        <p className="library-lead">
          精选内容、有声阅读和家庭收藏，匿名打开即可使用。
        </p>
      </header>

      <LibraryCatalogExperience
        books={books}
        series={series.map((item) => ({
          id: item.id,
          title: item.title,
          subtitle: item.subtitle,
        }))}
      />

      <section className="library-catalog" aria-label="即将上线绘本">
        {upcoming.map((item) => (
          <section
            key={item.id}
            className="library-series-section library-series-section-upcoming"
            aria-labelledby={`library-series-${item.id}`}
          >
            <header
              className="library-series-section-header"
            >
              <h2 id={`library-series-${item.id}`}>{item.title}</h2>
              <span className="library-series-count">敬请期待</span>
            </header>
          </section>
        ))}
      </section>

      <section className="library-cta" aria-label="生成专属绘本">
        <h2>想要一本以孩子为主角的绘本？</h2>
        <p>写下孩子的名字和一个小心愿，几分钟生成一本专属中英双语绘本。</p>
        <Link href="/" className="library-cta-btn">
          免费生成专属绘本
        </Link>
      </section>
    </main>
  );
}
