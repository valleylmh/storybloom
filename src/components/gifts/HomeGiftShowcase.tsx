import Link from "next/link";
import styles from "./HomeGiftShowcase.module.css";

export default function HomeGiftShowcase({ locale }: { locale: "zh" | "en" }) {
  const zh = locale === "zh";
  return (
    <section className={styles.showcase} aria-labelledby="home-gifts-title">
      <div className={styles.copy}>
        <p className={styles.eyebrow}>{zh ? "精品礼物绘本" : "KEEPSAKE PICTURE BOOKS"}</p>
        <h2 id="home-gifts-title">{zh ? "把心意，送成一本绘本。" : "Give a story worth keeping."}</h2>
        <p className={styles.description}>{zh ? "毕业纪念、成长收藏，翻开一份可以珍藏的礼物。" : "A keepsake story for graduation, birthdays and growing up."}</p>
        <div className={styles.actions}>
          <Link className={styles.primary} href="/gifts">{zh ? "去看看" : "Explore"} <span aria-hidden="true">→</span></Link>
          <Link className={styles.secondary} href="/custom">{zh ? "了解定制" : "Custom books"} <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
      <div className={styles.books}>
        <Link className={styles.book} href="/gifts/summer-pocket" aria-label={zh ? "阅读精品绘本《把夏天装进口袋》" : "Read A Pocketful of Summer"}>
          <div className={styles.cover}><img src="/gift-books/summer-pocket/cover.png" alt={zh ? "把夏天装进口袋封面" : "A Pocketful of Summer cover"} width={1086} height={1448} loading="lazy" /></div>
          <span className={styles.category}>{zh ? "毕业纪念 · 10 页" : "Graduation · 10 pages"}</span>
          <strong>{zh ? "把夏天装进口袋" : "A Pocketful of Summer"}</strong>
        </Link>
        <Link className={styles.book} href="/gifts/city-motors" aria-label={zh ? "阅读精品绘本《城市汽车小队》" : "Read City Vehicle Crew"}>
          <div className={`${styles.cover} ${styles.city}`}>
            <span className={styles.cityHeading}><small>STORYBLOOM</small><b>城市汽车小队</b><small>26 个故事 · 全集典藏版</small></span>
            <img src="/library/qiche/hong-lu-deng-wei-shen-me-hui-bian-se/1.webp" alt={zh ? "安安与妈妈观察城市交通" : "An’an explores city traffic with her mother"} width={1200} height={1200} loading="lazy" />
          </div>
          <span className={styles.category}>{zh ? "好奇心收藏 · 26 个故事" : "For curious minds · 26 stories"}</span>
          <strong>{zh ? "城市汽车小队" : "City Vehicle Crew"}</strong>
        </Link>
      </div>
    </section>
  );
}
