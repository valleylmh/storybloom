import type { StoryPage } from "@/types";
import type { LibraryBook, LibrarySeries } from "@/types/library";

// 任务 B：前 2 回已完成文字审核、角色一致性检查和插图验收；后续回目继续复用
// docs/library-prompts/xiyouji/characters.md 的系列级角色锚点与低龄改编原则。

const XIYOUJI_STYLE_LOCK =
  "premium polished 3D clay-like animated-film children's picture-book illustration, warm cinematic light, tactile handmade textures, expressive rounded characters, mythical ancient China setting, square 1:1 composition; no image text, letters, speech bubbles, logos, watermark, modern objects, weapons pointed at anyone, injury, blood, fear, or scary imagery.";

const BARE_STONE_MONKEY_LOCK =
  "Character lock — the stone monkey is a small lively monkey with warm golden-brown fur, a bare tan face and chest, big bright amber eyes, round ears, and a long expressive tail; he wears no clothes or accessories yet, and has cheerful, curious, never-menacing expressions with child-friendly rounded animated-film proportions.";

const MONKEY_KING_LOCK =
  "Character lock — Sun Wukong is a small lively monkey with warm golden-brown fur, a bare tan face and chest, big bright amber eyes, round ears, and a long expressive tail; from his coronation onward he wears the same golden-yellow sleeveless tunic, vermilion sash, and dark red trousers, with no crown, circlet, armor, or staff; cheerful, curious, never menacing, with child-friendly rounded animated-film proportions.";

const MASTER_PUTI_LOCK =
  "Character lock — Master Puti is a serene elderly sage with a long flowing white beard and eyebrows, hair in a high topknot, layered cream-and-sage Taoist robes with wide sleeves, and a wooden staff; kind, wise, and gently smiling.";

const SHI_HOU_CHU_SHI_PAGES: Array<{ zh: string; en: string; prompt: string }> = [
  {
    zh: "东海之上有座花果山，山顶立着一块吸收了日月光华的仙石。",
    en: "In the Eastern Sea rose the Mountain of Flowers and Fruit, where a magic stone drank in the light of sun and moon.",
    prompt:
      "Mythical Mountain of Flowers and Fruit rising from a sparkling eastern sea at dawn; a smooth egg-shaped magic stone glows warmly on the peak, wrapped in soft sun-and-moon light; waterfalls, peach trees, and drifting clouds; wide establishing scene; premium polished 3D clay-like animated-film children's picture-book illustration, square 1:1 composition; no text in image.",
  },
  {
    zh: "轰的一声，仙石裂开，蹦出一只灵巧的小石猴，眼睛亮晶晶。",
    en: "With a great crack, the stone split open — and out sprang a nimble little stone monkey with bright shining eyes.",
    prompt: `${BARE_STONE_MONKEY_LOCK} The magic stone splits with sparkling light as the stone monkey leaps out joyfully mid-air; petals and light motes swirl, and delighted birds watch. ${XIYOUJI_STYLE_LOCK}`,
  },
  {
    zh: "小石猴很快和山里的猴群玩到了一起，爬树、摘桃、捉迷藏。",
    en: "The little stone monkey soon joined the mountain monkeys — climbing trees, picking peaches, playing hide-and-seek.",
    prompt: `${BARE_STONE_MONKEY_LOCK} The stone monkey plays happily with a troop of smaller gray-brown monkeys with cream faces among peach trees; one hangs upside down and one shares a peach; playful chase energy in warm afternoon light. ${XIYOUJI_STYLE_LOCK}`,
  },
  {
    zh: "一天，猴子们发现一道大瀑布：“谁敢钻进去，我们就拜他为王！”",
    en: "One day the monkeys found a great waterfall. \"Whoever dares to leap through shall be our king!\"",
    prompt: `${BARE_STONE_MONKEY_LOCK} A grand silver waterfall pours down mossy cliffs; excited smaller gray-brown monkeys with cream faces gather on the rocks below and gesture at the rushing water, while the stone monkey stands forward on a boulder, curious and brave. ${XIYOUJI_STYLE_LOCK}`,
  },
  {
    zh: "小石猴闭上眼睛，纵身一跳，穿过水帘，稳稳落在了石桥上。",
    en: "The stone monkey shut his eyes and leapt — through the curtain of water, landing safely on a stone bridge.",
    prompt: `${BARE_STONE_MONKEY_LOCK} Mid-leap moment: the stone monkey springs through the shimmering water curtain with arms spread and a determined smile, droplets scattering like pearls; behind the falls a hidden stone bridge appears; dynamic but safe motion. ${XIYOUJI_STYLE_LOCK}`,
  },
  {
    zh: "水帘后面藏着一座石头洞府，锅碗桌椅样样齐全，正好安家！",
    en: "Behind the waterfall lay a stone cave home — with stone pots, bowls, tables and chairs, all ready for a family!",
    prompt: `${BARE_STONE_MONKEY_LOCK} Inside the Water Curtain Cave, a cozy stone hall holds stone tables, bowls, and little beds, softly lit by light filtering through the waterfall; the stone monkey explores with delight and touches a stone chair; wonder and warmth. ${XIYOUJI_STYLE_LOCK}`,
  },
  {
    zh: "猴子们欢呼着涌进洞府，齐声说：“美猴王！美猴王！”",
    en: "The monkeys poured in, cheering together: \"Handsome Monkey King! Handsome Monkey King!\"",
    prompt: `${MONKEY_KING_LOCK} Celebration and coronation in the Water Curtain Cave: the troop of smaller gray-brown monkeys with cream faces joyfully surrounds the newly named Monkey King, who has just received his golden-yellow tunic, vermilion sash, and dark red trousers and now sits laughing on a smooth stone seat; they offer peaches and flowers; festive, warm, communal happiness. ${XIYOUJI_STYLE_LOCK}`,
  },
  {
    zh: "从此，花果山有了自己的猴王。而小猴王心里，还装着更大的世界。",
    en: "And so the mountain had its Monkey King — whose bright eyes already dreamed of a wider world.",
    prompt: `${MONKEY_KING_LOCK} Quiet reflective ending at dusk: the Monkey King sits atop the mountain peak beside the old cracked stone, gazing at the glowing horizon over the sea where distant lands shimmer; peaceful wonder and gentle ambition. ${XIYOUJI_STYLE_LOCK}`,
  },
];

