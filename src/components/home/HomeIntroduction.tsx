import { Fragment } from "react";
import Link from "next/link";
import {
  FEATURED_ENGLISH_TOPIC_LINKS,
  FEATURED_TOPIC_LINKS,
} from "@/lib/library/topic-links";
import { localizedPath, type SiteLocale } from "@/lib/seo";
import styles from "./HomeIntroduction.module.css";

export default function HomeIntroduction({ locale = "zh" }: { locale?: SiteLocale }) {
  const en = locale === "en";
  return <section className={styles.introduction} aria-labelledby="home-introduction-title" lang={en ? "en" : "zh-CN"}>
    <header>
      <p>STORIES FOR EVERY LITTLE MOMENT</p>
      <h2 id="home-introduction-title">{en ? "AI storybooks, made for reading together" : "AI 儿童绘本生成，让亲子共读从身边的小事开始"}</h2>
      <p>{en ? "Turn an everyday moment, a curious question or an imaginary adventure into an illustrated story. StoryBloom brings Chinese and English text, pictures and read-aloud tools together, so families can make room for stories at bedtime and throughout the day." : "第一次独自骑车、和朋友分享玩具、睡前冒出的一个问题，都可以成为故事的开头。StoryBloom 帮家长把一句想法写成中英双语儿童绘本，配上插画，陪孩子一起阅读与想象。你可以记录真实的成长时刻，也可以创造一个完全虚构的冒险，用熟悉的人物和场景开启亲子共读。"}</p>
    </header>
    <div className={styles.columns}>
      <section>
        <h3>{en ? "Create a personal picture book" : "三步创作一本专属绘本"}</h3>
        <ol>
          <li>{en ? "Describe a moment or an idea, and choose the character and story settings." : "写下一件小事或一个故事想法，选择主角与需要的创作设置。"}</li>
          <li>{en ? "Generate the story, then watch the illustrations arrive page by page." : "生成故事文字，等待插画逐页完成，再和孩子一起翻开。"}</li>
          <li>{en ? "Read together, listen aloud, and save or export the finished book." : "亲子共读、朗读故事，把完成的绘本保存在本机或导出珍藏。"}</li>
        </ol>
        <p>{en ? "For real memories, parents decide which facts and imagined details to include. Cloud storage is optional." : "记录真实经历时，由家长决定使用哪些事实与想象。故事与记录默认保存在当前设备，是否使用私有云端由你主动选择。"}</p>
      </section>
      <section>
        <h3>{en ? "Explore free bilingual stories" : "不用创作，也能读到完整的睡前故事"}</h3>
        <p>{en ? "Visit the library for Chinese idiom stories for kids, proverbs, Tang poems, Journey to the West, science and everyday family stories. Read the English text or explore the Chinese version together." : "绘本馆提供成语故事、谚语故事、唐诗、经典名著、自然科普、城市汽车与日常生活等系列。每本都有完整的中英文正文，适合家长陪读，也能在睡前挑一本慢慢读。"}</p>
        <p>{en ? "Looking for a keepsake? Explore graduation, Children's Day and birthday picture-book gifts, or use a daily story idea to begin your next book." : "想为幼儿园毕业、六一或生日准备一份心意，可以翻阅礼物绘本样书；还没想到创作主题时，每日灵感会提供具体的故事开头和亲子提问。"}</p>
        {en ? (
          <p>
            Looking for a curated starting point? Browse bilingual picture-book collections with reading tips and conversation prompts:{" "}
            {FEATURED_ENGLISH_TOPIC_LINKS.map((topic, index) => (
              <Fragment key={topic.id}>
                {index > 0 ? ", " : null}
                <Link href={`/en/library/topics/${topic.id}`}>{topic.name}</Link>
              </Fragment>
            ))}
            .
          </p>
        ) : (
          <p>
            想按孩子正在经历的场景或当下兴趣找书？可以直接翻开精选绘本专题，每组都附选书顺序与共读提问：
            {FEATURED_TOPIC_LINKS.map((topic, index) => (
              <Fragment key={topic.id}>
                {index > 0 ? "、" : null}
                <Link href={`/library/topics/${topic.id}`}>{topic.name}</Link>
              </Fragment>
            ))}
            。
          </p>
        )}
        <nav className={styles.links} aria-label={en ? "Explore StoryBloom" : "探索 StoryBloom"}>
          <Link href={localizedPath("/library", locale)}>{en ? "Read stories →" : "免费阅读双语绘本 →"}</Link>
          <Link href={localizedPath("/library/topics", locale)}>{en ? "Browse bilingual collections →" : "按场景与主题找绘本 →"}</Link>
          <Link href="/gifts">{en ? "Picture-book gifts →" : "挑选礼物绘本 →"}</Link>
          <Link href={localizedPath("/inspiration", locale)}>{en ? "Daily story ideas →" : "寻找每日灵感 →"}</Link>
        </nav>
      </section>
    </div>
    <section className={styles.faq} aria-labelledby="home-faq-title">
      <h3 id="home-faq-title">{en ? "Before your first story" : "开始之前，你可能想知道"}</h3>
      <details><summary>{en ? "Can I read without creating an account?" : "需要登录才能阅读吗？"}</summary><p>{en ? "Public library books and daily story ideas are available without signing in. Account features and optional private cloud storage are separate." : "公开绘本馆与每日灵感无需登录即可阅读。账号与可选的私有云端功能分开使用，登录不会自动上传本机的家庭资料。"}</p></details>
      <details><summary>{en ? "Who are the stories for?" : "适合多大的孩子？"}</summary><p>{en ? "Library books show their suggested ages; many suit shared reading with children aged 4–8. Parents can adjust the age and story settings for a personal book." : "绘本馆会标注每本的适读年龄，多数适合 4–8 岁孩子与家长共读。创作专属绘本时，可以根据孩子的年龄与兴趣调整设置；AI 内容也需要家长陪读与判断。"}</p></details>
      <details><summary>{en ? "Can I keep my storybook?" : "生成后可以保存和分享吗？"}</summary><p>{en ? "Books are saved on the current device by default and can be exported as share images. Private cloud copies and public sharing require your own action." : "绘本默认保存在当前浏览器，可继续阅读，也可导出分享长图。私有云端保存和公开分享都需要你主动操作；更换设备前，请先确认作品已导出或另行保存。"}</p></details>
    </section>
  </section>;
}
