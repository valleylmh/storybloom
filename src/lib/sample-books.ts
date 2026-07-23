import type {
  GenerateResponse,
  SampleImageAssets,
  SampleImageModel,
  StoryInput,
  StoryPage,
} from "@/types";

type SampleBookMeta = {
  id: string;
  title: string;
  subtitle: string;
  themeLabel: string;
  ageLabel: string;
  accent: string;
};

const SAMPLE_BOOKS_META: SampleBookMeta[] = [
  {
    id: "brave-cloud",
    title: "小云朵勇敢飞",
    subtitle: "给第一次尝试新事物的孩子",
    themeLabel: "勇气冒险",
    ageLabel: "4-5 岁",
    accent: "#df6d47",
  },
  {
    id: "moon-lamp",
    title: "月亮灯晚安",
    subtitle: "一场温柔的睡前旅程",
    themeLabel: "家庭温暖",
    ageLabel: "2-3 岁",
    accent: "#5c7560",
  },
  {
    id: "garden-mail",
    title: "花园里的小邮差",
    subtitle: "关于分享、朋友和春天",
    themeLabel: "自然探索",
    ageLabel: "6-8 岁",
    accent: "#b98346",
  },
];

const SAMPLE_INPUT: StoryInput = {
  childName: "小满",
  ageGroup: "4-5",
  theme: "courage",
  style: "fairytale",
  language: "zh-en",
};

const BOOK_TEXT: Record<string, Array<{ zh: string; en: string }>> = {
  "brave-cloud": [
    { zh: "小满在窗边看见一朵小云，它轻轻敲了敲玻璃。", en: "Momo saw a little cloud tapping softly on the window." },
    { zh: "小云说：“山那边有一座彩虹桥，可我不敢飞过去。”", en: "The cloud said, “There is a rainbow bridge beyond the hill, but I am afraid to fly.”" },
    { zh: "小满把红围巾系在小云身上，像给它一个暖暖的拥抱。", en: "Momo tied a red scarf around the cloud, like a warm hug." },
    { zh: "他们先飞过屋顶，再飞过会唱歌的风铃树。", en: "They floated over rooftops and singing wind-chime trees." },
    { zh: "一阵大风吹来，小云缩成小小一团。", en: "A strong wind came, and the little cloud curled up small." },
    { zh: "小满说：“害怕的时候，我们可以慢慢飞。”", en: "Momo said, “When we feel scared, we can fly slowly.”" },
    { zh: "小云一点点展开，终于看见彩虹桥在阳光里发亮。", en: "The cloud opened bit by bit and saw the rainbow bridge shining." },
    { zh: "晚上，小云把一颗彩虹星送到小满枕边。", en: "That night, the cloud placed a rainbow star beside Momo’s pillow." },
  ],
  "moon-lamp": [
    { zh: "睡觉前，安安发现床头的小灯变成了一弯月亮。", en: "Before bedtime, Anan’s lamp turned into a little moon." },
    { zh: "月亮灯说：“今晚我带你去找最安静的梦。”", en: "The moon lamp said, “Tonight I will help you find the quietest dream.”" },
    { zh: "他们走过软软的毯子山，脚步像棉花一样轻。", en: "They crossed blanket hills with steps as soft as cotton." },
    { zh: "玩具熊守在路边，把星星饼干分给每一个朋友。", en: "A teddy bear shared star cookies with every friend." },
    { zh: "安安听见窗外有一点风声，心里有点紧。", en: "Anan heard the wind outside and felt a little worried." },
    { zh: "月亮灯把光放低，房间变成温暖的小船。", en: "The moon lamp dimmed its glow, and the room became a warm little boat." },
    { zh: "妈妈轻轻说：“我在这里，梦也在这里。”", en: "Mom whispered, “I am here, and your dream is here too.”" },
    { zh: "安安抱着小船一样的被子，慢慢驶进甜甜的梦。", en: "Anan hugged the boat-like blanket and sailed into a sweet dream." },
  ],
  "garden-mail": [
    { zh: "春天到了，豆豆收到一只瓢虫送来的绿色信封。", en: "Spring arrived, and Dodo received a green envelope from a ladybug." },
    { zh: "信上写着：“请把一粒微笑种子送给花园里的朋友。”", en: "The letter said, “Please deliver a smile seed to a garden friend.”" },
    { zh: "豆豆把种子放进小包，沿着叶子小路出发。", en: "Dodo put the seed in a little bag and followed the leafy path." },
    { zh: "蜗牛先生走得很慢，豆豆就陪它一起慢慢看花。", en: "Mr. Snail moved slowly, so Dodo looked at flowers slowly with him." },
    { zh: "小鸟找不到自己的歌，急得羽毛都翘起来了。", en: "A bird could not find its song, and its feathers puffed up with worry." },
    { zh: "豆豆把微笑种子放在鸟巢边，轻轻哼了一句。", en: "Dodo placed the smile seed near the nest and hummed softly." },
    { zh: "种子开出一朵会回信的花，花心里装满了歌声。", en: "The seed became a flower that could write back, full of songs." },
    { zh: "傍晚，花园里的每个朋友都收到了一封亮亮的信。", en: "By evening, every garden friend received a glowing letter." },
  ],
};

const SAMPLE_IMAGE_MODELS: SampleImageModel[] = ["gpt-image-2", "nano-banana"];
const SAMPLE_NARRATION_AUDIO = {
  model: "cosyvoice-v3-flash",
  voice: "longmiao_v3",
  format: "mp3",
} as const;

function createSampleImageAssets(
  bookId: string,
  pageNumber: number,
): SampleImageAssets {
  const placeholder = `/sample-books/${bookId}-${pageNumber}.svg`;

  return {
    placeholder,
    variants: Object.fromEntries(
      SAMPLE_IMAGE_MODELS.map((model) => [
        model,
        `/sample-books/${model}/${bookId}/${pageNumber}.webp`,
      ]),
    ) as Record<SampleImageModel, string>,
  };
}

function createSamplePages(bookId: string): StoryPage[] {
  return BOOK_TEXT[bookId].map((item, index) => {
    const pageNumber = index + 1;
    const sampleImage = createSampleImageAssets(bookId, pageNumber);

    return {
      page: pageNumber,
      zhText: item.zh,
      enText: item.en,
      illustrationPrompt: `Static sample illustration for ${bookId}, page ${pageNumber}.`,
      imageUrl: sampleImage.variants["gpt-image-2"],
      imageStatus: "complete",
      imageProvider: "pollinations",
      imageCompletedAt: "2026-05-08T00:00:00.000Z",
      sampleImage,
    };
  });
}

export const SAMPLE_BOOKS: Array<GenerateResponse & { sampleMeta: SampleBookMeta }> =
  SAMPLE_BOOKS_META.map((meta) => ({
    storyId: `sample-${meta.id}`,
    input: {
      ...SAMPLE_INPUT,
      theme:
        meta.id === "moon-lamp"
          ? "family"
          : meta.id === "garden-mail"
            ? "nature"
            : "courage",
      ageGroup:
        meta.id === "moon-lamp"
          ? "2-3"
          : meta.id === "garden-mail"
            ? "6-8"
            : "4-5",
    },
    coverTitle: meta.title,
    pages: createSamplePages(meta.id),
    totalPages: 8,
    generationMode: "demo",
    freeChanceLabel: "精选绘本",
    imagesPending: false,
    narrationAudio: {
      url: `/sample-books/audio/${meta.id}/zh.mp3`,
      ...SAMPLE_NARRATION_AUDIO,
    },
    sampleMeta: meta,
  }));
