import type { StoryPage } from "@/types";
import type { LibraryBook, LibrarySeries } from "@/types/library";
import duiNiuTanQinDraft from "../../../content-drafts/chengyu/dui-niu-tan-qin/draft.json";
import jingDiZhiWaDraft from "../../../content-drafts/chengyu/jing-di-zhi-wa/draft.json";
import keZhouQiuJianDraft from "../../../content-drafts/chengyu/ke-zhou-qiu-jian/draft.json";
import wangYangBuLaoDraft from "../../../content-drafts/chengyu/wang-yang-bu-lao/draft.json";
import yanErDaoLingDraft from "../../../content-drafts/chengyu/yan-er-dao-ling/draft.json";
import yuGongYiShanDraft from "../../../content-drafts/chengyu/yu-gong-yi-shan/draft.json";

// A3 首批 10 本均已完成文字、插图验收并正式发布。

const SHOU_ZHU_DAI_TU_PAGES: Array<{ zh: string; en: string; prompt: string }> = [
  {
    zh: "从前，宋国有个年轻农夫。每天太阳刚升起，他就下田干活。",
    en: "Long ago in the state of Song, a young farmer worked his field from sunrise.",
    prompt:
      "Ancient Song countryside at sunrise; the young farmer in a rust-red cross-collar tunic and dark teal sash hoes tidy green crop rows; full-body wide establishing scene; old stump visible at the field edge; warm premium 3D clay storybook style; no text in image.",
  },
  {
    zh: "田边有个老树桩。农夫累了，就坐在旁边喝口水。",
    en: "An old stump stood by the field. Whenever he grew tired, he rested beside it with a drink of water.",
    prompt:
      "The same farmer rests beside the weathered stump at midday and drinks water from a clay bowl; hoe laid nearby; thriving field and distant thatched farmhouse; relaxed full-scene composition; no rabbit; no text in image.",
  },
  {
    zh: "一天，一只野兔匆匆跑来，咚地撞上树桩，晕了过去。",
    en: "One day, a wild rabbit rushed past and bumped into the stump. It tumbled down, dazed.",
    prompt:
      "A small gray-brown wild rabbit dashes across the field and gently bumps the stump, startled and dazed but clearly safe; a soft dust puff; the same farmer turns in surprise several steps away; dynamic child-safe story scene; no text in image.",
  },
  {
    zh: "农夫抱起兔子，惊喜地想：“不耕田，也能有收获呀！”",
    en: "The farmer gently picked up the rabbit and thought, \"A harvest without work!\"",
    prompt:
      "The same farmer kneels beside the stump and gently holds the now-alert, unharmed rabbit; delighted and surprised expression; field and hoe visible in warm late-afternoon light; no thought bubble; no text in image.",
  },
  {
    zh: "第二天，他放下锄头，坐在树桩旁，盼着兔子再来。",
    en: "The next morning, he set down his hoe and waited by the stump for another rabbit.",
    prompt:
      "The same farmer sits idly beside the stump the next morning with an expectant face; unused hoe on the ground; crops beginning to need care; no rabbit anywhere; wide environmental storytelling; no text in image.",
  },
  {
    zh: "一天又一天，兔子没有出现，田里的禾苗却被杂草围住了。",
    en: "Day after day, no rabbit came. Meanwhile, weeds crowded around the neglected crops.",
    prompt:
      "Several days later, the same farmer still waits beside the stump, tired and disappointed; field visibly overgrown by weeds; long shadows show time passing; no rabbit; one continuous wide scene, not a montage; no text in image.",
  },
  {
    zh: "望着荒下来的田，他终于明白：守株待兔，等不来真正的收获。",
    en: "Looking at his untended field, he finally understood: waiting by a stump could never bring a true harvest.",
    prompt:
      "Turning point: the same farmer looks across the weedy field with a gentle realization and reaches down to pick up his hoe; stump behind him; thoughtful expression becoming determined; first warm ray through clouds; no text in image.",
  },
  {
    zh: "他重新拿起锄头，认真耕种。秋天，田野铺满了金黄。",
    en: "He picked up his hoe and worked with care again. By autumn, the field glowed gold.",
    prompt:
      "Hopeful autumn ending in the same field; the same farmer stands beside baskets of grain and vegetables with one hand on his hoe, smiling with calm earned pride; old stump and a safe distant rabbit remain secondary; golden sunset; no text in image.",
  },
];

