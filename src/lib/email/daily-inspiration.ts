import "server-only";

import { z } from "zod";
import { getStoryTextEndpoint } from "@/lib/story-generator";

export type DailyInspirationSource = "generated" | "fallback";

export type DailyInspirationContent = {
  issue_date: string;
  theme: string;
  title_zh: string;
  title_en: string;
  opening_zh: string;
  opening_en: string;
  questions_zh: string[];
  questions_en: string[];
  story_prompt_zh: string;
  story_prompt_en: string;
  source: DailyInspirationSource;
};

type InspirationSeed = Omit<DailyInspirationContent, "issue_date" | "source">;

const generatedSchema = z.object({
  theme: z.string().trim().min(2).max(40),
  title_zh: z.string().trim().min(2).max(60),
  title_en: z.string().trim().min(2).max(100),
  opening_zh: z.string().trim().min(12).max(260),
  opening_en: z.string().trim().min(20).max(420),
  questions_zh: z.array(z.string().trim().min(2).max(80)).length(3),
  questions_en: z.array(z.string().trim().min(3).max(140)).length(3),
  story_prompt_zh: z.string().trim().min(8).max(100),
  story_prompt_en: z.string().trim().min(12).max(100),
});

const DEFAULT_CPA_TEXT_MODEL = "gemini-3-flash";
const DEFAULT_AGNES_TEXT_MODEL = "agnes-2.5-flash";

type CpaChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
  errors?: Array<{ message?: string }>;
};

