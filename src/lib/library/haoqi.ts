import type { StoryPage } from "@/types";
import type { LibraryBook, LibrarySeries } from "@/types/library";

// 任务 C：前 2 本已完成科学性审核和插图验收；后续内容继续遵守
// “简化但不错误”的原则（见 docs/feature-roadmap-tasks.md 任务 C）。

const TIAN_KONG_LAN_PAGES: Array<{ zh: string; en: string; prompt: string }> = [
  {
    zh: "下午散步时，朵朵仰起头问：“妈妈，天空为什么是蓝色的呀？”",
    en: "On an afternoon walk, Duoduo looked up and asked, \"Mama, why is the sky blue?\"",
    prompt:
      "A curious 5-year-old Chinese girl with two round hair buns, coral dress and white sneakers walks with her warm-smiling mother in a park at golden hour, pointing up at the wide blue sky; premium polished 3D clay-like animated-film children's picture-book illustration, square 1:1 composition; no text in image.",
  },
  {
    zh: "妈妈说：“阳光看起来是白色的，其实里面藏着彩虹一样的各种颜色呢。”",
    en: "Mama said, \"Sunlight looks white, but it holds all the colors of the rainbow.\"",
    prompt:
      "Mother kneels beside Duoduo holding up a small glass prism; a soft rainbow band of seven colors spreads from a sunbeam onto the path; both marvel at it; premium polished 3D clay-like animated-film children's picture-book illustration, square 1:1 composition; no text in image.",
  },
  {
    zh: "“阳光穿过大气层时，会遇到数不清、肉眼看不见的气体分子。”",
    en: "\"As sunlight travels through the atmosphere, it meets countless gas molecules too tiny to see.\"",
    prompt:
      "Dreamlike visualization: a wide sunbeam travels from a friendly smiling sun through clear atmosphere filled with countless tiny softly glowing dots symbolizing invisible gas molecules, explicitly clean air with no dust, smoke, or haze; gentle scale and wonder, no faces on molecules; premium polished 3D clay-like animated-film children's picture-book illustration, square 1:1 composition; no text in image.",
  },
  {
    zh: "“蓝色光的波纹更短，遇到气体分子时，更容易朝四面八方散开。”",
    en: "\"Blue light has shorter waves, so gas molecules scatter it more easily in every direction.\"",
    prompt:
      "Playful diagram-like scene: short glowing blue light waves meet tiny stylized gas molecules and scatter across the whole sky dome, while longer warm-color waves continue more directly; joyful motion, clear clean atmosphere with no dust or haze, child-safe and dreamy; premium polished 3D clay-like animated-film children's picture-book illustration, square 1:1 composition; no text in image.",
  },
  {
    zh: "“散开的蓝光铺满天空，所以我们抬头看，到处都是蓝色。”",
    en: "\"That scattered blue fills the whole sky — so everywhere we look, we see blue.\"",
    prompt:
      "Duoduo and her mother stand in the park looking up at a luminous blue sky dome subtly filled with drifting soft blue light sparkles; wide reassuring composition, wonder on their faces; premium polished 3D clay-like animated-film children's picture-book illustration, square 1:1 composition; no text in image.",
  },
  {
    zh: "“那傍晚为什么会变成橙红色？”“阳光斜着穿过更多空气，蓝光大多散到四周，橙红光更容易来到眼睛。”",
    en: "\"Then why does sunset turn orange?\" \"At dusk sunlight crosses more air. Most blue light scatters aside, while orange-red light reaches our eyes more easily.\"",
    prompt:
      "Split-free sunset scene: the same park glowing in orange and pink as the sun sits low; a long gentle sunbeam crosses a deeper layer of clear atmosphere toward mother and daughter; short blue waves scatter softly to the sides while warm orange-red light reaches them; premium polished 3D clay-like animated-film children's picture-book illustration, square 1:1 composition; no text in image.",
  },
  {
    zh: "朵朵眨眨眼睛：“原来天空的颜色，是阳光和空气一起变的魔术！”",
    en: "Duoduo's eyes sparkled. \"So the sky's color is a magic trick by sunlight and air together!\"",
    prompt:
      "Back at the park bench, Duoduo spreads her arms happily as if hugging the sky, her mother laughing beside her; sky transitions beautifully from deep blue overhead to warm orange at the horizon; premium polished 3D clay-like animated-film children's picture-book illustration, square 1:1 composition; no text in image.",
  },
  {
    zh: "回家路上，朵朵又想到了新问题：“那……彩虹又是怎么来的呢？”",
    en: "On the way home, a new question bloomed: \"Then... where do rainbows come from?\"",
    prompt:
      "Evening walk home under first stars: Duoduo looks back over her shoulder with a bright curious smile as a faint dreamy rainbow arcs in her imagination above the path; mother holds her hand; cozy ending inviting the next book; premium polished 3D clay-like animated-film children's picture-book illustration, square 1:1 composition; no text in image.",
  },
];

