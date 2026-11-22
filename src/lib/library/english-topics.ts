import type { LibraryBook, LibrarySeries } from "@/types/library";
import { getBook, getSeries } from "./index";

export interface EnglishLibraryTopic {
  /** URL slug under /en/library/topics. */
  id: string;
  /** Short name for links, pills, and breadcrumbs. */
  name: string;
  /** SEO title phrase without site suffix. */
  seoTitle: string;
  heading: string;
  description: string;
  /** Content id ("seriesId/bookId") of the recommended first book; must be in bookIds. */
  startWith: string;
  /** Short guidance on where to begin and how to read through the collection. */
  startHere: string;
  /** 3 practical prompts parents or teachers can ask after reading. */
  discussionPrompts: string[];
  /** 3 visible parent/teacher FAQs, also emitted as FAQPage JSON-LD. */
  faqs: Array<{ question: string; answer: string }>;
  /** Content ids ("seriesId/bookId"), curated order. */
  bookIds: string[];
}

const ENGLISH_TOPICS: EnglishLibraryTopic[] = [
  {
    id: "bilingual-bedtime-stories",
    name: "Bilingual Bedtime Stories",
    seoTitle: "Free Bilingual Chinese & English Bedtime Stories for Kids",
    heading: "Calm Chinese-English bedtime stories you can finish in five minutes",
    description:
      "Gentle illustrated stories about night-lights, moonlight, sleep, and quiet afternoons. Read the English text, switch to side-by-side Chinese and English, and wind down together without cliffhangers.",
    startWith: "richang/jin-wan-de-xiao-deng-ke-yi-liang-zhe-ma",
    startHere:
      "Start with Can the Night-Light Stay On Tonight? if your child feels uneasy when the lights go out, or Why Do We Need to Sleep? when bedtime keeps stretching longer. On calm nights, close with a moonlit Tang poem like Quiet Night Thoughts.",
    discussionPrompts: [
      "Which quiet moment from today would you like to carry into your dreams tonight?",
      "If the moon outside the window listened to our story, which picture would it like best?",
      "Would you like to read the last page together slowly, or close your eyes and listen while I read?",
    ],
    faqs: [
      {
        question: "What makes a good bilingual bedtime story for ages 4–8?",
        answer:
          "Look for steady pacing, gentle illustrations, and a clear ending you can finish in five to eight minutes. Stories about everyday comfort, moonlight, and quiet curiosity help children settle without turning bedtime into a language lesson.",
      },
      {
        question: "How should parents read Chinese and English at bedtime without waking kids up?",
        answer:
          "Keep the voice slow and skip quizzes or vocabulary drills. You can read one language straight through tonight and explore the bilingual reader tomorrow, or read each short page in Chinese first and softly echo the English meaning.",
      },
      {
        question: "Do I need an account to read these bedtime picture books?",
        answer:
          "No. Every story in the StoryBloom library is free to open and read online in English or in the Chinese-English reader without signing in.",
      },
    ],
    bookIds: [
      "richang/jin-wan-de-xiao-deng-ke-yi-liang-zhe-ma",
      "haoqi/wei-shen-me-yao-shui-jiao",
      "haoqi/yue-liang-wei-shen-me-gen-zhe-wo-zou",
      "tangshi/jing-ye-si",
      "tangshi/zhu-li-guan",
      "tangshi/gu-lang-yue-xing",
      "richang/yi-ge-ren-wan-de-xia-wu",
      "richang/te-bie-de-ri-zi-shi-na-tian",
    ],
  },
  {
    id: "chinese-idiom-stories",
    name: "Chinese Idiom Stories (Chengyu)",
    seoTitle: "Chinese Idiom Stories (Chengyu) for Kids in English & Chinese",
    heading: "Classic Chinese idiom stories (Chengyu) retold with illustrations",
    description:
      "Introduce children to famous four-character Chinese idioms and proverbs—from Cao Chong weighing an elephant to the frog at the bottom of the well. Each story pairs full illustrations with clear English text and meaning.",
    startWith: "chengyu/cao-chong-cheng-xiang",
    startHere:
      "Begin with Cao Chong Weighs the Elephant—kids immediately connect with its clever problem-solving. Next try The Frog at the Bottom of the Well for perspective, or Grinding an Iron Rod into a Needle when talking about steady practice.",
    discussionPrompts: [
      "If you were standing in the story, what other way might you have tried to solve the problem?",
      "Can you think of a moment this week that matches the idiom in this story?",
      "Which character made a choice you agree with, and which choice would you change?",
    ],
    faqs: [
      {
        question: "What are Chengyu, and why are they great for bilingual kids?",
        answer:
          "Chengyu are traditional four-character Chinese idioms rooted in fables and history. Because each idiom carries a vivid short story behind it, children remember the meaning naturally through pictures and characters rather than rote memorization.",
      },
      {
        question: "What age are illustrated Chinese idiom stories best for?",
        answer:
          "Children ages 4 to 8 enjoy the animal fables and clever puzzles in this collection, while older heritage learners can use the bilingual reader to connect the English storyline back to the four Chinese characters.",
      },
      {
        question: "How can kids start using Chinese idioms in everyday conversation?",
        answer:
          "Drop one phrase naturally into real life after reading—for example, mention Many Hands Make the Fire Burn High when cleaning up together, or Mending the Pen After a Sheep Is Lost after fixing a small mistake.",
      },
    ],
    bookIds: [
      "chengyu/cao-chong-cheng-xiang",
      "chengyu/jing-di-zhi-wa",
      "chengyu/yu-gong-yi-shan",
      "chengyu/tie-chu-cheng-zhen",
      "chengyu/shou-zhu-dai-tu",
      "chengyu/hu-jia-hu-wei",
      "chengyu/wang-yang-bu-lao",
      "chengyu/kong-rong-rang-li",
      "yanyu/zhong-ren-shi-chai",
    ],
  },
  {
    id: "tang-poems-for-kids",
    name: "Tang Poems for Kids",
    seoTitle: "Tang Poems for Kids with English Translation & Pictures",
    heading: "Illustrated Tang Dynasty poems with original Chinese and English translations",
    description:
      "Explore ten beloved Tang poems—including Ode to the Goose, Quiet Night Thoughts, Spring Dawn, and Hoeing the Fields at Noon. Every poem comes with the original Chinese lines, an accessible English translation, and illustrated scenes.",
    startWith: "tangshi/yong-e",
    startHere:
      "Start with Ode to the Goose and Spring Dawn, whose bright colors and animal imagery appeal right away to young listeners. Then read Quiet Night Thoughts at bedtime and Pity the Farmers (II): Hoeing the Fields at Noon around a family meal.",
    discussionPrompts: [
      "Which color, sound, or season stands out most to you in the illustrations for this poem?",
      "Imagine standing right beside the poet—what would you feel on your face or hear nearby?",
      "Does a scene in this poem remind you of a park, night sky, or trip we have seen together?",
    ],
    faqs: [
      {
        question: "How can non-fluent parents share Tang poetry with their children?",
        answer:
          "Start with the illustrations and the English translation so both of you share the scene and mood first. Then switch to the Chinese-English reader to listen to the Chinese rhythm aloud—appreciating the imagery matters more than memorizing every character.",
      },
      {
        question: "Which Tang poems are easiest for young children to start with?",
        answer:
          "Short five-character quatrains with concrete pictures work best: Ode to the Goose (咏鹅), Quiet Night Thoughts (静夜思), Spring Dawn (春晓), and Pity the Farmers (悯农·其二) are classic first poems for ages 4–8.",
      },
      {
        question: "Why read Tang poems with English translations alongside Chinese?",
        answer:
          "Bilingual translations let heritage speakers and English-dominant children grasp the poem's story and emotion immediately, turning ancient lines into something they can talk about while still hearing the original Chinese cadence.",
      },
    ],
    bookIds: [
      "tangshi/yong-e",
      "tangshi/jing-ye-si",
      "tangshi/chun-xiao",
      "tangshi/min-nong-qi-er",
      "tangshi/deng-guan-que-lou",
      "tangshi/yong-liu",
      "tangshi/chi-shang",
      "tangshi/shan-xing",
      "tangshi/jiang-xue",
      "tangshi/you-zi-yin",
    ],
  },
  {
    id: "journey-to-the-west-for-kids",
    name: "Journey to the West for Kids",
    seoTitle: "Journey to the West Stories for Kids (Monkey King Picture Books)",
    heading: "Start reading Journey to the West with the Monkey King's best-known adventures",
    description:
      "New to the 64-chapter classic? Begin with eight iconic Monkey King episodes—from the Stone Monkey's birth and Havoc in Heaven to the White Bone Spirit, Red Boy, and the Palm-Leaf Fan—retold for young readers in English and Chinese.",
    startWith: "xiyouji/shi-hou-chu-shi",
    startHere:
      "Read The Stone Monkey Is Born and Havoc in Heaven first to meet Sun Wukong before he joins Master Tang. Once Master and Disciple Meet sets the journey in motion, you can jump straight to favorites like Red Boy or the Palm-Leaf Fan, or follow the full series in order.",
    discussionPrompts: [
      "How does Sun Wukong use quick thinking—not just strength—to get the team out of trouble?",
      "Between Wukong, Bajie, Sha Wujing, and Master Tang, who would you want on your team and why?",
      "If you could borrow one magical item from this episode, how would you use it to help someone?",
    ],
    faqs: [
      {
        question: "Is Journey to the West suitable for kids ages 4–8?",
        answer:
          "Yes, when retold at a picture-book pace. These illustrated episodes focus on curiosity, teamwork, courage, and clever problem-solving while keeping the conflicts approachable and free of scary imagery.",
      },
      {
        question: "Do children need to read all 64 chapters in order?",
        answer:
          "No. Starting with these eight landmark episodes gives kids the complete arc—from Wukong's birth to the return with the scriptures. If your child gets hooked, every chapter connects directly to the full Journey to the West series.",
      },
      {
        question: "Can we switch between English and Chinese while reading the Monkey King stories?",
        answer:
          "Yes. Every English story page links straight to the bilingual Chinese-English reader for the exact same chapter, so families can read in English first and explore key Chinese names like Sun Wukong (孙悟空) together.",
      },
    ],
    bookIds: [
      "xiyouji/shi-hou-chu-shi",
      "xiyouji/da-nao-tian-gong",
      "xiyouji/shi-tu-xiang-yu",
      "xiyouji/san-da-bai-gu-jing",
      "xiyouji/huo-yun-dong-shou-hong-hai-er",
      "xiyouji/zhen-jia-mei-hou-wang",
      "xiyouji/san-jie-ba-jiao-shan",
      "xiyouji/chang-an-gong-de-yuan-man",
    ],
  },
  {
    id: "feelings-and-preschool",
    name: "Feelings & Preschool",
    seoTitle: "Chinese-English Picture Books About Feelings & Starting Preschool",
    heading: "Bilingual stories for big feelings, preschool drop-offs, and making friends",
    description:
      "Goodbye tears at the classroom door, angry hands, a new baby sister, losing a game, or asking to join friends on the playground. These bilingual stories give young children gentle words for real everyday moments.",
    startWith: "sanzijing/men-kou-de-zai-jian-xiao-yi-shi",
    startHere:
      "Start with Our Goodbye Ritual at the Door when preparing for preschool drop-offs, or Where Do Angry Hands Go? during a calm afternoon to practice what to do before big feelings boil over. Every book also opens in the Chinese-English reader with parent conversation prompts.",
    discussionPrompts: [
      "Where in your body do you notice a big feeling first—in your hands, tummy, or eyes?",
      "What is one short sentence you could try saying next time this happens at school or at home?",
      "What small ritual helps you feel safe when saying goodbye or trying something new?",
    ],
    faqs: [
      {
        question: "When is the best time to read stories about anger or separation anxiety?",
        answer:
          "Read them during calm, relaxed moments—not in the middle of a meltdown or right at the school gate. Practicing phrases like a goodbye ritual or naming feelings ahead of time makes them easier for kids to remember when emotions run high.",
      },
      {
        question: "How do bilingual feeling stories help kids growing up with two languages?",
        answer:
          "Children often learn emotional vocabulary in one language before the other. Reading stories like Every Feeling Has a Name in English and Chinese helps them express worries, jealousy, or frustration comfortably with both parents and grandparents.",
      },
      {
        question: "Can I create a personalized story about my own child's preschool moment?",
        answer:
          "Yes. Use the StoryBloom creator to describe what happened today—such as a nervous first morning or a playground disagreement—and generate an illustrated bilingual book starring your child.",
      },
    ],
    bookIds: [
      "sanzijing/men-kou-de-zai-jian-xiao-yi-shi",
      "richang/sheng-qi-de-xiao-shou-fang-na-li",
      "sanzijing/mei-yi-zhong-xin-qing-dou-you-ming-zi",
      "richang/jin-wan-de-xiao-deng-ke-yi-liang-zhe-ma",
      "sanzijing/mei-mei-lai-le-wo-hai-zai-zhe-li",
      "richang/wo-ke-yi-he-ni-men-yi-qi-wan-ma",
      "richang/wo-hai-mei-shuo-yan-lei-jiu-lai-le",
      "richang/ba-ba-mei-you-ying",
    ],
  },
  {
    id: "science-and-vehicles-for-kids",
    name: "Science & City Vehicles",
    seoTitle: "Bilingual Science, Nature & Vehicle Stories for Curious Kids",
    heading: "Why is the sky blue? How do ambulances race against time? Illustrated answers",
    description:
      "From sirens, traffic lights, and high-speed trains to blue skies, rainbows, rain, and butterflies. These bilingual science and vehicle picture books turn everyday 'why?' questions into clear visual stories for ages 4–8.",
    startWith: "qiche/jiu-hu-che-zen-yang-zheng-fen-duo-miao",
    startHere:
      "Vehicle fans can jump right into How Ambulances Race Against Time and Why Do Traffic Lights Change Color?. For nature-loving kids, start with Why Is the Sky Blue? or Where Do Rainbows Come From? right after a walk outside.",
    discussionPrompts: [
      "On our next walk or car ride, which street sign, vehicle light, or cloud shape should we look for?",
      "If you had to explain how this works to a younger friend in two sentences, what would you say?",
      "What is another 'why?' question about weather, animals, or vehicles you want to explore next?",
    ],
    faqs: [
      {
        question: "Are these science and vehicle stories accurate for curious 4- to 8-year-olds?",
        answer:
          "Yes. Each story explains real-world concepts—such as emergency right-of-way, water droplets forming rain, and seasonal sunlight—using concrete everyday comparisons rather than heavy textbook jargon.",
      },
      {
        question: "How can parents turn a picture book into a quick hands-on observation?",
        answer:
          "Pair reading with what is already around you: spot traffic light signals on the walk to school, watch steam condense on a lid after reading Why Does It Rain?, or look for prism colors in sunlight after reading Where Do Rainbows Come From?.",
      },
      {
        question: "Do the vehicle stories include everyday road safety lessons?",
        answer:
          "Yes. Books like Why Do Traffic Lights Change Color?, How Ambulances Race Against Time, and Why Do Fire Trucks Sound Their Sirens? weave safe crossing, warning lights, and making room for emergency vehicles naturally into the plot.",
      },
    ],
    bookIds: [
      "qiche/jiu-hu-che-zen-yang-zheng-fen-duo-miao",
      "qiche/hong-lu-deng-wei-shen-me-hui-bian-se",
      "qiche/xiao-fang-che-wei-shen-me-yao-ming-di",
      "qiche/gao-tie-wei-shen-me-pao-de-kuai",
      "haoqi/tian-kong-wei-shen-me-shi-lan-se",
      "haoqi/wei-shen-me-hui-xia-yu",
      "haoqi/cai-hong-shi-zen-me-lai-de",
      "haoqi/wei-shen-me-you-chun-xia-qiu-dong",
      "haoqi/mao-mao-chong-wei-shen-me-bian-hu-die",
    ],
  },
  {
    id: "chinese-festivals-for-kids",
    name: "Chinese Festivals & Traditions",
    seoTitle: "Chinese New Year, Dragon Boat & Mid-Autumn Festival Stories for Kids",
    heading: "Illustrated stories about Chinese New Year, Dragon Boat, and Mid-Autumn Festival",
    description:
      "Explore why families celebrate Lunar New Year, race dragon boats, eat zongzi, watch the full moon with mooncakes, and think of loved ones on the Double Ninth Festival—in clear English and Chinese for home or classroom storytime.",
    startWith: "haoqi/chun-jie-wei-shen-me-yao-guo-nian",
    startHere:
      "Read along with the calendar: begin with Why Do We Celebrate Chinese New Year? in winter, Dragon Boat Festival: Why Do We Eat Zongzi and Race Dragon Boats? in early summer, and Mid-Autumn Festival: Why Do We Watch the Moon and Eat Mooncakes? in autumn.",
    discussionPrompts: [
      "Which festival food, lantern, or family custom from this story would you most like to try together?",
      "Why do you think so many festivals are about gathering with family or thinking of people far away?",
      "What tradition does our own family repeat every year that makes a day feel special?",
    ],
    faqs: [
      {
        question: "Can teachers use these Chinese festival stories in classrooms?",
        answer:
          "Yes. Each illustrated book opens directly in a browser with no login required, making it easy to project on a screen for Lunar New Year, Dragon Boat Festival, or Mid-Autumn Festival storytime.",
      },
      {
        question: "What ages are these Chinese cultural stories written for?",
        answer:
          "They are written for children ages 4–8 with clear English explanations alongside the original Chinese version, so both heritage families and curious beginners can follow the traditions easily.",
      },
      {
        question: "Do the festival books include Chinese text as well as English?",
        answer:
          "Yes. Every English page links directly to the side-by-side Chinese-English reader, letting families explore festival words like 春节 (Spring Festival), 粽子 (zongzi), and 月饼 (mooncakes) together.",
      },
    ],
    bookIds: [
      "haoqi/chun-jie-wei-shen-me-yao-guo-nian",
      "haoqi/duan-wu-wei-shen-me-chi-zong-zi-hua-long-zhou",
      "haoqi/zhong-qiu-wei-shen-me-shang-yue-chi-yue-bing",
      "tangshi/jiu-yue-jiu-ri-yi-shan-dong-xiong-di",
    ],
  },
];