const HU_JIA_HU_WEI_PAGES: Array<{ zh: string; en: string; prompt: string }> = [
  {
    zh: "从前，山林里住着一只威风的大老虎，小动物见了它都躲得远远的。",
    en: "Long ago, a mighty tiger lived in the forest. Every animal kept far out of his way.",
    prompt:
      "Ancient Chinese broadleaf and bamboo forest in warm cinematic morning light; a friendly but imposing adult tiger with orange fur, bold dark stripes, white muzzle and chest, rounded animated-film proportions, and golden-brown eyes walks along a forest path; a smaller red fox with a cream chest and tail tip and amber eyes watches nearby while distant deer, rabbits, and monkeys hide safely among the trees; establish both main characters clearly; premium polished 3D clay-like animated-film children's illustration; square composition; no text, logos, watermark, modern objects, split panels, exposed fangs, or scary aggression.",
  },
  {
    zh: "一天，老虎在小路上拦住一只狐狸。狐狸吓了一跳，很快又镇定下来。",
    en: "One day, the tiger stopped a fox on the path. The fox jumped, then quickly steadied himself.",
    prompt:
      "The same friendly orange tiger gently blocks the same smaller red fox on a winding ancient Chinese forest path; the fox has just jumped in surprise but is already steadying himself with a clever, alert expression; both characters remain child-friendly and safely separated, with no attack; warm cinematic light, broadleaf trees and bamboo; premium polished 3D clay-like animated-film children's illustration; square composition; no text, logos, watermark, modern objects, split panels, exposed fangs, or scary imagery.",
  },
  {
    zh: "狐狸昂起头说：“我是百兽之王，你可不能欺负我！”",
    en: "Lifting his chin, the fox said, “I am the king of all animals. You must not bully me!”",
    prompt:
      "The same red fox lifts his chin and speaks with theatrical confidence, cream chest visible and amber eyes bright; the same orange tiger leans back slightly with a puzzled, doubtful expression, golden-brown eyes focused on the fox; ancient Chinese forest path with bamboo and warm dappled light; expressive child-friendly storytelling, premium polished 3D clay-like animated-film illustration; square composition; no speech bubbles, text, logos, watermark, modern objects, split panels, exposed fangs, or scary aggression.",
  },
  {
    zh: "“不信？我走在前面，你跟在后面，看看大家怕不怕我。”",
    en: "“Don’t believe me? Walk behind me and see how everyone runs!”",
    prompt:
      "The same clever red fox gestures down the forest path, proposing that he walk in front; the same friendly orange tiger stands behind him looking uncertain and curious, considering the idea; clear front-and-behind staging in an ancient Chinese broadleaf and bamboo forest, warm cinematic light; premium polished 3D clay-like animated-film children's illustration; square composition; no speech bubbles, text, logos, watermark, modern objects, split panels, exposed fangs, or scary imagery.",
  },
  {
    zh: "狐狸大摇大摆地往前走，老虎半信半疑地跟在后面。",
    en: "The fox strutted ahead while the doubtful tiger followed close behind.",
    prompt:
      "The same red fox struts proudly at the front of a winding woodland path with tail held high; the same much larger orange tiger follows close behind with a doubtful, thoughtful expression; strong depth and movement through an ancient Chinese broadleaf and bamboo forest in warm cinematic light; premium polished 3D clay-like animated-film children's illustration; square composition; no text, logos, watermark, modern objects, split panels, exposed fangs, or scary aggression.",
  },
  {
    zh: "小鹿、兔子和猴子一看见老虎，全都飞快地躲进树林。",
    en: "Deer, rabbits, and monkeys saw the tiger and hurried into the trees.",
    prompt:
      "The same red fox struts in the foreground while the same orange tiger follows visibly behind; a young deer, two rabbits, and playful monkeys notice the tiger and hurry safely into the surrounding trees and bamboo, their attention clearly directed past the fox toward the tiger; lively but gentle action, warm cinematic forest light; premium polished 3D clay-like animated-film children's illustration; square composition; no text, logos, watermark, modern objects, split panels, exposed fangs, or scary imagery.",
  },
  {
    zh: "狐狸得意地说：“看，它们都怕我！”这就是狐假虎威。",
    en: "“See? They are all afraid of me!” boasted the fox. He was borrowing the tiger’s might.",
    prompt:
      "The same red fox turns back with a smug, triumphant smile and proudly gestures toward the now-empty forest path; the same orange tiger looks impressed and temporarily convinced, while small animals peek cautiously from distant foliage at the tiger; ancient Chinese broadleaf and bamboo forest, warm cinematic light; premium polished 3D clay-like animated-film children's illustration; square composition; no speech bubbles, text, logos, watermark, modern objects, split panels, exposed fangs, or scary aggression.",
  },
  {
    zh: "后来，老虎看清了真相：借来的威风不是真本领，凡事要自己判断。",
    en: "Later, the tiger understood: borrowed power is not true ability. We must observe and judge for ourselves.",
    prompt:
      "A gentle realization scene in the same ancient Chinese forest: the red fox has safely slipped away along a distant side path, while the orange tiger calmly observes deer, rabbits, and monkeys reacting to him rather than to the fox; the tiger's golden-brown eyes show thoughtful understanding, not anger; warm rays through broadleaf trees and bamboo suggest wisdom; premium polished 3D clay-like animated-film children's illustration; square composition; no text, logos, watermark, modern objects, split panels, exposed fangs, chase, or scary imagery.",
  },
];

