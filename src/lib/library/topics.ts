import type { LibraryBook, LibrarySeries } from "@/types/library";
import { getBook, getSeries } from "./index";

export interface LibraryTopic {
  /** URL slug under /library/topics. */
  id: string;
  /** Short name for links and breadcrumbs. */
  name: string;
  /** The phrase a parent would search for; used in each book's page title. */
  searchLabel: string;
  heading: string;
  description: string;
  /** Preset for the story creator, written as a parent would describe the moment. */
  idea: string;
  /** Content ids ("seriesId/bookId"), most relevant first. */
  bookIds: string[];
}

// A book's first topic in this order is its primary topic: it supplies the page title.
const TOPICS: LibraryTopic[] = [
  {
    id: "ru-yuan-shi-ying",
    name: "入园适应",
    searchLabel: "入园焦虑与幼儿园适应绘本",
    heading: "孩子入园哭闹、不想上幼儿园？陪他读这几本",
    description: "门口舍不得说再见、午休睡不着、不敢举手说要上厕所、想加入游戏又不敢开口。这些绘本把幼儿园里的小难题讲成故事，每本都附给大人的共读提问。",
    idea: "早上送孩子去幼儿园，到了门口他拉着我的手不肯进去",
    bookIds: [
      "sanzijing/men-kou-de-zai-jian-xiao-yi-shi",
      "richang/xiao-men-kou-de-na-yi-ci-hui-shou",
      "richang/da-ban-de-san-wei-lao-shi",
      "richang/shui-bu-zhao-de-wu-xiu-xiao-chuang",
      "richang/wo-xiang-qu-xi-shou-jian-ke-yi-ju-shou-ma",
      "richang/wo-ke-yi-he-ni-men-yi-qi-wan-ma",
      "richang/jin-tian-wo-shi-da-ban-zhi-ri-sheng",
      "richang/ma-ma-zai-xiao-men-kou-zhan-gang",
    ],
  },
  {
    id: "you-xiao-xian-jie",
    name: "幼小衔接",
    searchLabel: "幼小衔接绘本",
    heading: "幼小衔接读什么？从拼音、写数字到自己收书包",
    description: "b 和 d 总是分不清、数字写出田字格、书包要自己收、第一颗乳牙开始摇晃。这些绘本陪大班孩子把上小学前的新变化，变成一件件可以慢慢练的小事。",
    idea: "孩子写数字总是写出格子，擦了又写，越写越着急",
    bookIds: [
      "richang/pin-yin-wang-guo-li-de-xiao-wan-gou",
      "richang/tiao-chu-tian-zi-ge-de-xiao-shu-zi",
      "richang/wo-de-xiao-shu-bao-jin-tian-zi-ji-shou",
      "richang/yao-huang-de-di-yi-ke-xiao-ru-ya",
      "richang/ming-tian-yao-dai-de-na-pian-ye-zi",
      "sanzijing/hui-du-hui-xiang-ye-hui-wan",
    ],
  },
  {
    id: "pa-hei-dan-xiao",
    name: "怕黑与胆小",
    searchLabel: "孩子怕黑胆小绘本",
    heading: "孩子怕黑、见人不敢打招呼？先陪他读一本",
    description: "关灯后的影子、不熟悉的大人、摇晃的乳牙、一张不敢下笔的白纸。这些绘本不催孩子“勇敢一点”，而是让害怕可以被说出来，再一起找一个安心的办法。",
    idea: "晚上关灯以后，孩子说窗帘旁边有影子，想开着小灯睡",
    bookIds: [
      "richang/jin-wan-de-xiao-deng-ke-yi-liang-zhe-ma",
      "richang/na-sheng-ni-hao-cang-zai-bei-hou",
      "richang/yao-huang-de-di-yi-ke-xiao-ru-ya",
      "richang/wo-ke-yi-he-ni-men-yi-qi-wan-ma",
      "richang/na-zhang-bu-gan-hua-de-bai-zhi",
    ],
  },
  {
    id: "qing-xu-guan-li",
    name: "发脾气与情绪",
    searchLabel: "儿童情绪管理绘本",
    heading: "孩子爱发脾气、一说就哭？这几本绘本陪他认识情绪",
    description: "生气时小手想打人、话还没说眼泪先掉下来、玩具今天就想要、计划被一场雨打乱。这些绘本先接住情绪，再陪孩子练习把感受和需要说出来。",
    idea: "孩子今天搭的积木被碰倒了，他气得把积木推了一地",
    bookIds: [
      "richang/sheng-qi-de-xiao-shou-fang-na-li",
      "sanzijing/mei-yi-zhong-xin-qing-dou-you-ming-zi",
      "richang/wo-hai-mei-shuo-yan-lei-jiu-lai-le",
      "richang/na-liang-xiao-che-wo-jin-tian-jiu-xiang-yao",
      "richang/bu-tai-wan-mei-de-ye-can",
      "richang/zhao-bu-dao-de-xiao-xiong",
    ],
  },
  {
    id: "er-bao-bi-jiao",
    name: "二宝与比较",
    searchLabel: "二宝与爱比较绘本",
    heading: "二宝来了、总爱和别人比？陪大宝读这几本",
    description: "妹妹来了以后想要自己的位置、被拿来和表哥比快、觉得自己的饼干更小、最后一块蛋糕该给谁。这些绘本让孩子的在意被看见，也练习把想要的说出来。",
    idea: "家里有了小妹妹以后，哥哥说大家都只抱妹妹",
    bookIds: [
      "sanzijing/mei-mei-lai-le-wo-hai-zai-zhe-li",
      "sanzijing/bu-he-biao-ge-bi-kuai",
      "richang/wo-de-bing-gan-zen-me-geng-xiao",
      "richang/zui-hou-yi-kuai-dan-gao",
      "richang/le-le-you-le-xin-peng-you",
    ],
  },
  {
    id: "jiao-peng-you",
    name: "交朋友",
    searchLabel: "孩子交朋友社交绘本",
    heading: "孩子不会交朋友、和小伙伴闹别扭？读读这几本",
    description: "好朋友有了新朋友、一句玩笑让对方不开心、想说“我不愿意”又怕伤了朋友、道歉了对方还没消气。这些绘本陪孩子练习同伴相处里最难开口的几句话。",
    idea: "孩子的好朋友今天和别人一起玩，没有叫他",
    bookIds: [
      "richang/le-le-you-le-xin-peng-you",
      "richang/wo-zhi-shi-kai-ge-wan-xiao",
      "richang/xiao-xiao-de-bu-yuan-yi",
      "richang/deng-wo-xin-qing-hao-le-zai-shuo",
      "richang/wo-ke-yi-he-ni-men-yi-qi-wan-ma",
      "richang/na-sheng-ni-hao-cang-zai-bei-hou",
    ],
  },
  {
    id: "cheng-shi-ren-cuo",
    name: "诚实与认错",
    searchLabel: "孩子诚实认错绘本",
    heading: "孩子犯了错不敢说？这几本绘本讲承认和补救",
    description: "打翻了牛奶、话卡在嘴里说不出来、明明不是自己却被误会。这些绘本想让孩子知道：说出经过是安全的，做错以后还可以一起补救，大人的爱不会因此少一点。",
    idea: "孩子不小心把杯子打翻了，站在旁边不敢告诉我",
    bookIds: [
      "richang/yi-bei-da-fan-de-niu-nai",
      "richang/na-ju-hua-ka-zai-zui-ba-li",
      "sanzijing/shan-liang-cheng-shi-he-you-fen-cun",
      "richang/zhe-ci-zhen-de-bu-shi-wo",
      "richang/xiao-che-zen-me-dao-le-ni-jia",
    ],
  },
  {
    id: "ping-mu-yu-yue-ding",
    name: "屏幕时间与约定",
    searchLabel: "屏幕时间与规则约定绘本",
    heading: "动画片停不下来、说好五分钟又五分钟？试试这几本",
    description: "这一集看完还想看、再玩五分钟、别人都有的小手表、只想吃这一种零食，还有爸爸放不下的手机。这些绘本把“说好了”变成孩子也参与的约定，而不是一场拉锯。",
    idea: "说好看完这一集动画片就关，结果下一集自动开始了",
    bookIds: [
      "richang/zhe-yi-ji-wo-hai-xiang-kan",
      "richang/zai-wan-wu-fen-zhong",
      "sanzijing/ba-ba-de-shou-ji-xian-shui-yi-hui-er",
      "richang/da-jia-dou-you-de-xiao-shou-biao",
      "richang/wo-zhi-xiang-chi-zhe-yi-zhong",
    ],
  },
  {
    id: "shu-bu-qi",
    name: "输不起与怕做不好",
    searchLabel: "孩子输不起抗挫绘本",
    heading: "孩子输不起、一说“我不会”就放弃？陪他读这几本",
    description: "比赛没有赢、怕画不好不敢下笔、想自己来又做不到。这些绘本不讲“失败是成功之母”，而是允许失望，再陪孩子找到愿意试一试的下一小步。",
    idea: "孩子和爸爸下棋输了，把棋子一推说再也不玩了",
    bookIds: [
      "richang/ba-ba-mei-you-ying",
      "richang/na-zhang-bu-gan-hua-de-bai-zhi",
      "sanzijing/pei-hai-zi-ba-lu-zou-chang",
      "richang/wo-xiang-zi-ji-shi-yi-shi",
      "richang/tiao-chu-tian-zi-ge-de-xiao-shu-zi",
    ],
  },
  {
    id: "xue-xin-ben-ling",
    name: "学新本领",
    searchLabel: "儿童生活技能绘本",
    heading: "学骑车、跳绳、用筷子、系鞋带：把新本领拆成小步子",
    description: "骑自行车、跳绳、拍篮球、游泳、用筷子、系鞋带、用剪刀、放风筝。每本绘本把一项本领拆成孩子做得到的几小步，练的是动作，也是“慢慢来”的耐心。",
    idea: "孩子今天第一次自己骑自行车，骑出去一小段没有摔",
    bookIds: [
      "sanzijing/xiao-che-lun-man-man-zhuan",
      "sanzijing/sheng-zi-shua-de-yi-sheng",
      "sanzijing/kuai-zi-jia-zhu-xiao-tuan-zi",
      "sanzijing/xie-dai-rao-guo-xiao-shan-qiu",
      "sanzijing/lan-qiu-dong-dong-hui-lai-le",
      "sanzijing/yong-chi-li-de-yi-xiao-duan",
      "sanzijing/jian-dao-yan-zhe-xiao-lu-zou",
      "sanzijing/zhi-fei-ji-fei-guo-lan-xian",
      "sanzijing/feng-zheng-deng-yi-zhen-feng",
      "sanzijing/hua-pen-li-de-yi-ke-dou",
    ],
  },
  {
    id: "qin-zi-gou-tong",
    name: "亲子沟通",
    searchLabel: "亲子沟通绘本",
    heading: "吼了孩子很后悔？这几本绘本是读给大人和孩子一起听的",
    description: "声音一大孩子就问“你是在凶我吗”、妈妈今天很累、爸爸妈妈说的不一样、答应的事没有做到。这些绘本里先调整的是大人：承认、暂停、回来把话说完。",
    idea: "今天我着急大声说了孩子，他小声问我是不是生气了",
    bookIds: [
      "richang/ma-ma-ni-shi-zai-xiong-wo-ma",
      "richang/ma-ma-jin-tian-you-dian-lei",
      "richang/ma-ma-shuo-ke-yi-ba-ba-shuo-bu-xing",
      "sanzijing/wo-men-jia-de-zan-ting-shou-shi",
      "sanzijing/na-ge-yue-ding-mei-you-zuo-dao",
      "richang/wo-ye-xiang-ba-hua-shuo-wan",
      "richang/fang-xue-lu-shang-man-man-shuo",
    ],
  },
];

export function getAllTopics(): LibraryTopic[] {
  return TOPICS;
}

export function getTopic(topicId: string): LibraryTopic | null {
  return TOPICS.find((topic) => topic.id === topicId) ?? null;
}

export function topicPath(topic: LibraryTopic) {
  return `/library/topics/${topic.id}`;
}

/** Published books of a topic, in the curated order. */
export function getTopicBooks(topic: LibraryTopic): Array<{ series: LibrarySeries; book: LibraryBook }> {
  return topic.bookIds.flatMap((contentId) => {
    const [seriesId, bookId] = contentId.split("/");
    const series = getSeries(seriesId);
    const book = getBook(seriesId, bookId);
    return series && book && !book.comingSoon ? [{ series, book }] : [];
  });
}

/** Topics that include the book; the first one is its primary topic. */
export function getBookTopics(book: LibraryBook): LibraryTopic[] {
  const contentId = `${book.seriesId}/${book.id}`;
  return TOPICS.filter((topic) => topic.bookIds.includes(contentId));
}
