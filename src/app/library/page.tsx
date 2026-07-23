import type { Metadata } from "next";
import Link from "next/link";
import {
  getAllSeries,
  getPublishedBookCount,
  getUpcomingSeries,
} from "@/lib/library";

const PUBLISHED_BOOK_COUNT = getPublishedBookCount();
const HAS_PUBLISHED_BOOKS = PUBLISHED_BOOK_COUNT > 0;

export const metadata: Metadata = HAS_PUBLISHED_BOOKS
  ? {
      title: "绘本馆 | 免费中英双语儿童绘本在线阅读 - StoryBloom",
      description:
        "StoryBloom 绘本馆：成语故事、经典名著改编等系列化中英双语儿童绘本，免费在线阅读，适合 4-8 岁亲子共读。",
      alternates: { canonical: "/library" },
      openGraph: {
        title: "StoryBloom 绘本馆",
        description: "系列化中英双语儿童绘本，免费在线阅读。",
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

  return (
    <main className="library-page">
      <nav className="library-topbar" aria-label="页面导航">
        <Link href="/" className="library-back">
          ← 返回首页
        </Link>
      </nav>

      <header className="library-hero">
        <p className="library-kicker">STORYBLOOM 绘本馆</p>
        <h1>经典故事，讲给孩子听</h1>
        <p className="library-lead">
          {HAS_PUBLISHED_BOOKS
            ? "成语故事、经典名著、科学问答——每本都是 8 页中英双语绘本，用孩子听得懂的语言温柔改编，免费在线阅读。"
            : "成语故事、经典名著、科学问答——首批 8 页中英双语绘本正在认真打磨，先来看看即将上线的系列。"}
        </p>
      </header>

      <section className="library-series-grid" aria-label="绘本系列">
        {series.map((item) => {
          const publishedCount = getPublishedBookCount(item.id);

          return (
            <Link
              key={item.id}
              href={`/library/${item.id}`}
              className="library-series-card"
              style={{ borderTopColor: item.accent }}
            >
              <span
                className="library-series-badge"
                style={{ backgroundColor: item.accent }}
              >
                {item.ageRange}
              </span>
              <h2>{item.title}</h2>
              <p className="library-series-subtitle">{item.subtitle}</p>
              <p className="library-series-description">{item.description}</p>
              <span className="library-series-meta">
                {publishedCount > 0
                  ? `${publishedCount} 本可读 · 进入系列 →`
                  : "即将上新 · 查看系列 →"}
              </span>
            </Link>
          );
        })}
        {upcoming.map((item) => (
          <div
            key={item.id}
            className="library-series-card library-series-card-upcoming"
            style={{ borderTopColor: item.accent }}
            aria-disabled="true"
          >
            <span
              className="library-series-badge"
              style={{ backgroundColor: item.accent }}
            >
              筹备中
            </span>
            <h2>{item.title}</h2>
            <p className="library-series-subtitle">{item.subtitle}</p>
            <p className="library-series-description">{item.description}</p>
            <span className="library-series-meta">敬请期待</span>
          </div>
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