const HUA_SHE_TIAN_ZU_PAGES: Array<{
  zh: string;
  en: string;
  prompt: string;
}> = [
  {
    zh: "楚国一次祭祀结束后，三位门客得到一壶节庆米酒。",
    en: "After a ceremony in the state of Chu, three helpers received a small jug of festive rice wine.",
    prompt:
      "Ancient Chu packed-earth courtyard just after a ceremony, with warm late-afternoon light and understated wooden architecture; establish three adult helpers together around one fixed cream-white round ceramic wine jug tied with a dark-red cord: the core painter in red is 28, slender, warm-brown skin, oval face, thick eyebrows, clean-shaven, high round topknot with a dark-teal hair ribbon, rust-red cross-collar short robe, dark-teal sash, charcoal trousers, and cloth shoes; the eventual winner in blue is 35, slightly stocky, round-faced, deep-brown eyes, neat short moustache, low bun, indigo cross-collar robe, warm-ochre sash, and dark cloth shoes; the witness in green is 45, lean, slightly gray temples, short beard, moss-green robe, and beige sash; celebratory but calm and fully sober mood; no snake is present yet; premium polished warm 3D clay-like animated-film children's storybook illustration, square 1:1 composition; no text, logos, watermark, modern objects, drunkenness, fighting, split panels, or scary imagery.",
  },
  {
    zh: "酒只有一小壶，不够三个人分。他们约定：谁先画完蛇，谁得酒。",
    en: "There was too little to share, so they agreed: whoever finished drawing a snake first would win the jug.",
    prompt:
      "In the same ancient Chu packed-earth courtyard, the same three helpers crouch several steps apart and use simple drawing sticks to begin three separate snake-shaped line drawings directly on the ground; the fixed cream-white round ceramic jug with its dark-red cord sits clearly in the center as the prize; keep the slender red-robed 28-year-old with high topknot and dark-teal sash, the slightly stocky blue-robed 35-year-old with short moustache and warm-ochre sash, and the lean moss-green-robed 45-year-old witness with graying temples and beige sash exactly consistent; every snake must be only a simple ground line drawing, never a real animal; focused, friendly competition without conflict; premium polished warm 3D clay-like animated-film children's storybook illustration, square 1:1 composition; no written characters, text, logos, watermark, modern objects, drunkenness, fighting, split panels, or real snakes.",
  },
  {
    zh: "红衣门客画得飞快，第一个画完，伸手拿起了酒壶。",
    en: "The man in red drew quickly. He finished first and picked up the jug.",
    prompt:
      "The same slender 28-year-old core painter in a rust-red cross-collar short robe, dark-teal sash, charcoal trousers, cloth shoes, and high round topknot with dark-teal ribbon has just completed a clear legless snake line drawing on the packed earth and reaches proudly for the fixed cream-white round ceramic jug with dark-red cord; behind him, the same slightly stocky blue-robed man with neat short moustache and the same lean green-robed older witness are still calmly finishing their own ground drawings; warm ancient Chu courtyard light, readable full-scene storytelling; all snakes exist only as lines scratched on the ground, with no real snake; premium polished warm 3D clay-like animated-film children's storybook illustration, square 1:1 composition; no text, logos, watermark, modern objects, drunkenness, fighting, split panels, or scary imagery.",
  },
  {
    zh: "他左手拿着酒壶，右手继续画：“我还能给蛇添上脚！”",
    en: "Holding the jug in his left hand, he kept drawing with his right. ‘I can even add legs to my snake!’",
    prompt:
      "The same slender red-robed core painter holds the fixed cream-white round ceramic jug by its dark-red cord in his left hand while using a drawing stick in his right hand to add several unnecessary legs to his completed snake-shaped line drawing on the packed-earth courtyard; show his warm-brown oval clean-shaven face, thick brows, high round topknot with dark-teal ribbon, rust-red cross-collar short robe, dark-teal sash, charcoal trousers, and cloth shoes consistently; the same blue-robed moustached man continues concentrating on his own correct legless ground drawing, while the same green-robed older witness watches; the snake is strictly a flat line drawing on the ground, never alive; premium polished warm 3D clay-like animated-film children's storybook illustration, square 1:1 composition; no speech bubbles, text, logos, watermark, modern objects, drunkenness, fighting, split panels, or real snakes.",
  },
  {
    zh: "蓝衣门客专心画完自己的蛇，平静地走到他身边。",
    en: "The man in blue calmly finished his own snake and walked over.",
    prompt:
      "The same 35-year-old slightly stocky winner in an indigo cross-collar robe, warm-ochre sash, dark cloth shoes, low bun, deep-brown eyes, round face, and neat short moustache calmly rises beside his newly finished, correct legless snake line drawing and walks toward the red-robed painter; the same red-robed painter still holds the fixed cream-white round ceramic jug with dark-red cord beside his altered snake drawing with added legs; the same lean 45-year-old in a moss-green robe and beige sash observes quietly; ancient Chu packed-earth courtyard in warm light; both snakes remain simple ground line drawings only, no real animal; premium polished warm 3D clay-like animated-film children's storybook illustration, square 1:1 composition; no text, logos, watermark, modern objects, drunkenness, argument, fighting, split panels, or real snakes.",
  },
  {
    zh: "他指着地上的画说：“蛇本来没有脚，添了脚就不是蛇了！”",
    en: "‘A snake has no legs,’ he said, pointing at the drawing. ‘Add legs, and it is no longer a snake!’",
    prompt:
      "The same blue-robed 35-year-old winner, calm and composed, points clearly toward the red painter's snake-shaped ground line drawing with unnecessary legs; the same slender red-robed painter looks down in surprised realization while still holding the fixed cream-white round ceramic jug with dark-red cord, and the same green-robed older witness stands nearby with a thoughtful expression; include the blue man's correct legless line drawing in the background for visual contrast; ancient Chu packed-earth courtyard, gentle teaching moment with respectful body language; snakes are only flat lines drawn on the earth, never real creatures; premium polished warm 3D clay-like animated-film children's storybook illustration, square 1:1 composition; no speech bubbles, text, logos, watermark, modern objects, drunkenness, pointing in anger, fighting, split panels, or real snakes.",
  },
  {
    zh: "蓝衣门客赢得了酒壶。红衣门客因画蛇添足，失去了机会。",
    en: "The man in blue won the jug. By drawing legs on a snake, the first finisher lost his chance.",
    prompt:
      "In the same warm ancient Chu courtyard, the slightly stocky blue-robed man with low bun, neat short moustache, warm-ochre sash, and dark cloth shoes now holds the fixed cream-white round ceramic jug with its dark-red cord, accepting the fair result with a calm modest smile; the slender red-robed painter stands beside his spoiled snake line drawing with added legs, disappointed but peaceful and reflective rather than angry; the lean green-robed older witness gently confirms the outcome; also show the blue winner's correct legless ground drawing nearby; all snakes are simple drawings on packed earth, never real; premium polished warm 3D clay-like animated-film children's storybook illustration, square 1:1 composition; no text, logos, watermark, modern objects, drinking, drunkenness, taunting, fighting, split panels, or real snakes.",
  },
  {
    zh: "红衣门客明白了：多做不需要的事，反而会把好结果弄坏。",
    en: "The man in red understood: extra, unnecessary work can spoil something already done well.",
    prompt:
      "Quiet reflective ending in the same ancient Chu packed-earth courtyard at golden sunset: the same slender 28-year-old red-robed painter kneels and gently brushes away the four unnecessary legs from his snake-shaped ground drawing, leaving a correct simple legless snake; his oval warm-brown clean-shaven face, thick brows, high round topknot with dark-teal ribbon, rust-red cross-collar short robe, dark-teal sash, charcoal trousers, and cloth shoes remain consistent; the same blue-robed winner and green-robed witness watch with friendly encouraging expressions, while the fixed cream-white round ceramic jug with dark-red cord rests untouched on the distant low table; the snake is only a line drawing on the ground, never real; hopeful warm light suggests learning and knowing when to stop; premium polished warm 3D clay-like animated-film children's storybook illustration, square 1:1 composition; no text, logos, watermark, modern objects, drinking, drunkenness, shame, fighting, split panels, or real snakes.",
  },
];