const FALLBACK_INSPIRATIONS: InspirationSeed[] = [
  {
    theme: "表达与倾听",
    title_zh: "不敢开口的小云朵",
    title_en: "The Little Cloud Who Was Afraid to Speak",
    opening_zh: "一朵小云总担心自己说错话，直到它遇见一只愿意耐心听完的小鸟。小鸟没有催促，只是陪它慢慢把心里的雨滴变成一句完整的话。",
    opening_en: "A little cloud worried that every word might come out wrong, until it met a bird who was happy to listen without rushing.",
    questions_zh: ["你有没有想说却没敢说的话？", "如果云朵会说话，它的声音是什么样？", "谁是你最愿意倾听的朋友？"],
    questions_en: ["Have you ever wanted to say something but felt shy?", "What would a cloud's voice sound like?", "Who makes you feel truly heard?"],
    story_prompt_zh: "一个不敢开口的小云朵，在小鸟的陪伴下勇敢说出心里话",
    story_prompt_en: "A shy little cloud learns to share its feelings with a patient bird",
  },
  {
    theme: "勇气与尝试",
    title_zh: "第一次滑下高高的滑梯",
    title_en: "The Very Tall Slide",
    opening_zh: "游乐场里最高的滑梯像一座小山。孩子站在台阶顶端有点害怕，却发现风、树叶和下面等待的朋友都在轻轻为自己加油。",
    opening_en: "The tallest slide looked like a mountain. At the top, a child felt nervous, while the breeze, the leaves, and a waiting friend quietly cheered.",
    questions_zh: ["第一次尝试新事情时，身体会有什么感觉？", "什么样的鼓励最有用？", "勇敢是不是一定不能害怕？"],
    questions_en: ["How does your body feel before trying something new?", "What kind of encouragement helps most?", "Can you be brave and still feel afraid?"],
    story_prompt_zh: "孩子第一次挑战高高的滑梯，在朋友鼓励下发现勇敢可以慢慢来",
    story_prompt_en: "A child faces a very tall slide and learns that courage can happen one small step at a time",
  },
  {
    theme: "分享与友谊",
    title_zh: "只剩最后一块星星饼干",
    title_en: "The Last Star Cookie",
    opening_zh: "野餐篮里只剩下一块香香的星星饼干，两位好朋友都很喜欢。正当他们不知道怎么办时，饼干上的糖粒突然像夜空一样亮了起来。",
    opening_en: "Only one star-shaped cookie remained in the picnic basket, and both friends loved it. Then its sugar sprinkles began to glow like a tiny night sky.",
    questions_zh: ["如果只有一块饼干，你会怎么分？", "分享后心里会有什么变化？", "除了食物，还能分享什么？"],
    questions_en: ["How would you share one cookie?", "How can sharing change the way you feel?", "What can we share besides food?"],
    story_prompt_zh: "两个好朋友遇到最后一块星星饼干，想出一个让快乐变多的分享办法",
    story_prompt_en: "Two friends find one last star cookie and invent a way to make the happiness grow",
  },
  {
    theme: "情绪与安慰",
    title_zh: "把坏心情装进纸船",
    title_en: "A Paper Boat for a Stormy Feeling",
    opening_zh: "今天的坏心情像一场闷闷的小雨，怎么也停不下来。孩子把烦恼画在纸上折成小船，让它沿着水沟慢慢驶向会发光的远方。",
    opening_en: "A gloomy feeling lingered like a small rainstorm. A child drew the worry on paper, folded it into a boat, and watched it sail toward a glowing distance.",
    questions_zh: ["坏心情像什么天气？", "难过时什么事情能让你舒服一点？", "如果纸船能带走一句话，你想写什么？"],
    questions_en: ["What kind of weather matches a gloomy feeling?", "What helps you feel a little better?", "What message would you send away on a paper boat?"],
    story_prompt_zh: "孩子把坏心情折成一艘纸船，在小雨后的旅程里重新找到轻松",
    story_prompt_en: "A child folds a stormy feeling into a paper boat and finds calm after the rain",
  },
  {
    theme: "自然与发现",
    title_zh: "阳台上来了新邻居",
    title_en: "A New Neighbor on the Balcony",
    opening_zh: "清晨，花盆边多了一条细细的银色小路。孩子沿着痕迹寻找，发现一只背着圆房子的蜗牛，正认真地观察这个陌生的新家。",
    opening_en: "One morning, a silver trail appeared beside the flowerpot. Following it, a child found a snail carefully exploring its unfamiliar new home.",
    questions_zh: ["蜗牛走过的路为什么会亮？", "怎样观察小动物才不会打扰它？", "如果蜗牛来做客，你会介绍什么？"],
    questions_en: ["Why does a snail leave a shiny trail?", "How can we watch small animals without disturbing them?", "What would you show a visiting snail?"],
    story_prompt_zh: "孩子在阳台发现一只蜗牛新邻居，学会温柔观察并帮它找到安全的家",
    story_prompt_en: "A child meets a snail on the balcony and gently helps it find a safe home",
  },
  {
    theme: "睡眠与安全感",
    title_zh: "月亮忘记关灯了",
    title_en: "The Moon Forgot to Turn Off the Light",
    opening_zh: "夜深了，窗外还是亮亮的，原来月亮忘记关灯。睡不着的孩子决定隔着窗户提醒它，却意外收到了一小袋柔软的月光。",
    opening_en: "Late at night, the window was still glowing because the moon had forgotten to turn off its light. A wakeful child tried to remind it and received a pouch of soft moonlight.",
    questions_zh: ["睡觉前什么会让你安心？", "月光摸起来会是什么感觉？", "你会怎样提醒健忘的月亮？"],
    questions_en: ["What helps you feel safe at bedtime?", "What might moonlight feel like?", "How would you remind a forgetful moon?"],
    story_prompt_zh: "睡不着的孩子提醒月亮关灯，得到一份能带来安心梦境的月光礼物",
    story_prompt_en: "A wakeful child helps the moon turn down its light and receives a gift for peaceful dreams",
  },
  {
    theme: "创造与想象",
    title_zh: "纸箱里的秘密车站",
    title_en: "The Secret Station Inside a Cardboard Box",
    opening_zh: "客厅里的旧纸箱突然传来一声轻轻的汽笛。孩子画上车窗和车轮，钻进去后发现它正在等待一位列车长，开往所有人都没去过的地方。",
    opening_en: "A soft train whistle came from an old cardboard box. After drawing windows and wheels, a child climbed in and discovered a train waiting for its conductor.",
    questions_zh: ["纸箱还能变成什么？", "你的列车第一站在哪里？", "旅行时最想带谁一起去？"],
    questions_en: ["What else could a cardboard box become?", "Where would your train stop first?", "Who would you bring on the journey?"],
    story_prompt_zh: "孩子把旧纸箱变成秘密列车，担任列车长去往想象中的奇妙车站",
    story_prompt_en: "A child turns an old box into a secret train and leads a journey to imaginary stations",
  },
  {
    theme: "责任与成长",
    title_zh: "今天由我照顾小种子",
    title_en: "Today I Take Care of the Tiny Seed",
    opening_zh: "一颗小种子住进了透明杯子，每天都需要一点水、阳光和耐心。孩子很想马上看见花，却慢慢发现成长有自己的时间。",
    opening_en: "A tiny seed moved into a clear cup and needed water, sunlight, and patience. A child wanted a flower right away, but growth followed its own clock.",
    questions_zh: ["植物每天需要什么？", "等待的时候可以做些什么？", "你照顾过什么东西？"],
    questions_en: ["What does a plant need each day?", "What can you do while waiting?", "What have you taken care of?"],
    story_prompt_zh: "孩子每天照顾一颗小种子，在等待发芽的过程中学会耐心和责任",
    story_prompt_en: "A child cares for a tiny seed and learns patience while waiting for it to sprout",
  },
  {
    theme: "接纳与独特",
    title_zh: "斑点不一样的小瓢虫",
    title_en: "The Ladybug with Different Spots",
    opening_zh: "花园里的瓢虫都有整齐的圆点，只有一只小瓢虫的斑点像月牙、星星和歪歪的爱心。它本想把斑点藏起来，却发现这些形状能画出一张特别的地图。",
    opening_en: "Every ladybug had neat round spots except one, whose markings looked like moons, stars, and crooked hearts. Those unusual spots became a remarkable map.",
    questions_zh: ["每个人有什么不一样的地方？", "特别和奇怪有什么区别？", "你的专属地图会通往哪里？"],
    questions_en: ["What makes each person different?", "Can something unusual become special?", "Where would your own secret map lead?"],
    story_prompt_zh: "一只斑点与众不同的小瓢虫，把曾经想藏起来的特点变成帮助大家的地图",
    story_prompt_en: "A ladybug turns its unusual spots into a map that helps the whole garden",
  },
  {
    theme: "合作与解决问题",
    title_zh: "搬不动的巨大南瓜",
    title_en: "The Pumpkin Too Big to Move",
    opening_zh: "菜园里长出了一只比小车还大的南瓜。兔子推、刺猬拉、小熊抱，谁也搬不动，直到他们开始听清彼此的节奏。",
    opening_en: "A pumpkin grew larger than a wagon. Rabbit pushed, Hedgehog pulled, and Bear hugged it tightly, but it moved only when everyone found the same rhythm.",
    questions_zh: ["一个人做不到时可以怎么办？", "合作为什么需要听口令？", "大南瓜最后可以做成什么？"],
    questions_en: ["What can you do when a task is too big alone?", "Why does teamwork need listening?", "What could everyone make from the giant pumpkin?"],
    story_prompt_zh: "动物朋友们合作搬运巨大南瓜，在寻找共同节奏时学会倾听和配合",
    story_prompt_en: "Animal friends work together to move a giant pumpkin by listening and finding one rhythm",
  },
  {
    theme: "告别与纪念",
    title_zh: "秋风收藏的那片叶子",
    title_en: "The Leaf the Autumn Wind Kept",
    opening_zh: "最喜欢的那片红叶从树枝上飘走了，孩子追了很久也没有追上。秋风却带来一封沙沙作响的信，告诉孩子美好的相遇不会因为告别而消失。",
    opening_en: "A favorite red leaf floated away before a child could catch it. Then the autumn wind delivered a rustling letter about how good memories remain after goodbye.",
    questions_zh: ["你收藏过哪一次美好的回忆？", "告别时可以怎样表达想念？", "秋风的信会写些什么？"],
    questions_en: ["What happy memory would you keep?", "How can we express that we miss someone or something?", "What might the autumn wind write in a letter?"],
    story_prompt_zh: "孩子追寻一片被秋风带走的红叶，学会用回忆珍藏一次温柔的告别",
    story_prompt_en: "A child follows a red leaf carried by autumn wind and learns to keep a goodbye as a warm memory",
  },
  {
    theme: "好奇与科学",
    title_zh: "影子为什么一直跟着我",
    title_en: "Why Does My Shadow Follow Me?",
    opening_zh: "散步时，影子一会儿变长，一会儿变短，还会在转弯时突然跑到另一边。孩子决定和影子玩一场侦探游戏，寻找光藏在哪里。",
    opening_en: "On a walk, a shadow grew long, became short, and jumped to the other side at every turn. A child began a detective game to find where the light was hiding.",
    questions_zh: ["什么时候影子最长？", "没有光还会有影子吗？", "你能用影子做出什么动物？"],
    questions_en: ["When does a shadow look longest?", "Can there be a shadow without light?", "What animal can you make with a shadow?"],
    story_prompt_zh: "孩子和总在变化的影子玩侦探游戏，在散步中发现光与影子的秘密",
    story_prompt_en: "A child plays detective with a changing shadow and discovers how light shapes it",
  },
];

