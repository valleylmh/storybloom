import type { Metadata } from "next";
import Link from "next/link";
import TodayInspirationCard from "@/components/inspiration/TodayInspirationCard";
import { getTodayPublicDailyInspiration } from "@/lib/inspiration/public-daily-inspiration";
import styles from "./InspirationPage.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "每日绘本灵感 | StoryBloom",
  description: "每天一个公开的中英双语亲子绘本灵感，无需登录即可阅读和开始创作。",
  alternates: { canonical: "/inspiration" },
  openGraph: {
    title: "StoryBloom 每日绘本灵感",
    description: "每天一个亲子共读话题，把真实的小事变成孩子的故事。",
    type: "website",
  },
};

export default async function InspirationPage() {
  const inspiration = await getTodayPublicDailyInspiration();

  return (
    <main className={styles.page}>
      <nav className={styles.topbar} aria-label="页面导航">
        <Link href="/" className={styles.brand}>
          StoryBloom
        </Link>
        <div className={styles.links}>
          <Link href="/library">绘本馆</Link>
          <Link href="/me">我的家庭</Link>
        </div>
      </nav>

      <header className={styles.hero}>
        <p className={styles.kicker}>DAILY STORY IDEA</p>
        <h1>今天，和孩子讲一个新的故事</h1>
        <p>
          每天一个温柔、具体的亲子绘本灵感。公开阅读，无需登录；你决定主角、细节和故事最后会开出什么花。
        </p>
      </header>

      <TodayInspirationCard inspiration={inspiration} />

      <aside className={styles.note}>
        <span aria-hidden="true">✦</span>
        <p>
          每日灵感和邮件订阅彼此独立。登录不会自动订阅；只有你主动提交邮箱并完成确认后，才会收到每日邮件。
        </p>
      </aside>
    </main>
  );
}
