import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSharedStory } from "@/lib/share-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { shareId: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { shareId } = await params;
  const record = await getSharedStory(shareId);

  if (!record) {
    return { robots: { index: false, follow: false } };
  }

  const cover = record.story.pages[0]?.imageUrl;

  return {
    title: `${record.story.coverTitle} | StoryBloom 绘本分享`,
    description: "一本用 StoryBloom 生成的专属儿童绘本，点开即读。",
    // 用户内容不进搜索引擎
    robots: { index: false, follow: false },
    openGraph: {
      title: record.story.coverTitle,
      description: "一本专属儿童绘本，点开即读。",
      type: "article",
      ...(cover ? { images: [{ url: cover }] } : {}),
    },
  };
}

export default async function SharedStoryPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { shareId } = await params;
  const record = await getSharedStory(shareId);

  if (!record) {
    notFound();
  }

  const { story } = record;

  return (
    <main className="library-page">
      <header className="library-hero library-book-hero">
        <p className="library-kicker">来自朋友分享的专属绘本</p>
        <h1>{story.coverTitle}</h1>
        <p className="library-lead">
          这是为{story.childName}生成的专属中英双语绘本。
        </p>
      </header>

      <section className="pages-grid library-pages" aria-label="绘本正文">
        {story.pages.map((page) => (
          <article
            key={page.page}
            className="page-card"
            aria-label={`第 ${page.page} 页`}
          >
            <div className="page-image-frame">
              {page.imageUrl ? (
                <img
                  src={page.imageUrl}
                  alt={`${story.coverTitle} 第 ${page.page} 页插图`}
                  className="page-image"
                  loading={page.page > 2 ? "lazy" : undefined}
                />
              ) : (
                <div className="library-page-fallback" aria-hidden="true">
                  <span>{page.page}</span>
                </div>
              )}
            </div>
            <div className="page-copy">
              {page.zhText ? <p className="page-zh">{page.zhText}</p> : null}
              {page.enText ? <p className="page-en">{page.enText}</p> : null}
            </div>
          </article>
        ))}
      </section>

      <section className="library-cta" aria-label="生成专属绘本">
        <h2>我也想给孩子做一本</h2>
        <p>写下孩子的名字和一个小心愿，几分钟免费生成一本专属中英双语绘本。</p>
        <Link href="/" className="library-cta-btn">
          免费生成我的绘本
        </Link>
      </section>
    </main>
  );
}