function dateIndex(dateKey: string) {
  return Array.from(dateKey).reduce((total, character) => total + character.charCodeAt(0), 0);
}

export function getFallbackDailyInspiration(dateKey: string): DailyInspirationContent {
  const seed = FALLBACK_INSPIRATIONS[dateIndex(dateKey) % FALLBACK_INSPIRATIONS.length];
  return { ...seed, issue_date: dateKey, source: "fallback" };
}

export function getShanghaiDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return [values.year, values.month, values.day].join("-");
}

function extractJson(value: string) {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Daily inspiration model response did not contain JSON");
  }
  return JSON.parse(value.slice(start, end + 1)) as unknown;
}

export async function generateDailyInspiration(
  dateKey: string,
): Promise<DailyInspirationContent> {
  const endpoint = getStoryTextEndpoint();
  if (!endpoint) {
    return getFallbackDailyInspiration(dateKey);
  }

  const fallback = getFallbackDailyInspiration(dateKey);
  const controller = new AbortController();
  const timeoutMs = Number.parseInt(
    process.env.CPA_TEXT_TIMEOUT_MS ||
      process.env.NEWSLETTER_TEXT_TIMEOUT_MS ||
      "30000",
    10,
  );
  const timeout = setTimeout(
    () => controller.abort(),
    Number.isFinite(timeoutMs) ? timeoutMs : 30000,
  );

  try {
    const response = await fetch(endpoint.baseUrl + "/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + endpoint.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:
          process.env.STORY_TEXT_MODEL?.trim() ||
          (endpoint.provider === "agnes"
            ? DEFAULT_AGNES_TEXT_MODEL
            : DEFAULT_CPA_TEXT_MODEL),
        temperature: 0.9,
        max_tokens: 1400,
        messages: [
          {
            role: "system",
            content: [
              "You create one warm, specific daily picture-book idea for families with children aged 3-8.",
              "Avoid marketing language, danger, shame, diagnoses, and moralizing.",
              "Return JSON only with these keys:",
              "theme, title_zh, title_en, opening_zh, opening_en, questions_zh, questions_en, story_prompt_zh, story_prompt_en.",
              "theme must be a short Chinese theme label.",
              "questions_zh and questions_en must each contain exactly 3 short parent-child conversation questions.",
              "story_prompt fields must be standalone one-sentence prompts suitable for generating a complete children's storybook.",
            ].join(" "),
          },
          {
            role: "user",
            content: [
              "Issue date: " + dateKey + ".",
              "Create a fresh idea different from this fallback theme: " + fallback.theme + ".",
              "Chinese should feel natural to families in mainland China. English should be idiomatic, not a literal translation.",
            ].join(" "),
          },
        ],
      }),
      signal: controller.signal,
    });
    const responseText = await response.text();
    let payload: CpaChatCompletionResponse;
    try {
      payload = responseText
        ? (JSON.parse(responseText) as CpaChatCompletionResponse)
        : {};
    } catch {
      throw new Error("CPA daily inspiration returned invalid JSON");
    }
    if (!response.ok) {
      const providerMessage =
        payload.errors?.[0]?.message ||
        payload.error?.message ||
        "HTTP " + response.status;
      throw new Error("CPA daily inspiration failed: " + providerMessage);
    }
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("CPA daily inspiration returned empty content");
    }
    const generated = generatedSchema.parse(extractJson(content));
    return { ...generated, issue_date: dateKey, source: "generated" };
  } catch (error) {
    console.error("CPA daily inspiration fell back to curated content", error);
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}
