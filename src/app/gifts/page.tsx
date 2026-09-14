import Link from "next/link";
import styles from "./page.module.css";

export const metadata = {
  title: "精品绘本 | StoryBloom",
  description: "探索可以翻阅、赠送与珍藏的精品电子绘本：毕业纪念、城市汽车与成长故事。",
};

const books = [
  {
    id: "summer-pocket",
    title: "把夏天装进口袋",
    theme: "毕业纪念",
    detail: "10 页 · 图文一体",
    description: "把第一次勇敢、最好的朋友和舍不得的告别，留成一份毕业礼物。",
    image: "/gift-books/summer-pocket/cover.png",
  },
  {
    id: "city-motors",
    title: "城市汽车小队",
    theme: "好奇心收藏",
    detail: "26 个故事 · 全集典藏版",
    description: "跟着安安探索城市交通与工程，把爱问为什么的日子装进一本书。",
    image: "/library/qiche/hong-lu-deng-wei-shen-me-hui-bian-se/1.webp",
  },
  {
    id: "journey-to-the-west",
    title: "西游记",
    theme: "东方经典",
    detail: "60 回 · 全集典藏版",
    description: "从石猴出世到五圣成真，跟着悟空走过千山，读懂勇敢与陪伴。",
    image: "/library/xiyouji/shi-hou-chu-shi/1.webp",
  },
];

export default function Gifts() {
  return (
    <div data-gift-module>
      <main className={styles.page}>
        <nav className={styles.nav} aria-label="精品绘本导航">
          <Link href="/" className={styles.brand}>STORYBLOOM <span>精品绘本</span></Link>
          <Link href="/custom">绘本定制 ↗</Link>
        </nav>
        <header className={styles.header}>
          <p>STORIES WORTH KEEPING</p>
          <h1>每一本，都值得珍藏。</h1>
          <span>翻开一个故事，送出一份心意。</span>
        </header>
        <section aria-labelledby="gift-collection-title">
          <div className={styles.collectionHeading}><h2 id="gift-collection-title">全部精品绘本</h2><span>{books.length} 本作品</span></div>
          <div className={styles.grid}>
            {books.map((book) => (
              <article key={book.id} className={styles.card}>
                <Link href={`/gifts/${book.id}`} className={styles.bookLink} aria-label={`打开绘本《${book.title}》`}>
                  <div className={styles.coverStage}>
                    <div className={`${styles.cover} ${book.id !== "summer-pocket" ? `${styles.cityCover} ${book.id === "journey-to-the-west" ? styles.journeyCover : ""}` : ""}`}>
                      {book.id !== "summer-pocket" ? <div className={styles.cityTitle}><small>STORYBLOOM</small><strong>{book.title}</strong><span>{book.detail}</span></div> : null}
                      <img src={book.image} alt={`${book.title}封面`} width={book.id === "city-motors" ? 1200 : 1086} height={book.id === "city-motors" ? 1200 : 1448} />
                      {book.id !== "summer-pocket" ? <span className={styles.imprint}>{book.id === "journey-to-the-west" ? "从石猴出世，到五圣成真" : "给小小探索家的城市发现之旅"}</span> : null}
                    </div>
                  </div>
                  <div className={styles.copy}>
                    <span className={styles.theme}>{book.theme}</span>
                    <h3>{book.title}</h3>
                    <span className={styles.detail}>{book.detail}</span>
                    <p>{book.description}</p>
                    <span className={styles.read}>打开绘本 <span aria-hidden="true">↗</span></span>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        </section>
        <section className={styles.custom} aria-labelledby="gift-custom-title">
          <div><h2 id="gift-custom-title">定制属于你的绘本</h2><p>把名字、共同经历和祝福，写进下一本值得珍藏的故事。</p></div>
          <Link href="/custom">了解绘本定制 ↗</Link>
        </section>
        <footer className={styles.footer}><span>STORYBLOOM · 让心意，有一本书的模样。</span><Link href="/privacy">隐私与数据</Link></footer>
      </main>
    </div>
  );
}
