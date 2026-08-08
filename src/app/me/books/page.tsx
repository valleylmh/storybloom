import LocalStoryLibrary from "@/components/account/LocalStoryLibrary";
import styles from "@/components/account/Account.module.css";

export const metadata = {
  title: "我的绘本 | StoryBloom",
};

export default function MyBooksPage() {
  return (
    <main>
      <section className={styles.sectionIntro}>
        <div>
          <p className={styles.sectionKicker}>LOCAL STORY LIBRARY</p>
          <h2>最近 10 本</h2>
          <p>打开最近创作的绘本，或删除不再需要的本地记录。</p>
        </div>
        <span className={styles.localNotice}>仅保存在当前浏览器</span>
      </section>
      <LocalStoryLibrary
        showWhenEmpty
        showLocalNotice={false}
        title="我的绘本"
        hint="最近 10 本本地作品，未完成绘本会置顶。"
      />
    </main>
  );
}