const BAI_SHI_XUE_YI_PAGES: Array<{ zh: string; en: string; prompt: string }> = [
  {
    zh: "猴王想学真本领，便扎了木筏，漂过大海去寻访仙师。",
    en: "Longing to learn real skills, the Monkey King built a raft and sailed across the sea to find a master.",
    prompt: `${MONKEY_KING_LOCK} Sun Wukong stands on a small wooden raft, paddling across gentle sunlit waves with determination while the Mountain of Flowers and Fruit fades behind him; hopeful adventure mood. ${XIYOUJI_STYLE_LOCK}`,
  },
  {
    zh: "他走过许多地方，终于在灵台方寸山找到一座清幽的道观。",
    en: "After a long journey he reached a peaceful temple on the Mountain of Heart and Mind.",
    prompt: `${MONKEY_KING_LOCK} A serene Taoist temple nestles among misty pines and blossoming trees on a mystical mountain; Sun Wukong climbs the stone steps toward the gate and looks up in awe; tranquil morning light. ${XIYOUJI_STYLE_LOCK}`,
  },
  {
    zh: "菩提祖师收下了这只诚心的猴子，给他取名——孙悟空。",
    en: "The wise Master Puti accepted the sincere monkey and gave him a name — Sun Wukong.",
    prompt: `${MONKEY_KING_LOCK} ${MASTER_PUTI_LOCK} Inside the temple hall, Master Puti gently raises one hand in blessing toward the kneeling Sun Wukong, who beams with gratitude as he receives his new name; incense curls in soft golden light. ${XIYOUJI_STYLE_LOCK}`,
  },
  {
    zh: "悟空每天扫地挑水、诵读练功，一点也不偷懒。",
    en: "Wukong swept the yard, carried water, studied and practiced every day — never once lazy.",
    prompt: `${MONKEY_KING_LOCK} Montage-free single scene: Sun Wukong sweeps the temple courtyard with a big broom while a water bucket rests nearby; other students read scrolls under a pine; diligent cheerful energy in morning light. ${XIYOUJI_STYLE_LOCK}`,
  },
  {
    zh: "祖师轻轻敲了三下桌边。悟空明白：等大家休息后，再到安静的书房请教。",
    en: "The Master gently tapped the table three times. Wukong understood: return to the quiet study after everyone had gone to rest.",
    prompt: `${MONKEY_KING_LOCK} ${MASTER_PUTI_LOCK} Playful secret moment in the temple hall: Master Puti gently taps the edge of a wooden table three times with one finger and hides a knowing smile; Sun Wukong's amber eyes sparkle as he understands, while the other students look mildly puzzled; warm lamplight, safe and gentle mood. ${XIYOUJI_STYLE_LOCK}`,
  },
  {
    zh: "从那以后，祖师耐心讲解七十二变和筋斗云，悟空一遍遍认真练习。",
    en: "From then on, the Master patiently taught the seventy-two transformations and the cloud somersault, while Wukong practiced them again and again.",
    prompt: `${MONKEY_KING_LOCK} ${MASTER_PUTI_LOCK} In a quiet moonlit temple study, Master Puti patiently demonstrates a hand gesture while Sun Wukong listens cross-legged and practices with focused care; an open scroll, fireflies, and a gentle moon suggest many evenings of steady learning rather than instant mastery; intimate teacher-student warmth. ${XIYOUJI_STYLE_LOCK}`,
  },
  {
    zh: "经过许多年练习，悟空一个筋斗能翻十万八千里，还学会变小鸟、松树和铜钱。",
    en: "After years of practice, Wukong could travel one hundred and eight thousand li in a single somersault and transform into a bird, a pine tree, or even a coin.",
    prompt: `${MONKEY_KING_LOCK} Joyful practice scene after years of training above the temple clearing: Sun Wukong rides a fluffy golden somersault cloud in a wide arc across the sky, while small friendly magical silhouettes of a bird, a pine tree, and a round coin suggest his transformations; classmates below cheer; confident skill earned through long practice. ${XIYOUJI_STYLE_LOCK}`,
  },
  {
    zh: "许多年后，悟空学有所成，拜别祖师：“师父的教导，我永远记在心里。”",
    en: "Many years later, with his training complete, Wukong bowed farewell: \"Master, I will always carry your teaching in my heart.\"",
    prompt: `${MONKEY_KING_LOCK} ${MASTER_PUTI_LOCK} Touching farewell at the temple gate at sunrise: Sun Wukong bows deeply with his hands respectfully joined before Master Puti, whose cream-and-sage robes and long white beard stir in the gentle wind as he nods kindly; pink blossom petals drift; gratitude after many years of learning and a sense of new beginnings. ${XIYOUJI_STYLE_LOCK}`,
  },
];