const YUE_LIANG_GEN_ZHE_ZOU_PAGES: Array<{ zh: string; en: string; prompt: string }> = [
  {
    zh: "坐车回家的路上，小树发现：“月亮一直跟着我们走！”",
    en: "Riding home at night, Xiaoshu noticed, \"The moon keeps following us!\"",
    prompt:
      "A 5-year-old Chinese boy with short neat hair in a mint-green jacket looks out a car window at a big friendly full moon over rooftops; his father drives; cozy night city lights streak past; premium polished 3D clay-like animated-film children's picture-book illustration, square 1:1 composition; no text in image.",
  },
  {
    zh: "车开得快，月亮不落后；车拐了弯，月亮还在那儿。真奇怪！",
    en: "The car sped up — the moon kept pace. The car turned — the moon was still there. How strange!",
    prompt:
      "The car turns a corner on a tree-lined road while the same big moon stays calmly in the same part of the sky; Xiaoshu presses his nose to the window, puzzled and delighted; premium polished 3D clay-like animated-film children's picture-book illustration, square 1:1 composition; no text in image.",
  },
  {
    zh: "爸爸笑着说：“因为月亮离我们特别特别远，有三十多万公里呢。”",
    en: "Papa smiled. \"That's because the moon is very, very far away — over three hundred thousand kilometers!\"",
    prompt:
      "Imaginative scale scene: a tiny toy-like car on a ribbon of road far below, and the serene glowing moon impossibly high and distant in a deep star-dotted sky, connected by a long dotted arc suggesting vast distance; premium polished 3D clay-like animated-film children's picture-book illustration, square 1:1 composition; no text in image.",
  },
  {
    zh: "“近处的树和房子看起来嗖嗖往后跑，因为它们离我们近。”",
    en: "\"Nearby trees and houses seem to whoosh backwards because they are close to us.\"",
    prompt:
      "View from the car window: nearby trees, lampposts and houses appear to blur backwards with gentle motion lines, while the distant moon and mountains seem nearly still and clear; Xiaoshu watches, beginning to understand; premium polished 3D clay-like animated-film children's picture-book illustration, square 1:1 composition; no text in image.",
  },
  {
    zh: "“月亮太远啦。和它离我们的距离相比，短短的车程只像一小步。”",
    en: "\"The moon is very far away. Compared with that huge distance, our short drive is only a tiny step.\"",
    prompt:
      "Warm diagram-like scene: two nearby positions of the little car along a short stretch of road, while sight-lines from both cars point toward the extremely distant moon at nearly the same angle; friendly and clear, keeping a dreamy storybook feel; premium polished 3D clay-like animated-film children's picture-book illustration, square 1:1 composition; no text in image.",
  },
  {
    zh: "“所以在这段车程里，月亮的位置看起来几乎没变，像一直在等我们。”",
    en: "\"So during this short drive, the moon hardly seems to move in the sky, as if it is waiting for us.\"",
    prompt:
      "After the short drive, the car arrives home in a quiet neighborhood; the moon appears in nearly the same part of the sky above the rooftops as Xiaoshu steps out looking up happily, arms open toward it; sense of a patient faraway friend; premium polished 3D clay-like animated-film children's picture-book illustration, square 1:1 composition; no text in image.",
  },
  {
    zh: "小树挥挥手：“月亮不是跟着我。它离得太远，所以走这一小段路时，看起来几乎没动！”",
    en: "Xiaoshu waved. \"The moon isn't following me. It is so far away that during this short trip, it hardly seems to move!\"",
    prompt:
      "Xiaoshu stands in his small front yard waving up at the moon, father beside him carrying his backpack; fireflies drift; the moon seems to smile gently without a literal face; premium polished 3D clay-like animated-film children's picture-book illustration, square 1:1 composition; no text in image.",
  },
  {
    zh: "睡觉前，小树又冒出一个新问题：“那星星为什么会眨眼睛呢？”",
    en: "At bedtime, a new question twinkled: \"Then why do stars blink?\"",
    prompt:
      "Cozy bedroom ending: Xiaoshu tucked in bed by the window, moonlight on his blanket, gazing at twinkling stars through the glass with bright curiosity; a plush rabbit beside him; inviting the next book; premium polished 3D clay-like animated-film children's picture-book illustration, square 1:1 composition; no text in image.",
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
    imageUrl: `/library/haoqi/${bookId}/${index + 1}.webp`,
    imageStatus,
  }));
}

export const HAOQI_BOOKS: LibraryBook[] = [
  {
    id: "tian-kong-wei-shen-me-shi-lan-se",
    seriesId: "haoqi",
    title: "天空为什么是蓝色的",
    subtitle: "阳光和空气的魔术",
    question: "天空为什么是蓝色的？",
    moral: {
      zh: "太阳光里藏着彩虹般的各种颜色，蓝光的波纹较短，更容易被气体分子散向整个天空。",
      en: "Sunlight holds all the colors of the rainbow; blue light has shorter waves, so gas molecules scatter it across the sky more easily.",
    },
    pages: toStoryPages(
      "tian-kong-wei-shen-me-shi-lan-se",
      TIAN_KONG_LAN_PAGES,
      "complete",
    ),
    ageLabel: "4-8 岁",
    publishedAt: "2026-07-22",
    order: 1,
  },
  {
    id: "yue-liang-wei-shen-me-gen-zhe-wo-zou",
    seriesId: "haoqi",
    title: "月亮为什么跟着我走",
    subtitle: "一位很远很远的朋友",
    question: "月亮为什么跟着我走？",
    moral: {
      zh: "月亮离我们非常远，短短一段路里，我们看它的方向几乎不变，所以它像一直陪着我们。",
      en: "The moon is very far away, so during a short trip it stays in almost the same direction and seems to travel with us.",
    },
    pages: toStoryPages(
      "yue-liang-wei-shen-me-gen-zhe-wo-zou",
      YUE_LIANG_GEN_ZHE_ZOU_PAGES,
      "complete",
    ),
    ageLabel: "4-8 岁",
    publishedAt: "2026-07-22",
    order: 2,
  },
];

export const HAOQI_SERIES: LibrarySeries = {
  id: "haoqi",
  title: "好奇为什么",
  subtitle: "孩子的每一个为什么",
  description:
    "把孩子最爱问的问题讲成温柔的科学小故事：每本回答一个「为什么」，8 页中英双语，简化但不错误，读完还会带出下一个好奇。",
  accent: "#b98346",
  ageRange: "4-8 岁",
  bookCount: HAOQI_BOOKS.length,
};