const BA_MIAO_ZHU_ZHANG_PAGES: Array<{
  zh: string;
  en: string;
  prompt: string;
}> = [
  {
    zh: "从前，宋国乡下住着一位农夫。他常和儿子一起照看田里的嫩苗。",
    en: "Long ago in the countryside of Song, a farmer and his son often cared for the tender seedlings in their field.",
    prompt:
      "Ancient Song countryside dry field in warm morning light, with soft brown raised soil rows and slender tender green seedlings, clearly dry farmland and never a flooded rice paddy; establish both recurring characters together: a sturdy 38-year-old farmer with a broad gentle face, short moustache and small pointed chin beard, practical high topknot, ochre-yellow cross-collar short robe, dark-teal sash, charcoal rolled trousers, and straw sandals, beside his 9-year-old round-faced son with one small topknot, sage-green short robe, beige sash, brown trousers, and cloth shoes; father and son carefully tend the seedlings together with calm affectionate expressions; premium polished warm 3D clay-like animated-film children's storybook illustration, square 1:1 composition; no text, logos, watermark, modern objects, flooded paddy, broken roots, fully uprooted seedlings, frightening damage, or split panels.",
  },
  {
    zh: "农夫天天来看，总嫌禾苗长得太慢，心里越来越着急。",
    en: "The farmer checked them every day. They seemed much too slow to grow, and he grew more and more impatient.",
    prompt:
      "In the same ancient Song dry field with soft brown raised soil rows and slender tender green seedlings, the same sturdy 38-year-old farmer in an ochre-yellow cross-collar short robe, dark-teal sash, charcoal rolled trousers, straw sandals, short moustache and small pointed chin beard, and practical high topknot crouches to compare the healthy little plants, looking increasingly impatient but never angry; the same 9-year-old son in a sage-green short robe, beige sash, brown trousers, cloth shoes, and one small topknot watches thoughtfully nearby; clearly dry farmland, not a flooded rice paddy; premium polished warm 3D clay-like animated-film children's storybook illustration, square 1:1 composition; no text, logos, watermark, modern objects, broken roots, fully uprooted seedlings, frightening damage, or split panels.",
  },
  {
    zh: "一天，他想出个办法，把禾苗一棵棵轻轻往上拔了拔。",
    en: "One day, he had an idea. He gently tugged every seedling a little higher.",
    prompt:
      "In the same ancient Song dry field, the same sturdy 38-year-old farmer in his ochre-yellow short robe, dark-teal sash, charcoal rolled trousers, and straw sandals carefully pinches one slender green seedling and lifts it only a tiny amount; emphasize that the seedling's roots remain fully buried in the soft brown soil and the plant is not pulled out, with adjacent seedlings still standing in the raised dry-earth row; his broad gentle face looks pleased with his idea; premium polished warm 3D clay-like animated-film children's storybook illustration, square 1:1 composition; no child in this close storytelling moment, no text, logos, watermark, modern objects, flooded rice paddy, exposed or broken roots, fully uprooted plants, frightening damage, or split panels.",
  },
  {
    zh: "从早忙到晚，农夫擦着汗，满意地看着‘长高’的禾苗。",
    en: "He worked from morning till evening, then wiped his brow and admired the ‘taller’ seedlings.",
    prompt:
      "Warm evening in the same ancient Song dry field: the same sturdy 38-year-old farmer with short moustache, small pointed chin beard, and practical high topknot, wearing the fixed ochre-yellow cross-collar short robe, dark-teal sash, charcoal rolled trousers, and straw sandals, wipes his brow and proudly surveys rows of green seedlings after working all day; clearly show slightly loosened brown soil around the stems and only the leaf tips beginning to droop, while every root remains buried and no plant is fully pulled out; premium polished warm 3D clay-like animated-film children's storybook illustration, square 1:1 composition; no text, logos, watermark, modern objects, flooded rice paddy, exposed or broken roots, severe damage, horror, or split panels.",
  },
  {
    zh: "回家后，他笑着说：“今天真累，我帮禾苗长高啦！”",
    en: "Back home, he smiled. ‘What a tiring day! I helped the seedlings grow taller!’",
    prompt:
      "Inside a simple ancient Song farmhouse at dusk, the same sturdy 38-year-old farmer in his fixed ochre-yellow cross-collar short robe, dark-teal sash, charcoal rolled trousers, straw sandals, short moustache and small pointed chin beard, and practical high topknot sits tired but smiling and gestures proudly as he tells the news; the same 9-year-old round-faced son with one small topknot, sage-green short robe, beige sash, brown trousers, and cloth shoes listens with sudden concern and prepares to hurry outside; warm family-safe storytelling, premium polished warm 3D clay-like animated-film children's storybook illustration, square 1:1 composition; no speech bubbles, text, logos, watermark, modern objects, broken roots, fully uprooted seedlings, frightening imagery, or split panels.",
  },
  {
    zh: "儿子赶到田里一看：苗根全松了，禾苗都蔫蔫地垂下叶子。",
    en: "His son hurried to the field. The roots were loose, and every seedling had begun to droop.",
    prompt:
      "The same 9-year-old round-faced son with one small topknot, sage-green short robe, beige sash, brown trousers, and cloth shoes kneels with concern in the same ancient Song dry field at dusk; the slender seedlings remain green but are visibly drooping, their leaves hanging softly over loosened brown soil, while all roots stay covered and never appear exposed; the same farmer approaches in the background and begins to understand, with no panic; clearly dry raised soil rows, not a flooded rice paddy; premium polished warm 3D clay-like animated-film children's storybook illustration, square 1:1 composition; no text, logos, watermark, modern objects, exposed or broken roots, fully uprooted plants, dead brown crops, frightening destruction, or split panels.",
  },
  {
    zh: "“硬拔不能让苗长大，这就是拔苗助长呀！”儿子说。",
    en: "‘Pulling can’t make seedlings grow. This is what people mean by pulling seedlings to help them grow!’ said his son.",
    prompt:
      "Gentle teaching moment in the same ancient Song dry field: the same 9-year-old son in a sage-green short robe, beige sash, brown trousers, cloth shoes, and one small topknot calmly points to the loosened soil around a drooping but still green seedling; the same sturdy 38-year-old farmer in his ochre-yellow robe, dark-teal sash, charcoal rolled trousers, straw sandals, short moustache and small pointed chin beard, and high topknot kneels beside him with a thoughtful, remorseful expression; roots remain buried, with no plant removed; premium polished warm 3D clay-like animated-film children's storybook illustration, square 1:1 composition; no speech bubbles, text, logos, watermark, modern objects, flooded rice paddy, exposed or broken roots, fully uprooted seedlings, frightening damage, blame, or split panels.",
  },
  {
    zh: "父子赶紧把禾苗重新栽稳、浇好水，从此耐心等它们长大。",
    en: "Together, they tucked the seedlings firmly back into the soil and watered them. From then on, they waited patiently for them to grow.",
    prompt:
      "Hopeful early-morning ending in the same ancient Song dry field: the same sturdy 38-year-old farmer in the fixed ochre-yellow robe and the same 9-year-old son in the fixed sage-green robe work side by side, gently pressing loosened brown soil firmly around the seedlings and watering carefully with an ancient clay vessel; the roots are securely covered and the field remains dry raised farmland rather than a flooded paddy; emphasize that the seedlings are still somewhat drooped and have not instantly recovered, although they remain green and cared for; patient, tender expressions and warm light suggest gradual growth ahead; premium polished warm 3D clay-like animated-film children's storybook illustration, square 1:1 composition; no text, logos, watermark, modern objects, exposed or broken roots, fully uprooted plants, magical instant recovery, frightening damage, or split panels.",
  },
];