function toStoryPages(
  bookId: string,
  items: Array<{ zh: string; en: string; prompt: string }>,
  imageStatus: NonNullable<StoryPage["imageStatus"]>,
): StoryPage[] {
  return items.map((item, index) => ({
    page: index + 1,
    zhText: item.zh,
    enText: item.en,
    illustrationPrompt: item.prompt,
    imageUrl: `/library/xiyouji/${bookId}/${index + 1}.webp`,
    imageStatus,
  }));
}

export const XIYOUJI_BOOKS: LibraryBook[] = [
  {
    id: "shi-hou-chu-shi",
    seriesId: "xiyouji",
    title: "石猴出世",
    subtitle: "花果山上蹦出的小猴王",
    origin: "《西游记》第一回（低龄改编）",
    moral: {
      zh: "勇敢迈出第一步的人，才能发现藏在后面的新世界。",
      en: "Only those who dare the first leap discover the new world waiting behind.",
    },
    pages: toStoryPages("shi-hou-chu-shi", SHI_HOU_CHU_SHI_PAGES, "complete"),
    ageLabel: "4-8 岁",
    publishedAt: "2026-07-22",
    order: 1,
    episodeNumber: 1,
  },
  {
    id: "bai-shi-xue-yi",
    seriesId: "xiyouji",
    title: "拜师学艺",
    subtitle: "悟空的名字和筋斗云",
    origin: "《西游记》第一至二回（低龄改编）",
    moral: {
      zh: "真本领来自诚心和坚持，一天一点，慢慢练成。",
      en: "Real skill grows from sincerity and practice — a little every day.",
    },
    pages: toStoryPages("bai-shi-xue-yi", BAI_SHI_XUE_YI_PAGES, "complete"),
    ageLabel: "4-8 岁",
    publishedAt: "2026-07-22",
    order: 2,
    episodeNumber: 2,
  },
];

export const XIYOUJI_SERIES: LibrarySeries = {
  id: "xiyouji",
  title: "西游记",
  subtitle: "跟着悟空去取经",
  description:
    "经典名著《西游记》低龄温和改编连载：每回一本 8 页中英双语绘本，打斗变成智斗，妖怪也不吓人，适合亲子共读。",
  accent: "#5c7560",
  ageRange: "4-8 岁",
  bookCount: XIYOUJI_BOOKS.length,
};
