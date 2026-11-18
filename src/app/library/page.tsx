import JsonLd from "@/components/seo/JsonLd";
import { pageMetadata } from "@/lib/seo";
import { libraryBreadcrumbs } from "@/lib/library/seo";
import { toAbsoluteAppUrl } from "@/lib/site-url";
import Link from "next/link";
import LibraryCatalogExperience from "@/components/library/LibraryCatalogExperience";
import LibraryTopicLinks from "@/components/library/LibraryTopicLinks";
import {
  getAllSeries,
  getPublishedBookCount,
  getSeriesBooks,
  getUpcomingSeries,
} from "@/lib/library";
import { createLibraryBookSummary } from "@/lib/library/catalog";
import { getAllTopics } from "@/lib/library/topics";

const PUBLISHED_BOOK_COUNT = getPublishedBookCount();
const HAS_PUBLISHED_BOOKS = PUBLISHED_BOOK_COUNT > 0;

export const metadata = pageMetadata({
  path: "/library", bilingual: true,
  title: HAS_PUBLISHED_BOOKS ? "绘本馆 | 免费中英双语儿童绘本在线阅读 - StoryBloom" : "绘本馆 | 中英双语儿童绘本即将上线 - StoryBloom",
  description: "StoryBloom 绘本馆：成语故事、谚语故事、唐诗启蒙、经典名著、自然科普、城市汽车与日常生活等系列化中英双语绘本，免费在线阅读，适合 4-8 岁亲子共读。",
});

export default function LibraryPage() {
  const series = getAllSeries();
  const upcoming = getUpcomingSeries();
  const books = series.flatMap((item) =>
    getSeriesBooks(item.id).map((book) =>
      ({ ...createLibraryBookSummary(item, book), searchText: "" }),
    ),
  );

  return (
    <main className="library-page library-index-page">
      <JsonLd data={{ "@context": "https://schema.org", "@graph": [
        { "@type": "CollectionPage", name: "StoryBloom 绘本馆", url: toAbsoluteAppUrl("/library"), mainEntity: { "@type": "ItemList", numberOfItems: series.length, itemListElement: series.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.title, url: toAbsoluteAppUrl(`/library/${item.id}`) })) } },
        libraryBreadcrumbs(),
      ] }} />
      <nav className="library-topbar" aria-label="页面导航">
        <Link href="/" className="library-back">
          ← 返回首页
        </Link>
        <Link href="/en/library" hrefLang="en" className="library-back">English →</Link>
        <Link href="/library/reading" className="library-back">阅读记录与收藏 →</Link>
      </nav>

      <header className="library-hero">
        <p className="library-kicker">STORYBLOOM 绘本馆</p>
        <h1>今晚，先读一本好故事</h1>
        <p className="library-lead">
          精选内容、有声阅读和家庭收藏，匿名打开即可使用。
        </p>
      </header>

      <LibraryTopicLinks topics={getAllTopics()} label="按育儿情境找" showAll />

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