function toStoryPages(
  bookId: string,
  items: Array<{ zh: string; en: string; prompt: string }>,
  imageStatus: NonNullable<StoryPage["imageStatus"]> = "complete",
): StoryPage[] {
  return items.map((item, index) => ({
    page: index + 1,
    zhText: item.zh,
    enText: item.en,
    illustrationPrompt: item.prompt,
    imageUrl: `/library/chengyu/${bookId}/${index + 1}.webp`,
    imageStatus,
  }));
}

type ReviewedBookDraft = Omit<LibraryBook, "seriesId" | "pages"> & {
  pages: Array<{ zh: string; en: string; prompt: string }>;
};

function reviewedDraftToBook(draft: ReviewedBookDraft): LibraryBook {
  return {
    ...draft,
    seriesId: "chengyu",
    pages: toStoryPages(draft.id, draft.pages),
  };
}

export const CHENGYU_BOOKS: LibraryBook[] = [
  {
    id: "shou-zhu-dai-tu",
    seriesId: "chengyu",
    title: "守株待兔",
    subtitle: "等来等去的农夫",
    origin: "《韩非子·五蠹》",
    moral: {
      zh: "偶然的好运不能代替踏实的努力；真正的收获，要靠自己的双手。",
      en: "A lucky accident cannot replace steady effort; true rewards grow from the work we do.",
    },
    idiomMeaning: {
      zh: "比喻不主动努力，妄想靠运气坐享其成。",
      en: "To wait by a tree stump for rabbits — hoping to gain without effort, trusting luck instead of hard work.",
    },
    pages: toStoryPages("shou-zhu-dai-tu", SHOU_ZHU_DAI_TU_PAGES),
    ageLabel: "4-8 岁",
    publishedAt: "2026-07-20",
    order: 1,
  },
  {
    id: "hu-jia-hu-wei",
    seriesId: "chengyu",
    title: "狐假虎威",
    subtitle: "走在老虎前面的狐狸",
    origin: "《战国策·楚策一》",
    moral: {
      zh: "借来的威风不是真本领；遇事要自己观察、认真判断。",
      en: "Borrowed power is not real ability; observe carefully and judge for yourself.",
    },
    idiomMeaning: {
      zh: "比喻倚仗别人的权势来吓唬人。",
      en: "The fox borrows the tiger’s might—using someone else’s power to intimidate others.",
    },
    pages: toStoryPages("hu-jia-hu-wei", HU_JIA_HU_WEI_PAGES),
    ageLabel: "4-8 岁",
    publishedAt: "2026-07-20",
    order: 2,
  },
  {
    id: "hua-she-tian-zu",
    seriesId: "chengyu",
    title: "画蛇添足",
    subtitle: "给蛇画脚的人",
    origin: "《战国策·齐策二》",
    moral: {
      zh: "事情做好后要懂得适可而止；多余的添加，反而可能坏了原本的成果。",
      en: "Once something is done well, know when to stop. Unnecessary additions can spoil a good result.",
    },
    idiomMeaning: {
      zh: "比喻做了多余的事，不但没有帮助，反而把事情弄坏。",
      en: "To ‘draw legs on a snake’ means to spoil something by adding unnecessary extras.",
    },
    pages: toStoryPages("hua-she-tian-zu", HUA_SHE_TIAN_ZU_PAGES),
    ageLabel: "4-8 岁",
    publishedAt: "2026-07-20",
    order: 3,
  },
  {
    id: "ba-miao-zhu-zhang",
    seriesId: "chengyu",
    title: "拔苗助长",
    subtitle: "不能催着长大的禾苗",
    origin: "《孟子·公孙丑上》",
    moral: {
      zh: "成长需要时间和耐心。尊重规律、用对方法，才能真正帮上忙。",
      en: "Growth takes time and patience. Real help means caring in the right way and respecting nature’s pace.",
    },
    idiomMeaning: {
      zh: "比喻违反事物发展的规律，急于求成，反而把事情弄坏。也作‘揠苗助长’。",
      en: "Literally ‘pulling seedlings to help them grow’; it describes forcing progress against its natural course and making things worse.",
    },
    pages: toStoryPages(
      "ba-miao-zhu-zhang",
      BA_MIAO_ZHU_ZHANG_PAGES,
      "complete",
    ),
    ageLabel: "4-8 岁",
    publishedAt: "2026-07-20",
    order: 4,
  },
  ...[
    wangYangBuLaoDraft,
    jingDiZhiWaDraft,
    yuGongYiShanDraft,
    keZhouQiuJianDraft,
    yanErDaoLingDraft,
    duiNiuTanQinDraft,
  ].map(reviewedDraftToBook),
];

export const CHENGYU_SERIES: LibrarySeries = {
  id: "chengyu",
  title: "成语故事",
  subtitle: "经典成语，讲给孩子听",
  description:
    "把经典成语变成 8 页中英双语绘本：温和的改编、贴近孩子的语言，每本讲清一个成语的来历和道理。",
  accent: "#b04a2f",
  ageRange: "4-8 岁",
  bookCount: CHENGYU_BOOKS.length,
};
