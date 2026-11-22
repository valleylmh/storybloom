import type { LibraryBook, LibrarySeries } from "@/types/library";
import { getBook, getSeries } from "./index";

export type LibraryTopicGroup = "parenting" | "theme";

export interface LibraryTopic {
  /** URL slug under /library/topics. */
  id: string;
  /** Distinguishes parenting situations from cross-series reading themes. */
  group: LibraryTopicGroup;
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
  /** Content id ("seriesId/bookId") of the book to read first; must be in bookIds. */
  startWith: string;
  /** Why/how to start; must mention the startWith book as 《title》. */
  startHere: string;
  /** Optional topic-level discussion prompts when included books lack parentGuide questions. */
  discussionPrompts?: string[];
  /** 3 visible parent questions, also emitted as FAQPage JSON-LD. */
  faqs: Array<{ question: string; answer: string }>;
}

// A book's first topic in this order is its primary topic: it supplies the page title.
const TOPICS: LibraryTopic[] = [
  {
    id: "ru-yuan-shi-ying",
    group: "parenting",
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
    startWith: "sanzijing/men-kou-de-zai-jian-xiao-yi-shi",
    startHere: "分离焦虑最集中的是早上那几分钟。先读《门口的再见小仪式》，和孩子约好一个固定的告别动作；等孩子能走进教室了，再按午睡、上厕所、加入游戏的顺序，一本一本读后面的小难题。",
    faqs: [
      {
        question: "孩子入园哭闹一般会持续多久？",
        answer: "每个孩子不一样，有的一两周慢慢平稳，有的在假期后或生病后又会反复。反复不等于退步。比起追问“今天哭了没”，更有帮助的是每天用同一个告别方式、准时兑现接送约定，让孩子知道分开之后大人一定会回来。",
      },
      {
        question: "送园时可以趁孩子不注意悄悄离开吗？",
        answer: "不建议。悄悄走开当下少了哭闹，但孩子会更担心大人随时消失，第二天反而更黏人。可以像《门口的再见小仪式》那样，抱一下、说清楚“午睡起来吃完点心我就来接你”，然后温和而干脆地离开，把孩子交给老师。",
      },
      {
        question: "孩子在幼儿园不敢举手说要上厕所，怎么办？",
        answer: "先在家里把这句话练熟：“老师，我想去洗手间。”可以和孩子轮流扮演老师和小朋友。共读《我想去洗手间，可以举手吗？》时，重点告诉孩子身体的信号比课堂安静更重要，必要时也可以提前和老师沟通孩子的习惯。",
      },
    ],
  },
  {
    id: "you-xiao-xian-jie",
    group: "parenting",
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
    startWith: "richang/wo-de-xiao-shu-bao-jin-tian-zi-ji-shou",
    startHere: "幼小衔接不必一上来就刷题。先读《我的小书包，今天自己收》，从整理书包、准备第二天的物品这些自理小事开始；拼音、写数字这类学习上的着急，可以放在孩子有了掌控感之后再读。",
    faqs: [
      {
        question: "幼小衔接最该提前准备什么？",
        answer: "比起提前学多少字，更要紧的是生活和学习习惯：自己收书包、记住要带的东西、能坐下来专注一小段时间、遇到不会的知道怎么求助。《会读、会想，也会玩》讲的就是学习不只是背得快，理解、提问和休息同样是方法。",
      },
      {
        question: "孩子 b 和 d、6 和 9 总是分不清，需要担心吗？",
        answer: "学龄前和刚入学的孩子写反、认反字母和数字很常见，多数会随着练习慢慢改善。与其反复纠正，不如像《拼音王国里的小弯钩》那样用身体动作和小口诀帮孩子记方向。如果长期没有改善，再和老师一起观察。",
      },
      {
        question: "孩子写字写出格、越写越急，家长怎么帮？",
        answer: "先停下来让手放松，告诉孩子写不好可以慢慢练，不用一次写完美。每天只练几个字、写完一起找出写得最好的那一个，比整页重写更能保护孩子的耐心。《跳出田字格的小数字》可以在孩子着急的那天读。",
      },
    ],
  },
  {
    id: "pa-hei-dan-xiao",
    group: "parenting",
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
    startWith: "richang/jin-wan-de-xiao-deng-ke-yi-liang-zhe-ma",
    startHere: "如果孩子是晚上怕黑，先读《今晚的小灯可以亮着吗》，睡前一起决定开哪盏小灯；如果是见到生人就往后躲，先读《那声你好，藏在背后》，让孩子知道打招呼可以有自己的节奏。",
    faqs: [
      {
        question: "孩子怕黑，要不要开着小夜灯睡？",
        answer: "可以。怕黑在学龄前很常见，一盏柔和的小灯能帮孩子安心入睡。比起“没什么好怕的”，先认真听孩子说看到了什么，再一起检查影子、选择灯光和抱着睡的玩具，让孩子参与决定，害怕会更快变小。",
      },
      {
        question: "孩子见人不打招呼，要不要逼他叫人？",
        answer: "不建议当众催促或贴上“胆小”“没礼貌”的标签。可以先由大人示范打招呼，允许孩子用挥手、点头或躲在身后看一会儿的方式参与。等孩子熟悉了环境，他常常会自己找到开口的时机。",
      },
      {
        question: "孩子胆小，是不是要多“锻炼”他？",
        answer: "胆小不是缺点，而是孩子在评估环境是否安全。更有效的做法是把挑战拆小，并保证有可靠的大人在身边：先在旁边看，再一起试一次，最后自己试。《那张不敢画的白纸》讲的就是让开始变成一件小事。",
      },
    ],
  },
  {
    id: "qing-xu-guan-li",
    group: "parenting",
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
    startWith: "richang/sheng-qi-de-xiao-shou-fang-na-li",
    startHere: "孩子情绪上来时讲道理往往听不进去。建议先在平静的时候读《生气的小手放哪里》，约定生气时手先停一下、可以说什么；再用《每一种心情都有名字》帮孩子把说不清的感受叫出名字。",
    faqs: [
      {
        question: "孩子一生气就打人、扔东西怎么办？",
        answer: "先平静而坚定地拦住伤人的动作，再说出孩子的感受：“你很生气，因为积木倒了，但我不会让你打人。”等孩子冷静下来，再一起想下次生气时可以跺脚、捏枕头或说“我很生气”。接纳情绪和守住行为边界可以同时做到。",
      },
      {
        question: "孩子动不动就哭，要不要让他“不许哭”？",
        answer: "哭是孩子在表达自己还说不清的感受，被要求止住眼泪，孩子会更难开口。可以先陪着，等哭声小一点再问“你想告诉我什么？”《我还没说，眼泪就来了》想告诉孩子：眼泪旁边也可以有一句话。",
      },
      {
        question: "孩子想要的东西得不到就大哭大闹，要不要满足他？",
        answer: "不必为了停止哭闹改变原来的安排，但可以承认孩子的喜欢和失望：“你真的很想要这辆小车。”然后清楚说明今天的安排，并陪他度过失望。《那辆小车，我今天就想要》讲的正是这样的时刻。",
      },
    ],
  },
  {
    id: "er-bao-bi-jiao",
    group: "parenting",
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
    startWith: "sanzijing/mei-mei-lai-le-wo-hai-zai-zhe-li",
    startHere: "家里刚有二宝时，先读《妹妹来了，我还在这里》，让大宝知道喜欢妹妹和想要自己的位置可以同时存在；孩子总爱和别人比时，再读《不和表哥比快》和《我的饼干怎么更小》。",
    faqs: [
      {
        question: "二宝出生后大宝变得黏人、退回像小宝宝一样，怎么办？",
        answer: "这是很常见的反应，大宝在用自己的方式确认爱还在。可以每天留一段只属于大宝的时间，哪怕只有十分钟；保留他的专属物品和空间；允许他说“我不喜欢妹妹哭”。被看见了，大宝反而更愿意当一个帮手。",
      },
      {
        question: "孩子总爱和别人比较，说自己不如别人，怎么回应？",
        answer: "先别急着说“你也很棒”，而是陪孩子把注意力放回自己的进步：“上周你只能跳三下，今天跳了五下。”大人也尽量少用“你看哥哥”这类比较的话。《不和表哥比快》讲的就是找到适合自己的那一小步。",
      },
      {
        question: "两个孩子抢东西，家长该怎么分才公平？",
        answer: "公平不一定是每次都平分。有些东西适合轮流，有些适合按需要分，有些可以一起玩。让孩子先把自己想要的说出来，再一起商量办法，比大人直接裁决更能减少争抢。《最后一块蛋糕》可以作为讨论的开头。",
      },
    ],
  },
  {
    id: "jiao-peng-you",
    group: "parenting",
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
    startWith: "richang/wo-ke-yi-he-ni-men-yi-qi-wan-ma",
    startHere: "孩子想加入游戏却不敢开口时，先读《我可以和你们一起玩吗？》，练一句可以直接用的话；如果是和好朋友闹别扭、被冷落，再读《乐乐有了新朋友》和《等我心情好了再说》。",
    faqs: [
      {
        question: "孩子不会主动交朋友，总是一个人玩，怎么办？",
        answer: "有的孩子喜欢先观察再加入，这本身没有问题。可以给孩子准备几句具体的话，比如“我可以玩吗？”“我来帮你搭”，在家里先练一练；也可以邀请一两个小朋友到熟悉的环境里一起玩，降低开口的难度。",
      },
      {
        question: "孩子和好朋友闹别扭了，家长要不要介入？",
        answer: "没有安全问题时，先听孩子把经过说完，帮他分清自己的感受和需要，而不是替他去“摆平”。可以一起想想明天怎么说一句话、怎么道歉或邀请。《等我心情好了再说》也提醒孩子：道歉之后，对方可以需要一点时间。",
      },
      {
        question: "孩子不好意思拒绝别人，怎么教他说“不”？",
        answer: "先让孩子知道，拒绝不等于不友好。可以一起练一些温和但清楚的话，比如“我现在不想借，等我玩完再给你”。同时也要练习听见别人的拒绝。《小小的不愿意》讲的就是温柔也可以有边界。",
      },
    ],
  },
  {
    id: "cheng-shi-ren-cuo",
    group: "parenting",
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
    startWith: "richang/yi-bei-da-fan-de-niu-nai",
    startHere: "孩子犯错后不敢说，往往是担心被骂。先读《一杯打翻的牛奶》，让孩子体验“说出来，再一起擦干净”；如果孩子被误会或总说“不是我”，再读《这次真的不是我》。",
    faqs: [
      {
        question: "孩子犯了错不敢承认，甚至撒谎，怎么办？",
        answer: "先让说实话变得安全：孩子说出经过时，大人先感谢他愿意说，再一起处理后果。如果每次坦白都换来责骂，孩子自然会学着隐瞒。《善良、诚实和有分寸》讲的就是诚实之后还可以补救，大人的爱不会因此减少。",
      },
      {
        question: "孩子明明做了却说“不是我”，要不要当场拆穿？",
        answer: "不必追问逼他认错，可以描述你看到的事实：“牛奶洒在地上了，我们需要把它擦干净。”把重点放在补救而不是定罪，孩子更容易放下防备。等气氛平静后，再聊聊下次可以怎么说。",
      },
      {
        question: "怎么教孩子真心道歉，而不是敷衍一句“对不起”？",
        answer: "一个完整的道歉包括：说出自己做了什么、对方有什么感受、我可以怎么补救。大人也可以在自己说错话时示范给孩子看。道歉之后对方暂时不原谅也是可以的，慢慢修复关系同样重要。",
      },
    ],
  },
  {
    id: "ping-mu-yu-yue-ding",
    group: "parenting",
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
    startWith: "richang/zhe-yi-ji-wo-hai-xiang-kan",
    startHere: "看动画停不下来最常见，可以先读《这一集，我还想看》，和孩子一起约定看到哪里停、停下来做什么；如果孩子玩游戏总是“再五分钟”，再读《再玩五分钟》。",
    faqs: [
      {
        question: "孩子看动画片停不下来，一关就哭，怎么办？",
        answer: "在开始之前就约好具体的结束点，比如“看完这一集”，而不是模糊的“一会儿”；结束前几分钟提醒一次；关掉之后马上接一件孩子愿意做的事。也可以关掉自动连播，减少“下一集已经开始了”的拉锯。",
      },
      {
        question: "说好的时间到了孩子还要“再五分钟”，要不要答应？",
        answer: "可以在约定时就把“最后一局”的时间留出来，到点时温和而坚持地执行。如果偶尔超时，第二天一起补上约定，比当场发脾气更能让孩子学会守约。让孩子参与定规则，他会更愿意遵守。",
      },
      {
        question: "大人自己也常刷手机，怎么和孩子谈屏幕约定？",
        answer: "规则对大人同样有效，孩子会更信服。可以约定吃饭和睡前的“无手机时间”，需要接电话时先说明再回来。《爸爸的手机先睡一会儿》讲的就是大人把专注的陪伴变成一段说到做到的时间。",
      },
    ],
  },
  {
    id: "shu-bu-qi",
    group: "parenting",
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
    startWith: "richang/ba-ba-mei-you-ying",
    startHere: "孩子输了就哭、一说“我不会”就放弃，先读《爸爸没有赢》，让孩子看到大人也会输、输了也能继续玩；面对新任务不敢开始时，再读《那张不敢画的白纸》。",
    faqs: [
      {
        question: "孩子输不起，下棋输了就哭闹掀棋盘，怎么办？",
        answer: "先接住失望：“你很想赢，输了很难过。”等情绪过去，再聊聊刚才哪一步走得好。平时大人可以故意输给孩子看，示范“输了有点难过，但下次还想玩”。不必刻意总让孩子赢，也不用为了挫折教育故意碾压。",
      },
      {
        question: "孩子遇到困难总说“我不会”，直接放弃，家长怎么帮？",
        answer: "先问清楚是哪一步卡住了，再把任务拆成孩子愿意尝试的下一小步，比如“先画一条线就好”。《陪孩子把路走长》讲的就是支持不是催促，而是一起找到下一步。",
      },
      {
        question: "怎么夸孩子，才能让他不怕失败？",
        answer: "少说“你真聪明”，多说具体的过程：“你换了三种方法，终于搭稳了。”被夸努力和方法的孩子，更愿意尝试有难度的事；被夸聪明的孩子，反而可能为了保住这个标签而回避挑战。",
      },
    ],
  },
  {
    id: "xue-xin-ben-ling",
    group: "parenting",
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
    startWith: "sanzijing/xiao-che-lun-man-man-zhuan",
    startHere: "这组绘本不必按顺序读，孩子最近在练哪项本领就先读哪一本。比如正在学骑车，就先读《小车轮，慢慢转》，读完带孩子去空地按书里的小步骤练一次。",
    faqs: [
      {
        question: "孩子学新本领没耐心，练两次不会就不想学了，怎么办？",
        answer: "把一项本领拆成几个小步骤，每次只练一步。比如跳绳先练甩绳、再练跨绳，最后才连续跳。每完成一步就停下来肯定一次，孩子会更愿意继续。这组绘本就是按这样的“小步子”讲的。",
      },
      {
        question: "几岁可以教孩子用筷子、系鞋带？",
        answer: "每个孩子手部发育的节奏不同，常见在学龄前后陆续开始练习。与其看年龄，不如看孩子是否有兴趣、手指是否能做出捏和夹的动作。先用大一点的食物和粗一点的鞋带练习，降低难度。",
      },
      {
        question: "孩子学骑车、游泳时害怕，要不要鼓励他“勇敢点”？",
        answer: "害怕通常说明孩子还没准备好。先保证安全，比如骑车先在平地低速练习、学游泳要有专业教学和近距保护，再让孩子自己决定什么时候尝试下一步。被尊重节奏的孩子，反而更快放下紧张。",
      },
    ],
  },
  {
    id: "qin-zi-gou-tong",
    group: "parenting",
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
    startWith: "richang/ma-ma-ni-shi-zai-xiong-wo-ma",
    startHere: "如果你今天刚对孩子发过脾气，先读《妈妈，你是在凶我吗》，它是给大人和孩子一起修复的；想让孩子愿意开口说学校的事，再读《放学路上，慢慢说》。",
    faqs: [
      {
        question: "对孩子吼完很后悔，事后该怎么修复？",
        answer: "等自己平静下来，蹲下来对孩子说：“刚才我声音太大了，吓到你了，对不起。”说清楚是大人没控制好情绪，而不是孩子不值得被爱。修复不会让大人失去威信，反而教会孩子犯错后怎样和好。",
      },
      {
        question: "孩子放学回家什么都不说，问了也只回“忘了”，怎么办？",
        answer: "比起“今天开心吗”，具体的小问题更容易回答，比如“今天午饭吃了什么”“谁坐在你旁边”。大人也可以先分享自己一天里的小事。《放学路上，慢慢说》讲的就是轻松地打开话匣子。",
      },
      {
        question: "爸爸妈妈意见不一致，在孩子面前要怎么处理？",
        answer: "有分歧很正常，关键是不让孩子夹在中间做选择。可以说“爸爸妈妈先商量一下，再告诉你”，商量好之后统一说明安排。《妈妈说可以，爸爸说不行》和《我们家的暂停手势》都在示范由大人来协调分歧。",
      },
    ],
  },
  {
    id: "shou-shi-yu-bian-jie",
    group: "parenting",
    name: "收拾与边界",
    searchLabel: "孩子收拾玩具与规则边界绘本",
    heading: "不爱收拾玩具、不愿排队、想保护自己的小秘密？读这几本",
    description: "满地玩具找不到小车、不愿一起收拾家务、排队等不及、照片和秘密想先被问问。这些绘本帮孩子练习整理、等待与表达个人边界，让规则变成商量出来的习惯。",
    idea: "客厅的玩具摊了一地，怎么叫孩子一起收拾他都不肯动",
    bookIds: [
      "richang/wan-ju-shan-li-zhao-xiao-che",
      "richang/zen-me-zhi-you-wo-zai-shou-shi",
      "sanzijing/xi-guan-hui-man-man-zhang-da",
      "richang/pai-dui-shi-de-na-yi-fen-zhong",
      "richang/wo-de-mi-mi-shei-neng-ting",
      "sanzijing/zhe-zhang-zhao-pian-xian-wen-wen-wo",
      "sanzijing/wo-de-zhi-xiang-ming-tian-zai-chai",
      "sanzijing/ai-jia-ren-ye-zun-zhong-zi-ji",
    ],
    startWith: "richang/wan-ju-shan-li-zhao-xiao-che",
    startHere: "想让孩子开始整理房间，先读《玩具山里找小车》，一起给常玩的玩具定一个容易拿、也容易放回的位置；如果孩子在意隐私、照片或未完成的手工，再读《这张照片先问问我》和《我的纸箱明天再拆》。",
    faqs: [
      {
        question: "孩子玩完不肯收拾玩具，催半天也没用怎么办？",
        answer: "比起喊一句“快把房间收干净”，把任务变具体更容易动手，比如“你收红色积木，我收小汽车”。玩具太多也会让孩子无从下手，可以像《玩具山里找小车》那样减少同时摊出来的数量，给每类玩具贴一个固定的家。",
      },
      {
        question: "怎么把好习惯落到日常，而不是靠大人天天念叨？",
        answer: "一次只练一件看得见的小事，比如回家先放水壶、睡前把绘本放回架子，并在顺手的位置做好收纳提示。《习惯会慢慢长大》讲的就是不用贴标签，把抽象要求变成孩子每天做得到的微习惯。",
      },
      {
        question: "这么小的孩子也需要隐私和个人边界吗？",
        answer: "需要。拍照发给亲友前先问一句、不随意替孩子转述他的小秘密、动他没搭完的纸箱前先商量，都是在示范尊重。在家里体验过边界被尊重的孩子，出门也更懂得尊重别人，也更清楚安全界限。《我的秘密谁能听》可以和孩子一起讨论。",
      },
    ],
  },
  {
    id: "shui-qian-gu-shi",
    group: "theme",
    name: "睡前故事",
    searchLabel: "4-8岁儿童睡前故事绘本",
    heading: "今晚讲什么睡前故事？安静、温柔、5分钟读完的晚安绘本",
    description: "怕黑想留一盏小灯、好奇为什么要睡觉、听一首月光下的唐诗、读一个不吓人的暖心日常。这组跨系列绘本节奏舒缓、画面柔和，陪 4–8 岁孩子在晚安前慢慢安静下来。",
    idea: "晚上关灯准备睡觉，孩子躺在被窝里想听一个关于月亮的温柔故事",
    bookIds: [
      "haoqi/wei-shen-me-yao-shui-jiao",
      "richang/jin-wan-de-xiao-deng-ke-yi-liang-zhe-ma",
      "haoqi/yue-liang-wei-shen-me-gen-zhe-wo-zou",
      "tangshi/jing-ye-si",
      "tangshi/zhu-li-guan",
      "tangshi/gu-lang-yue-xing",
      "richang/yi-ge-ren-wan-de-xia-wu",
      "richang/te-bie-de-ri-zi-shi-na-tian",
    ],
    startWith: "haoqi/wei-shen-me-yao-shui-jiao",
    startHere: "如果孩子到点还不肯上床，先读《为什么要睡觉》，用身体充电的故事把睡觉变成一件好理解的事；如果关灯后容易紧张，再读《今晚的小灯可以亮着吗》或月光主题的《静夜思》。",
    discussionPrompts: [
      "今天白天的哪一个小瞬间，你想把它放进今晚的梦里？",
      "如果月亮今天晚上也在窗外听故事，你猜它最喜欢刚才哪一页？",
      "我们现在把灯光调柔一点，你要听完这最后一页，还是闭上眼睛听我轻轻读？",
    ],
    faqs: [
      {
        question: "4–8 岁孩子适合听什么样的睡前故事？",
        answer: "适合节奏平缓、冲突柔和、5–8 分钟能完整收尾的故事，避免过于刺激或悬念太重的桥段。像《竹里馆》《静夜思》这类安静的月夜意境，或暖心的日常小故事，更容易帮孩子从白天的兴奋切换到入睡状态。",
      },
      {
        question: "孩子听完一本还要再听一本，睡前总是拖延怎么办？",
        answer: "上床前先一起选好今晚要读的 1 到 2 本，把它们放在枕边，读完就进入关灯晚安流程。固定顺序比临时讲条件更省力。如果孩子总问为什么必须早睡，可以在刷牙前一起读《为什么要睡觉》。",
      },
      {
        question: "睡前读双语绘本，会不会让孩子太兴奋睡不着？",
        answer: "只要不把睡前共读变成考单词或跟读打卡，就不会让孩子兴奋。可以慢速、轻声先读中文，英文当作韵律或只读孩子感兴趣的一两句，重点是陪伴感和熟悉的声音节奏。",
      },
    ],
  },
  {
    id: "jiao-tong-an-quan",
    group: "theme",
    name: "交通安全与汽车",
    searchLabel: "儿童交通安全与汽车科普绘本",
    heading: "红绿灯、救护车、校车盲区：陪孩子读懂交通安全与城市车辆",
    description: "绿灯亮了为什么还要等一等、安全带到底保护谁、校车为什么要停稳再下车、救护车和消防车为什么鸣笛。用孩子最爱的各种汽车，把过马路和乘车安全讲明白。",
    idea: "孩子过马路时总爱往前跑，想用红绿灯和小汽车的故事讲讲安全规则",
    bookIds: [
      "qiche/hong-lu-deng-wei-shen-me-hui-bian-se",
      "qiche/lv-deng-liang-le-wei-shen-me-hai-yao-deng-yi-deng",
      "qiche/xiao-che-wei-shen-me-yao-ting-wen-zai-xia-che",
      "qiche/an-quan-dai-bao-hu-shui",
      "qiche/jiu-hu-che-zen-yang-zheng-fen-duo-miao",
      "qiche/xiao-fang-che-wei-shen-me-yao-ming-di",
      "qiche/xiao-qi-che-de-deng-hui-shuo-hua-ma",
      "qiche/xiao-qi-che-zhao-dao-le-ting-che-wei",
      "qiche/gong-jiao-che-zen-me-fang-xia-yi-zuo-xiao-qiao",
    ],
    startWith: "qiche/hong-lu-deng-wei-shen-me-hui-bian-se",
    startHere: "日常过马路最实用的是信号灯与盲区意识。先读《红绿灯为什么会变色》和《绿灯亮了，为什么还要等一等？》，再结合家里坐车或坐校车的习惯，读《安全带保护谁》和《校车为什么要停稳再下车》。",
    discussionPrompts: [
      "明天过马路看到绿灯亮起来时，我们要先看哪两个方向再迈步？",
      "如果在路上听见救护车或消防车鸣笛，周围的小汽车应该怎样让出通道？",
      "坐在汽车后排时，为什么不管路程近不近都要先系好安全带？",
    ],
    faqs: [
      {
        question: "几岁可以开始给孩子做交通安全启蒙？",
        answer: "从 3–4 岁能牵手走上人行道就可以开始，4–8 岁最适合结合具体车辆和场景讲清原理。比起反复说“很危险”，像《红绿灯为什么会变色》《小汽车的灯，会说话吗？》这样把规则讲成故事，孩子出门时会主动观察和提醒大人。",
      },
      {
        question: "孩子坐车总嫌安全带或安全座椅不舒服，怎么沟通？",
        answer: "先让孩子明白安全带不是限制自由，而是在急刹车时拉住身体的保护伞，可以一起读《安全带保护谁》。平时大人自己也要前后排都系好安全带，做到“没系好不开车”，让它成为和关车门一样的固定动作。",
      },
      {
        question: "怎么向孩子解释汽车盲区和停车场安全？",
        answer: "在确保车辆熄火停稳的前提下，可以让孩子坐到驾驶座看看镜子里哪些位置看不见，把“司机看不见矮矮的小朋友”变成亲眼见到的事实。《校车为什么要停稳再下车》和《小汽车找到了停车位》都很适合出门前重温。",
      },
    ],
  },
  {
    id: "tian-qi-yu-zi-ran",
    group: "theme",
    name: "天气与自然为什么",
    searchLabel: "儿童十万个为什么自然科普绘本",
    heading: "天空为什么是蓝的、为什么会下雨？用绘本回答孩子的为什么",
    description: "天空为什么是蓝色的、彩虹是怎么来的、为什么先看到闪电再听到雷声、为什么会有春夏秋冬。把孩子散步和睡前常问的自然问题，讲成 4–8 岁听得懂的中英双语故事。",
    idea: "下完雨孩子指着天上的彩虹，一直问彩虹是怎么变出来的",
    bookIds: [
      "haoqi/tian-kong-wei-shen-me-shi-lan-se",
      "haoqi/wei-shen-me-hui-xia-yu",
      "haoqi/cai-hong-shi-zen-me-lai-de",
      "haoqi/wei-shen-me-xian-kan-dao-shan-dian-zai-ting-dao-lei-sheng",
      "haoqi/yun-wei-shen-me-hui-piao",
      "haoqi/xing-xing-wei-shen-me-hui-zha-yan",
      "haoqi/yue-liang-wei-shen-me-you-shi-yuan-you-shi-wan",
      "haoqi/wei-shen-me-you-chun-xia-qiu-dong",
      "haoqi/mao-mao-chong-wei-shen-me-bian-hu-die",
    ],
    startWith: "haoqi/tian-kong-wei-shen-me-shi-lan-se",
    startHere: "这组科普绘本最适合跟着当天的天气来读。晴天抬头先读《天空为什么是蓝色的》和《云为什么会飘》，下雨打雷读《为什么会下雨》和《为什么先看到闪电再听到雷声》，晚上散步回来读月亮和星星。",
    discussionPrompts: [
      "你今天出门看到的天空、云朵或树叶，和昨天有什么不一样？",
      "如果把水滴的旅行画成一张地图，它会先去哪里，再回到哪里？",
      "除了书里讲的这个问题，关于天气或小动物，你还冒出了什么新的“为什么”？",
    ],
    faqs: [
      {
        question: "孩子总爱连环追问“为什么”，家长答不上来怎么办？",
        answer: "完全不必假装全都知道，大方说“这个问题我也好奇，我们一起查一查”本身就是很好的科学示范。可以先让孩子说说自己的猜想，再一起翻一本对应的科普绘本，比如《天空为什么是蓝色的》，把提问变成共同探索。",
      },
      {
        question: "4–8 岁孩子的自然科普，需要讲得很专业吗？",
        answer: "不需要背诵复杂术语，重点是用孩子熟悉的生活经验打比方，建立因果和观察意识。比如读《为什么会下雨》时，顺手看看烧水壶口的小水珠，比背诵“水循环”定义更容易让孩子真正理解。",
      },
      {
        question: "怎么把读完的科普绘本变成日常生活里的小实验？",
        answer: "挑最安全、顺手就能做的观察：读完《彩虹是怎么来的》在阳光下用喷水壶找找七色光；读完《月亮为什么有时圆，有时弯》每周画一次今晚月亮的形状。亲眼验证过一次，孩子的印象会深得多。",
      },
    ],
  },
  {
    id: "tang-shi-qi-meng",
    group: "theme",
    name: "儿童唐诗启蒙",
    searchLabel: "儿童唐诗启蒙与小学必背古诗绘本",
    heading: "不靠死记硬背：看画读懂 10 首孩子最先认识的唐诗",
    description: "从《咏鹅》《静夜思》《春晓》到《悯农·其二》《游子吟》，每一首诗配完整插画、白话意境与英文翻译。不用考背诵，先让孩子在画面里看见诗意。",
    idea: "秋天带孩子去公园看红叶，想把《山行》的画面变成孩子的故事",
    bookIds: [
      "tangshi/yong-e",
      "tangshi/chun-xiao",
      "tangshi/jing-ye-si",
      "tangshi/min-nong-qi-er",
      "tangshi/deng-guan-que-lou",
      "tangshi/yong-liu",
      "tangshi/chi-shang",
      "tangshi/shan-xing",
      "tangshi/jiang-xue",
      "tangshi/you-zi-yin",
    ],
    startWith: "tangshi/yong-e",
    startHere: "刚开始接触古诗，先从画面鲜明、节奏轻快的五言绝句入手：先读《咏鹅》《春晓》《静夜思》，再按春夏秋冬的顺序读《咏柳》《池上》《山行》《江雪》，最后读讲惜粮与亲情的《悯农·其二》和《游子吟》。",
    discussionPrompts: [
      "在这首诗的插画里，你最先注意到哪一种颜色或哪一个小动作？",
      "如果闭上眼睛想象诗人站在这里，他除了看见画面，还听见了什么声音？",
      "这首诗里的画面，和我们最近去过的公园或见过的天气，哪里有点像？",
    ],
    faqs: [
      {
        question: "几岁开始给孩子做唐诗启蒙比较合适？",
        answer: "3–4 岁就可以像听儿歌一样听韵律，4–8 岁特别适合配合插画和故事理解诗里的画面。先从字句简短、意象具体的《咏鹅》《春晓》《静夜思》读起，不需要一开始就追求背诵数量。",
      },
      {
        question: "给孩子读古诗，一定要逐字解释和要求背下来吗？",
        answer: "不建议把共读变成逐字默写和抽查。孩子先看懂画面、听出节奏、喜欢上故事，往往多读几遍就自然记住了。出门看到柳树、红叶或月亮时顺口提起《咏柳》《山行》，比坐在书桌前硬背有效得多。",
      },
      {
        question: "唐诗配英文翻译，孩子能看懂吗？",
        answer: "英文翻译不是为了逐词对照考试，而是帮双语家庭或海外华裔孩子理解诗句背后的画面与情绪。共读时可以先朗读中文原诗感受平仄韵律，再结合插画和英文讲讲大意。",
      },
    ],
  },
  {
    id: "cheng-yu-pin-ge",
    group: "theme",
    name: "成语与品格智慧",
    searchLabel: "儿童成语故事与品格启蒙绘本",
    heading: "坚持、谦虚、守信与合作：给 4–8 岁孩子的成语和谚语故事",
    description: "遇到难事想放弃、做事太心急、借了东西忘了还、想和小伙伴一起完成大事。这组精选成语与谚语绘本把做人做事的道理藏在故事里，不讲大道理，读完自然有启发。",
    idea: "孩子练字总是急着写完，想用“心急吃不了热豆腐”讲一个慢慢来的故事",
    bookIds: [
      "chengyu/cao-chong-cheng-xiang",
      "chengyu/yu-gong-yi-shan",
      "chengyu/tie-chu-cheng-zhen",
      "chengyu/jing-di-zhi-wa",
      "chengyu/wang-yang-bu-lao",
      "yanyu/xin-ji-chi-bu-liao-re-dou-fu",
      "yanyu/zhong-ren-shi-chai",
      "yanyu/you-jie-you-huan",
      "yanyu/mo-dao-bu-wu-kan-chai-gong",
    ],
    startWith: "chengyu/cao-chong-cheng-xiang",
    startHere: "想让孩子爱上成语故事，先读充满巧思的《曹冲称象》；练耐心和坚持时读《铁杵成针》《心急吃不了热豆腐》，和小伙伴配合或谈借还规则时，再读《众人拾柴火焰高》和《有借有还，再借不难》。",
    discussionPrompts: [
      "如果换成你是故事里的主角，在遇到这个难题时还会想到什么新办法？",
      "你最近有没有哪件小事，也是因为慢慢试、没有放弃才做成的？",
      "这个成语或谚语，如果用到我们家这周发生的事里，最适合形容哪一次？",
    ],
    faqs: [
      {
        question: "4–8 岁孩子听成语故事，怎样讲才不会像说教？",
        answer: "把重心放在故事里的处境和选择，而不是结尾的“所以你要听话”。读完《曹冲称象》或《亡羊补牢》，可以聊聊“如果你在现场会怎么想”，让孩子自己把故事里的办法联系到生活。",
      },
      {
        question: "孩子听懂了成语故事，但不会在日常说话里用怎么办？",
        answer: "先由大人在贴切的生活场景里自然说出来，比如一起搭大积木时说一句“真是众人拾柴火焰高”，或做手工前准备工具时提起《磨刀不误砍柴工》。在真实语境里听过几次，孩子自己就会用。",
      },
      {
        question: "成语故事和谚语故事，选哪一类给孩子启蒙更好？",
        answer: "两者可以穿插着读：成语多来自历史和寓言，画面感强、利于识字与文化积累；谚语像《心急吃不了热豆腐》《有借有还，再借不难》语言更口语化，贴近生活里的等待、合作与守信。",
      },
    ],
  },
];

export function getAllTopics(): LibraryTopic[] {
  return TOPICS;
}

export function getTopicsByGroup(group: LibraryTopicGroup): LibraryTopic[] {
  return TOPICS.filter((topic) => topic.group === group);
}

export function getTopic(topicId: string): LibraryTopic | null {
  return TOPICS.find((topic) => topic.id === topicId) ?? null;
}

export function getSeriesTopics(seriesId: string): LibraryTopic[] {
  return TOPICS.filter((topic) => topic.bookIds.some((id) => id.startsWith(`${seriesId}/`)));
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