export function getAllEnglishTopics(): EnglishLibraryTopic[] {
  return ENGLISH_TOPICS;
}

export function getEnglishTopic(topicId: string): EnglishLibraryTopic | null {
  return ENGLISH_TOPICS.find((topic) => topic.id === topicId) ?? null;
}

export function englishTopicPath(topic: EnglishLibraryTopic): string {
  return `/en/library/topics/${topic.id}`;
}

/** Published books of an English topic, in curated order. */
export function getEnglishTopicBooks(
  topic: EnglishLibraryTopic,
): Array<{ series: LibrarySeries; book: LibraryBook }> {
  return topic.bookIds.flatMap((contentId) => {
    const [seriesId, bookId] = contentId.split("/");
    const series = getSeries(seriesId);
    const book = getBook(seriesId, bookId);
    return series && book && !book.comingSoon ? [{ series, book }] : [];
  });
}

export function getEnglishSeriesTopics(seriesId: string): EnglishLibraryTopic[] {
  return ENGLISH_TOPICS.filter((topic) =>
    topic.bookIds.some((id) => id.startsWith(`${seriesId}/`)),
  );
}

export function getEnglishBookTopics(book: LibraryBook): EnglishLibraryTopic[] {
  const contentId = `${book.seriesId}/${book.id}`;
  return ENGLISH_TOPICS.filter((topic) => topic.bookIds.includes(contentId));
}
