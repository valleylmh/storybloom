import Link from "next/link";
import CloudSyncCard from "@/components/account/CloudSyncCard";
import styles from "@/components/account/Account.module.css";

export const metadata = {
  title: "数据与隐私 | StoryBloom",
};

export default function SettingsPage() {
  return (
    <main className={styles.settingsPage}>
      <section className={styles.sectionIntro}>
        <div>
          <p className={styles.sectionKicker}>DATA & PRIVACY</p>
          <h2>知道资料保存在哪里</h2>
          <p>第一阶段不做云同步，也不会把当前浏览器里的作品描述成云端资料。</p>
        </div>
      </section>

      <section className={styles.settingsGrid}>
        <article className={styles.settingsCard}>
          <h2>当前浏览器</h2>
          <ul>
            <li>最近绘本与成长记录保存在本机浏览器。</li>
            <li>成长照片不会随绘本生成请求上传。</li>
            <li>清除浏览器数据可能会移除这些本地内容。</li>
          </ul>
          <p><Link href="/me/books">管理我的绘本</Link> · <Link href="/me/growth">管理成长记录</Link></p>
        </article>
        <article className={styles.settingsCard}>
          <h2>账户资料</h2>
          <ul>
            <li>家庭角色需要家长登录后管理。</li>
            <li>孩子、父母、长辈或宠物都可以成为家庭角色。</li>
            <li>不会基于儿童资料进行心理或能力诊断。</li>
          </ul>
          <p><Link href="/me/characters">管理家庭角色</Link></p>
        </article>
      </section>

      <CloudSyncCard />
    </main>
  );
}
