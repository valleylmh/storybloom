import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SharedStoryReader from "@/components/book/SharedStoryReader";
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

  const { story } = record;
  const cover = story.pages[0]?.imageUrl;
  const title = `《${story.coverTitle}》`;
  // The link preview only repeats what the sharer already made public on this page.
  const description = `给${story.childName}的专属绘本，共 ${story.pages.length} 页，点开就能翻页、听朗读。`;

  return {
    title: `${story.coverTitle} | StoryBloom 绘本分享`,
    description,
    // 用户内容不进搜索引擎
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "article",
      siteName: "StoryBloom",
      url: `/s/${shareId}`,
      ...(cover ? { images: [{ url: cover, alt: title }] } : {}),
    },
    twitter: {
      card: cover ? "summary_large_image" : "summary",
      title,
      description,
      ...(cover ? { images: [cover] } : {}),
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

      <SharedStoryReader
        shareId={shareId}
        title={story.coverTitle}
        initialLanguageMode={story.language.startsWith("en") ? "en" : "zh"}
        pages={story.pages.map((page) => ({
          ...page,
          illustrationPrompt: "",
          imageStatus: page.imageUrl ? "complete" : undefined,
        }))}
      />

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
