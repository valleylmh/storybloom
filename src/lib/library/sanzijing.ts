import type { StoryPage } from "@/types";
import type { LibraryBook, LibrarySeries } from "@/types/library";

type PageDraft = { zh: string; en: string; scene: string };

const SHARED_STYLE =
  "Premium children's picture-book illustration, warm contemporary Chinese watercolor and gouache with subtle traditional paper texture, gentle rounded shapes, expressive but natural faces, soft daylight, square 1:1 composition";

function makePages(
  bookId: string,
  characterLock: string,
  drafts: PageDraft[],
): StoryPage[] {
  return drafts.map((draft, index) => ({
    page: index + 1,
    zhText: draft.zh,
    enText: draft.en,
    illustrationPrompt: `${SHARED_STYLE}; ${characterLock}; ${draft.scene}; keep every named character's face, hairstyle, outfit colors, age, and proportions consistent across the whole book; no text, letters, calligraphy, logos, watermark, split panels, shame, threatening gestures, or scary imagery.`,
    imageUrl: `/library/sanzijing/${bookId}/${index + 1}.webp`,
    imageStatus: "complete",
  }));
}

const HABITS_ID = "xi-guan-hui-man-man-zhang-da";
const HABITS_PAGES = makePages(
  HABITS_ID,
  "Lele is a 5-year-old Chinese boy with a round face, short soft black hair, a mustard-yellow sweatshirt with a tiny leaf patch, teal trousers, and white sneakers; Mama has shoulder-length black hair, a cream cardigan, and a sage-green skirt",
  [
    {
      zh: "乐乐每天回家，都把鞋子、书包和外套留在不同的地方。",
      en: "Every day, Lele left his shoes, backpack, and jacket in different places.",
      scene: "welcoming apartment entryway after kindergarten, Lele rushing toward his toys while his shoes, blue backpack, and red jacket form a harmless messy trail, Mama watching calmly from the doorway, wide establishing view",
    },
    {
      zh: "第二天早上，他找不到绘画本，急得眼圈红红的。",
      en: "The next morning, he could not find his drawing book, and tears filled his eyes.",
      scene: "soft morning light in the same entryway, Lele kneeling beside his open backpack and looking worried, scattered belongings around him, Mama crouching nearby at eye level with an understanding expression, medium-wide view",
    },
    {
      zh: "妈妈没有说“你怎么总是这样”，而是问：“我们能帮东西找到家吗？”",
      en: "Mama did not say, ‘Why are you always like this?’ She asked, ‘Can we help each thing find its home?’",
      scene: "Mama and Lele sitting together on the entryway rug, Mama gently presenting an empty low hook, a shoe mat, and one small basket as possible homes, Lele listening with curiosity, intimate eye-level composition",
    },
    {
      zh: "他们只选了第一件小事：进门以后，把书包挂在叶子挂钩上。",
      en: "They chose just one small step: after coming in, hang the backpack on the leaf-shaped hook.",
      scene: "Lele stretching up and placing the same blue backpack on a low wooden leaf-shaped hook, Mama giving a quiet thumbs-up from nearby, tidy but lived-in home, full-body action view",
    },
    {
      zh: "《三字经》里说：\n“性相近，习相远。”\n每天重复的事，会慢慢变成习惯。",
      en: "The Three Character Classic says that repeated experiences shape our habits. What we practise each day slowly becomes easier.",
      scene: "poetic visual metaphor without written symbols: one small green path through a garden becoming clearer after Lele walks it several times, his blue backpack secure on his shoulders, gentle overhead three-quarter view",
    },
    {
      zh: "它还说：\n“苟不教，性乃迁。教之道，贵以专。”\n今天我们更愿意说：耐心示范，比责骂更有用。",
      en: "It also values steady teaching. Today we can say: patient guidance helps more than blame.",
      scene: "Mama slowly demonstrating the same one-step arrival routine beside Lele, pointing from the doorway to the low leaf hook with a warm open hand, Lele copying her, calm side view",
    },
    {
      zh: "第一天，乐乐记住了。第二天，他玩得太开心，又忘了。",
      en: "Lele remembered on the first day. On the second, he was so excited to play that he forgot.",
      scene: "Lele halfway toward his building blocks while still wearing the blue backpack, then pausing as he notices it, playful motion and a small moment of realization, Mama visible in the background but not correcting him",
    },
    {
      zh: "妈妈指指叶子挂钩。乐乐跑回来，自己把书包挂好。",
      en: "Mama pointed to the leaf hook. Lele ran back and hung up the backpack by himself.",
      scene: "Mama making one gentle pointing gesture toward the leaf hook while Lele turns back cheerfully and lifts the backpack into place, no scolding, warm late-afternoon light, medium-wide action view",
    },
    {
      zh: "过了几天，乐乐一进门就想起了书包的“家”。",
      en: "After a few days, Lele remembered the backpack’s home as soon as he came in.",
      scene: "Lele entering confidently and hanging the blue backpack on the leaf hook without prompting, shoes still naturally a little crooked, Mama carrying groceries behind him with a proud gentle smile, wide view",
    },
    {
      zh: "接着，他们才给鞋子和外套也安排了固定的位置。",
      en: "Only then did they choose steady places for shoes and the jacket too.",
      scene: "Lele placing white sneakers on the low mat and red jacket on the neighboring hook, three simple object homes clearly visible, Mama helping only by holding the door, orderly composition",
    },
    {
      zh: "早晨，绘画本就在书包里。乐乐有时间慢慢系好鞋带。",
      en: "In the morning, the drawing book was right inside the backpack. Lele had time to tie his shoes calmly.",
      scene: "peaceful morning entryway, drawing book peeking safely from the blue backpack, Lele seated tying white sneaker laces with relaxed focus, Mama ready by the door, golden light",
    },
    {
      zh: "习惯不是一句“要乖”变出来的。它是一次提醒、一次练习，再来一次。",
      en: "A habit does not appear because someone says, ‘Be good.’ It grows through a reminder, some practice, and one more try.",
      scene: "Lele and Mama leaving home hand in hand, neat backpack on his shoulders and the small leaf hook visible behind them, hopeful doorway framing, a tiny potted sprout echoing slow growth",
    },
  ],
);

const SUPPORT_ID = "pei-hai-zi-ba-lu-zou-chang";
const SUPPORT_PAGES = makePages(
  SUPPORT_ID,
  "Anan is a 6-year-old Chinese girl with straight black hair in two low pigtails, a coral hoodie, navy overalls, and red canvas shoes; Dad has short black hair, round glasses, a sky-blue shirt, and charcoal trousers",
  [
    {
      zh: "安安很想学会骑自行车，可车轮一晃，她就跳了下来。",
      en: "Anan wanted to ride a bicycle, but whenever it wobbled, she jumped off.",
      scene: "quiet neighborhood courtyard, Anan beside a small mint-green bicycle with training wheels removed, one foot on the ground and a frustrated face, Dad waiting several steps away, wide opening view",
    },
    {
      zh: "她试了三次，皱着眉说：“我根本学不会！”",
      en: "After three tries, she frowned. ‘I’ll never learn!’",
      scene: "Anan sitting on a low garden curb beside the mint bicycle, arms around her knees and brows furrowed, Dad sitting nearby at the same height without crowding her, medium view",
    },
    {
      zh: "爸爸没有催她继续。他递来水，陪她看看：最害怕的是哪一步？",
      en: "Dad did not push her to continue. He offered water and asked which step felt the hardest.",
      scene: "Dad handing Anan a small yellow water bottle while both look thoughtfully at the bicycle, Dad's open posture patient and calm, shaded tree light",
    },
    {
      zh: "安安说：“一出发，我就怕摔倒。”他们决定先不骑，只练双脚滑行。",
      en: "‘I’m scared of falling when I start,’ Anan said. They decided not to pedal yet—only to glide with both feet.",
      scene: "Anan seated on the bicycle and gently pushing along with both feet on a smooth chalk-free path, Dad walking beside but not holding her, focused full-body action",
    },
    {
      zh: "《三字经》讲过孟母为了孩子的成长，认真选择生活和学习的环境。",
      en: "The Three Character Classic tells how Mencius’s mother thoughtfully chose an environment where her child could grow and learn.",
      scene: "dreamlike story-within-a-story: Anan and Dad viewing a softly painted ancient mother and young child walking toward a peaceful school courtyard, respectful historical clothing, no written signs, bookish warm atmosphere",
    },
    {
      zh: "“昔孟母，择邻处。”\n重要的不是搬到最贵的地方，而是大人愿意一起找适合孩子成长的条件。",
      en: "‘Mencius’s mother chose their surroundings.’ What matters today is not an expensive place, but adults helping children find conditions where they can grow.",
      scene: "modern courtyard transformed into a supportive practice space with a clear flat path, a helmet, water bottle, and Dad marking a safe start using two small flowerpots, Anan helping arrange them",
    },
    {
      zh: "古书还写了“断机杼”的故事。那是古人的劝学方式，不是今天吓唬孩子的办法。",
      en: "The old book also tells of cutting woven cloth to teach persistence. It belongs to its time; today, children do not need threats to learn.",
      scene: "gentle symbolic view of an intact ancient loom safely displayed behind a museum-style rope while Anan and Dad observe from a respectful distance, Dad explaining with a calm open palm, no damage occurring",
    },
    {
      zh: "爸爸问：“要不要我扶住车座十秒？你说停，我们就停。”安安点点头。",
      en: "‘Shall I hold the seat for ten seconds?’ Dad asked. ‘Say stop, and we stop.’ Anan nodded.",
      scene: "Dad lightly holding the back of the mint bicycle seat while Anan checks her helmet and looks back to confirm, clear consent and teamwork, side view",
    },
    {
      zh: "这一次，她滑得远了一点。脚落地时，车没有倒。",
      en: "This time she glided a little farther. When her feet touched down, the bicycle stayed upright.",
      scene: "Anan gliding independently for a short distance, both feet about to touch the path, surprise turning into delight, Dad behind with hands visible and no longer touching, dynamic wide view",
    },
    {
      zh: "第二天，安安自己提出：“我想试试踩一下踏板。”",
      en: "The next day, Anan said, ‘I want to try one push on the pedal.’",
      scene: "fresh morning in the same courtyard, Anan confidently placing one red shoe on a pedal while Dad waits with the yellow water bottle, hopeful medium-wide composition",
    },
    {
      zh: "她没有一下子变成骑车高手，却学会了把难事分成小小的下一步。",
      en: "She did not become an expert at once. She learned to turn a hard task into one small next step.",
      scene: "Anan riding a short straight stretch between the two flowerpots, concentrating with a small proud smile, Dad applauding softly at the finish, clear sense of attainable progress",
    },
    {
      zh: "陪孩子把路走长，不是替她用力，也不是把她推向前，而是在需要时稳稳站在旁边。",
      en: "Helping a child go farther is not pushing or doing the work for her. It is standing steadily nearby when she needs support.",
      scene: "Anan and Dad walking home side by side while she rolls the mint bicycle herself, long warm evening path ahead, their relaxed shadows stretching together, closing wide view",
    },
  ],
);

const RESPECT_ID = "ai-jia-ren-ye-zun-zhong-zi-ji";
const RESPECT_PAGES = makePages(
  RESPECT_ID,
  "Xiaohe is a 5-year-old Chinese boy with a bowl-cut hairstyle, an olive-green T-shirt with a small sun patch, beige shorts, and orange socks; his 8-year-old sister Xiaoyu has a chin-length black bob, a lavender T-shirt, denim overalls, and yellow socks; Grandma has silver hair in a low bun and wears a rust-red knit vest over a cream blouse",
  [
    {
      zh: "奶奶感冒了，躺在沙发上休息。小禾听见她轻轻咳嗽。",
      en: "Grandma had a cold and was resting on the sofa. Xiaohe heard her cough softly.",
      scene: "cozy living room, Grandma resting under a light blanket on the sofa, Xiaohe pausing near his wooden train set with a concerned expression, sister Xiaoyu reading nearby, wide opening view",
    },
    {
      zh: "小禾想起奶奶平时照顾自己，便倒了一杯温水，请姐姐帮忙端过去。",
      en: "Xiaohe remembered how Grandma cared for him. He poured warm water and asked his sister to help carry it.",
      scene: "safe kitchen table, Xiaohe carefully pouring water from a small child-safe pitcher while Xiaoyu steadies a tray, visible teamwork and concentration, Grandma distant in background",
    },
    {
      zh: "奶奶笑着说：“谢谢你们。关心不是谁欠谁，是我们愿意互相照顾。”",
      en: "Grandma smiled. ‘Thank you. Care is not a debt. It is something we choose to give one another.’",
      scene: "Xiaoyu offering the tray to Grandma while Xiaohe tucks a cushion nearby, Grandma smiling gratefully, all three at comfortable eye level, intimate family warmth",
    },
    {
      zh: "《三字经》说：\n“为人子，方少时。亲师友，习礼仪。”\n小时候，我们在关系里学习尊重。",
      en: "The Three Character Classic says that while we are young, we learn respect through family, teachers, and friends.",
      scene: "poetic family tableau: Xiaohe greeting Grandma, listening to Xiaoyu, and placing his own cup carefully on the table, three connected everyday gestures in one continuous room without panel divisions",
    },
    {
      zh: "它还讲“黄香温席”。那是古代孩子表达关心的故事，不是要求今天的孩子承担大人的责任。",
      en: "It also tells how young Huang Xiang cared for a parent. It is an old example of kindness—not a rule that children must carry adult responsibilities.",
      scene: "dreamlike historical storybook memory of a young child gently arranging a quilt in an ancient room while a caring adult approaches to help, modern Xiaohe observing safely with Grandma, no hardship or servitude",
    },
    {
      zh: "下午，小禾想玩姐姐的新拼图，伸手就拿走了一块。",
      en: "That afternoon, Xiaohe wanted to play with his sister’s new puzzle and reached for a piece without asking.",
      scene: "living-room floor, Xiaoyu assembling a bright animal puzzle as Xiaohe impulsively picks up one piece, Xiaoyu surprised but calm, Grandma resting in background, medium view",
    },
    {
      zh: "姐姐把拼图收回身边：“这是我的礼物。请先问我。”",
      en: "His sister moved the puzzle closer. ‘This is my gift. Please ask me first.’",
      scene: "Xiaoyu calmly drawing the puzzle closer with both hands while meeting Xiaohe's eyes, Xiaohe pausing to listen, clear respectful boundary, no anger or grabbing",
    },
    {
      zh: "小禾有点失望。他可以不喜欢答案，但不能抢走姐姐的东西。",
      en: "Xiaohe felt disappointed. He did not have to like the answer, but he could not take his sister’s things.",
      scene: "Xiaohe sitting back with a disappointed face and hands in his lap, Xiaoyu keeping the puzzle safely beside her, room remaining warm and connected, close emotional view",
    },
    {
      zh: "“融四岁，能让梨”讲的是愿意分享。真正的分享，应当出自愿意，而不是被迫。",
      en: "The story of Kong Rong praises willing generosity. Real sharing comes from choice, not force.",
      scene: "family fruit plate with several pears on a low table, Xiaohe choosing one and voluntarily sliding another toward Grandma, Xiaoyu watching warmly, no one directing or pressuring him",
    },
    {
      zh: "小禾问：“等你拼完，可以和我一起玩吗？”姐姐想了想，说：“可以。”",
      en: "‘When you finish, can we play together?’ Xiaohe asked. His sister thought for a moment. ‘Yes.’",
      scene: "Xiaohe asking from a respectful distance with open hands, Xiaoyu considering and then smiling, animal puzzle between them, balanced eye-level composition",
    },
    {
      zh: "等待的时候，小禾先去给奶奶画了一张“快快好起来”的画。",
      en: "While he waited, Xiaohe made Grandma a get-well drawing.",
      scene: "Xiaohe drawing cheerful flowers with crayons at the table, Grandma watching fondly from sofa and Xiaoyu completing her puzzle nearby, art paper present but no readable marks",
    },
    {
      zh: "姐姐拼完后，真的来找他。他们重新打散拼图，一人找边角，一人找颜色。",
      en: "When his sister finished, she came to find him. They mixed the puzzle again—one searched for corners, the other for colors.",
      scene: "siblings collaborating on the animal puzzle on the rug, Xiaohe sorting corner pieces and Xiaoyu sorting colors, relaxed laughter, Grandma upright with tea nearby",
    },
    {
      zh: "爱家人，可以是递一杯水、认真听完一句话，也可以是尊重对方说“不”。",
      en: "Loving family can mean offering water, listening to a whole sentence, and respecting someone who says no.",
      scene: "visual recap in one natural evening scene: water cup on side table, Grandma listening to Xiaohe, Xiaoyu holding her completed puzzle, all three comfortable with their own space",
    },
    {
      zh: "这个家里，每个人都能被照顾，也都能保留自己的边界。",
      en: "In this family, everyone can receive care—and everyone can keep their boundaries.",
      scene: "closing family scene on the sofa and rug, Grandma recovered enough to sit, siblings each holding their own chosen activity while sharing warm companionship, soft lamp glow, wide harmonious composition",
    },
  ],
);

const EMOTIONS_ID = "mei-yi-zhong-xin-qing-dou-you-ming-zi";
const EMOTIONS_PAGES = makePages(
  EMOTIONS_ID,
  "Guoguo is a 6-year-old Chinese girl with a wavy shoulder-length black bob, a mint-green sweatshirt with a small cloud patch, plum trousers, and white socks; Dad has short black hair, a warm-brown overshirt, a white T-shirt, and navy trousers",
  [
    {
      zh: "果果搭了很久的积木城堡，被自己的袖子碰倒了。",
      en: "Guoguo had worked a long time on her block castle. Then her sleeve knocked it down.",
      scene: "sunlit playroom, colorful wooden castle tumbling harmlessly across a rug as Guoguo freezes in shock, Dad watering a plant in the background, dynamic opening view",
    },
    {
      zh: "她又气又难过，把一块积木紧紧攥在手里。",
      en: "She felt angry and sad at once, gripping one block tightly in her hand.",
      scene: "Guoguo sitting beside the fallen blocks, fist safely closed around one wooden block, eyebrows tense and eyes watery, Dad approaching slowly but keeping space, close emotional framing",
    },
    {
      zh: "爸爸说：“生气可以。扔积木会砸到人，我们先把手放在软垫上。”",
      en: "‘It is okay to be angry,’ Dad said. ‘Throwing blocks can hurt. Let’s rest your hand on the cushion.’",
      scene: "Dad at eye level pointing gently to a large soft floor cushion, Guoguo choosing to place her block-holding hand on it, clear safety boundary without taking the block from her",
    },
    {
      zh: "《三字经》说：\n“曰喜怒，曰哀惧。爱恶欲，七情具。”\n开心、生气、悲伤、害怕，都是人的感受。",
      en: "The Three Character Classic names joy, anger, sadness, fear, love, dislike, and desire. Feelings are part of being human.",
      scene: "gentle visual metaphor around Guoguo: seven translucent colored ribbons curling like weather—sunny gold, warm red, rainy blue, misty violet and other soft hues—without symbols or faces, Dad nearby",
    },
    {
      zh: "情绪没有“坏孩子”的标签。情绪在告诉我们：有一件事很重要。",
      en: "A feeling does not make anyone a bad child. It tells us that something matters.",
      scene: "Guoguo looking at the scattered castle pieces and touching her chest as she recognizes why she is upset, Dad listening with one hand over his own heart, calm medium shot",
    },
    {
      zh: "果果说：“我气的是城堡倒了，也怕再也搭不好。”说出来以后，肩膀松了一点。",
      en: "‘I’m angry that it fell,’ Guoguo said, ‘and scared I can’t rebuild it.’ Her shoulders softened as she spoke.",
      scene: "Guoguo speaking while pointing to the blocks, posture gradually relaxing, Dad attentive and silent, soft colored emotion ribbons fading into the background",
    },
    {
      zh: "他们像吹蜡烛一样，慢慢呼气三次。果果决定先捡回四个最大的积木。",
      en: "They breathed out slowly three times, as if blowing candles. Guoguo chose to pick up the four biggest blocks first.",
      scene: "Guoguo and Dad doing slow playful candle breaths, then Guoguo gathering four large blocks into a neat group, grounded hands-on action, warm side light",
    },
    {
      zh: "爸爸问：“要我帮忙，还是你想自己来？”果果说：“你帮我扶住底座。”",
      en: "‘Would you like help, or do you want to try alone?’ Dad asked. ‘Please hold the base,’ Guoguo replied.",
      scene: "Dad steadying only the broad wooden base with both hands while Guoguo carefully stacks the next block herself, clear cooperative roles, focused faces",
    },
    {
      zh: "新城堡和原来不一样，却有一座更结实的桥。果果笑了。",
      en: "The new castle looked different, but it had a stronger bridge. Guoguo smiled.",
      scene: "completed rebuilt block castle with a sturdy arch bridge, Guoguo kneeling proudly behind it and Dad admiring from the side, joyful but natural expression",
    },
    {
      zh: "下一次情绪像大浪一样来时，果果知道：先给它一个名字，再选择安全的行动。",
      en: "Next time a feeling arrives like a big wave, Guoguo knows what to do: name it, then choose a safe action.",
      scene: "closing imaginative playroom view, a soft watercolor wave shape curling harmlessly behind Guoguo while she labels emotion cards using colors only and calmly places blocks in a basket, Dad nearby",
    },
  ],
);

const VALUES_ID = "shan-liang-cheng-shi-he-you-fen-cun";
const VALUES_PAGES = makePages(
  VALUES_ID,
  "Zhouzhou is a 7-year-old Chinese boy with short slightly spiky black hair, a brick-red zip jacket, cream T-shirt, dark-green trousers, and gray sneakers; his classmate Tangtang is a 7-year-old Chinese girl with a high black ponytail, a pale-yellow cardigan, a sky-blue dress, and white sneakers; Teacher Lin has a black low ponytail, a navy cardigan, and beige trousers",
  [
    {
      zh: "美术课后，舟舟发现桌上有一盒彩色铅笔，比自己的那盒更新。",
      en: "After art class, Zhouzhou found a box of colored pencils on the table. It was newer than his own.",
      scene: "bright primary classroom after art time, Zhouzhou standing beside a shared table and noticing a beautiful turquoise pencil box, his older red pencil pouch visible in his backpack, wide opening view",
    },
    {
      zh: "教室里没人看见。他很想把那支金色铅笔带回家。",
      en: "No one was watching. He really wanted to take the golden pencil home.",
      scene: "Zhouzhou holding one golden-yellow colored pencil just above the turquoise box, glancing toward the quiet classroom door, conflicted face, no sneaky caricature, medium close view",
    },
    {
      zh: "就在这时，糖糖跑回来，着急地找东西。舟舟把手藏到了身后。",
      en: "Just then, Tangtang hurried back, looking worried. Zhouzhou moved his hand behind his back.",
      scene: "Tangtang checking under the art table with concern while Zhouzhou stands nearby with one hand gently behind him, Teacher Lin distant in hallway, tension kept child-safe",
    },
    {
      zh: "《三字经》说：\n“曰仁义，礼智信。此五常，不容紊。”\n古人把善意、公平、尊重、判断和诚信看得很重要。",
      en: "The Three Character Classic values kindness, fairness, respect, wise judgment, and trustworthiness.",
      scene: "poetic classroom visualization: five warm beams of different colors connect Zhouzhou, Tangtang, the pencil box, a shared art shelf, and Teacher Lin, suggesting values through relationships without symbols or text",
    },
    {
      zh: "品德不是背出五个字，而是在没人提醒时，也能看见别人的需要。",
      en: "Values are not just words to recite. They help us notice another person’s needs, even when no one reminds us.",
      scene: "Zhouzhou looking from the pencil in his hand to Tangtang's worried face, his expression changing from desire to empathy, close eye-level emotional composition",
    },
    {
      zh: "舟舟走过去：“这支笔在我这里。我刚才很想拿走它，对不起。”",
      en: "Zhouzhou stepped forward. ‘I have your pencil. I wanted to take it. I’m sorry.’",
      scene: "Zhouzhou offering the golden pencil back with both hands, Tangtang looking surprised but listening, respectful distance, Teacher Lin not intervening, medium view",
    },
    {
      zh: "糖糖接过笔，说：“谢谢你告诉我。我刚才真的很担心。”",
      en: "Tangtang took it. ‘Thank you for telling me. I was really worried.’",
      scene: "Tangtang receiving the pencil and holding it near the turquoise box, relief on her face, Zhouzhou listening to the impact of his choice, gentle classroom light",
    },
    {
      zh: "说出真话以后，事情还没有结束。舟舟问：“我能做什么让你安心？”",
      en: "Telling the truth was not the end. ‘What can I do to help you feel safe?’ Zhouzhou asked.",
      scene: "Zhouzhou asking with open hands while Tangtang considers, the full pencil set between them, Teacher Lin quietly organizing art in the background",
    },
    {
      zh: "他们一起数好铅笔，把名字卡放进盒盖里，再把盒子交给老师保管。",
      en: "They counted the pencils together, placed the owner card inside, and asked the teacher to keep the box safe.",
      scene: "Zhouzhou and Tangtang counting colored pencils side by side, placing a blank colored owner card inside the lid with no readable writing, Teacher Lin receiving the closed box",
    },
    {
      zh: "第二天，糖糖主动借给舟舟那支金色铅笔。舟舟用完后马上放回原位。",
      en: "The next day, Tangtang chose to lend Zhouzhou the golden pencil. He returned it as soon as he finished.",
      scene: "during art class, Tangtang willingly passing the golden pencil to Zhouzhou, then Zhouzhou's hand returning it beside a finished sun drawing with no letters, classmates blurred behind",
    },
    {
      zh: "诚信不是从来不犯错，而是犯错后愿意承认、补救，并重新赢得信任。",
      en: "Being trustworthy does not mean never making mistakes. It means admitting them, repairing harm, and rebuilding trust.",
      scene: "Zhouzhou and Tangtang working on one shared mural paper with separate pencil sets and relaxed trust, Teacher Lin smiling nearby, collaborative wide composition",
    },
    {
      zh: "善良有行动，诚实有勇气，分寸则提醒我们：喜欢一样东西，也要尊重它属于谁。",
      en: "Kindness takes action. Honesty takes courage. Good boundaries remind us that wanting something does not make it ours.",
      scene: "closing classroom cubby scene, Zhouzhou placing his old red pencil pouch in his own cubby while Tangtang places the turquoise box in hers, both smiling and walking to class together",
    },
  ],
);

const LEARNING_ID = "hui-du-hui-xiang-ye-hui-wan";
const LEARNING_PAGES = makePages(
  LEARNING_ID,
  "Mili is a 7-year-old Chinese girl with long black hair in one loose braid, a sky-blue sweatshirt with a small white bird patch, rust-orange trousers, and teal slippers; Mama has a short black bob, a rose-brown cardigan, a cream blouse, and dark trousers",
  [
    {
      zh: "周六早上，米粒要读一本关于候鸟的书。她一口气念完一页，却什么也没记住。",
      en: "On Saturday morning, Mili read a whole page about migrating birds in one breath—but remembered none of it.",
      scene: "cozy home reading nook, Mili holding an illustrated bird book and reading very quickly, pages fluttering slightly, her eyes tired and unfocused, Mama arranging tea nearby, wide opening view",
    },
    {
      zh: "她叹气：“是不是我不够聪明？”妈妈摇摇头：“也许只是方法还没找到。”",
      en: "‘Maybe I’m not smart enough,’ she sighed. Mama shook her head. ‘Maybe we just haven’t found your method yet.’",
      scene: "Mili slumped gently over the open bird book while Mama sits beside her at eye level, reassuring expression and open hand, intimate natural view",
    },
    {
      zh: "《三字经》说：\n“凡训蒙，须讲究。详训诂，明句读。”\n学习要讲方法，先读懂词句。",
      en: "The Three Character Classic says that early learning deserves care: understand the words and pauses first.",
      scene: "Mili and Mama using smooth wooden counters to mark natural pauses beside an open illustrated bird book, no visible letters, their fingers following the pictures slowly",
    },
    {
      zh: "米粒先把长长的一页分成三小段，每读一段，就停下来画一个小记号。",
      en: "Mili divided the long page into three small parts. After each part, she paused and made a tiny picture mark.",
      scene: "Mili reading one short section, then sketching a simple wing-shaped icon on a sticky note with no letters, three colored tabs along the page edge, focused overhead three-quarter view",
    },
    {
      zh: "“口而诵，心而惟。”不只是嘴巴读，也要在心里想：它为什么要飞那么远？",
      en: "‘Read it aloud and think it through.’ Mili asked herself: why do the birds fly so far?",
      scene: "Mili gazing out the window at a small flock crossing the sky while holding the bird book, thoughtful expression, a soft imagined migration path curving through clouds without arrows or text",
    },
    {
      zh: "她用积木摆出山、湖和小岛，让一只纸鸟沿着路线飞过去。",
      en: "She built mountains, a lake, and an island with blocks, then flew a paper bird along the route.",
      scene: "living-room rug transformed into a playful migration map made from wooden blocks and blue fabric, Mili moving one folded paper bird above it, Mama observing with delight",
    },
    {
      zh: "玩了一会儿，米粒突然明白：鸟儿需要一路寻找食物和休息的地方。",
      en: "As she played, Mili understood: birds need food and resting places all along their journey.",
      scene: "Mili placing tiny seed bowls and green felt resting islands along the block route, face bright with realization, paper bird hovering in her other hand",
    },
    {
      zh: "学习不只发生在桌前。朗读、提问、动手和游戏，都能帮助大脑连接新知识。",
      en: "Learning does not happen only at a desk. Reading, questions, making, and play all help the brain connect new ideas.",
      scene: "one continuous room showing Mili naturally moving between the reading nook, block migration map, window observation, and a small craft table, no panel divisions, energetic but uncluttered",
    },
    {
      zh: "午饭前，妈妈提醒她休息。米粒跑到楼下跳绳，让眼睛和身体都松一松。",
      en: "Before lunch, Mama reminded her to rest. Mili went downstairs to skip rope and relax her eyes and body.",
      scene: "sunny apartment courtyard, Mili happily skipping rope with full body visible, bird book left safely indoors by the window, Mama watching from a bench, lively wide shot",
    },
    {
      zh: "回来以后，她用自己的话讲给妈妈听，还发现了一个没弄懂的问题。",
      en: "When she returned, she explained the idea in her own words—and found one question she still did not understand.",
      scene: "Mili presenting the block migration route to Mama, pointing to one uncertain spot with a curious face rather than embarrassment, paper bird and seed stops clearly arranged",
    },
    {
      zh: "她们一起查了儿童地图，又把问题留到下次去自然博物馆时再问。",
      en: "They checked a children’s map together and saved the question for their next museum visit.",
      scene: "Mili and Mama studying a colorful child-friendly world map with shapes but no readable labels, placing a bird-shaped bookmark for the unanswered question, warm evening lamp",
    },
    {
      zh: "会学习，不是坐得最久、背得最快，而是会读、会想、会问，也知道什么时候去玩一会儿。",
      en: "Learning well is not about sitting longest or reciting fastest. It means reading, thinking, asking—and knowing when to play.",
      scene: "closing window scene at sunset, Mili placing the bird book on a shelf beside her paper bird, then reaching for a jump rope with a satisfied smile, Mama nearby, migrating birds visible outside",
    },
  ],
);

export const SANZIJING_SERIES: LibrarySeries = {
  id: "sanzijing",
  title: "三字经·亲子成长",
  subtitle: "读古人的三字句，练今天的爱、尊重与成长",
  description:
    "面向 4–8 岁家庭的《三字经》主题选读：保留经典原文，用现代儿童故事讲习惯、关系、情绪、品格与学习，并给家长一份不说教的共读锦囊。",
  accent: "#8b5a3c",
  ageRange: "4–8 岁",
  bookCount: 6,
};

export const SANZIJING_BOOKS: LibraryBook[] = [
  {
    id: HABITS_ID,
    seriesId: SANZIJING_SERIES.id,
    title: "习惯会慢慢长大",
    subtitle: "不用贴标签，把一件小事练成自然",
    origin: "《三字经》开篇",
    moral: {
      zh: "习惯来自环境、示范和一次次练习，不来自“乖孩子”或“坏孩子”的标签。",
      en: "Habits grow from supportive surroundings, modelling, and repeated practice—not labels about good or bad children.",
    },
    classic: {
      workTitle: "《三字经》",
      originalLines: [
        "人之初，性本善。性相近，习相远。",
        "苟不教，性乃迁。教之道，贵以专。",
      ],
      childExplanation: {
        zh: "人会受到每天经历和练习的影响。稳定、专心地练一件小事，它就可能成为习惯。",
        en: "Daily experiences and practice shape us. A small action can become a habit when we practise it steadily.",
      },
      historicalContext:
        "“性本善”是古人的人性观点，不是给孩子下结论的科学标准。本册取“习惯受环境影响、教育需要专注耐心”的部分，不用天性好坏评价孩子。",
    },
    parentGuide: {
      goal: "把抽象要求改成一个看得见、做得到的微习惯，并用环境提示帮助孩子成功。",
      reminder: "少说“你总是丢三落四”“要做乖孩子”，只描述事实和下一步；忘记一次不等于习惯失败。",
      questions: [
        "乐乐最开始为什么总找不到东西？",
        "家里哪一件小事，也可以有一个固定的“家”？",
        "如果明天忘记了，我们可以用什么温柔提醒？",
      ],
      activity: "和孩子只选一个两分钟内能完成的动作，设计一个看得见的环境提示，连续练习七天；不打分，只记录有没有想起来。",
      ageTips: {
        age4to5: "一次只练一个动作，由大人示范并陪着做。",
        age6to8: "让孩子参与选择提示物，并自己复盘哪里容易忘记。",
      },
    },
    pages: HABITS_PAGES,
    ageLabel: "4–8 岁",
    publishedAt: "2026-08-27",
    order: 1,
    metadata: { personalizationEnabled: false, featured: true },
  },
  {
    id: SUPPORT_ID,
    seriesId: SANZIJING_SERIES.id,
    title: "陪孩子把路走长",
    subtitle: "支持不是催促，是一起找到下一小步",
    origin: "《三字经》孟母教子段",
    moral: {
      zh: "合适的环境、可承受的步骤和稳定陪伴，比威胁与催促更能帮助孩子坚持。",
      en: "A supportive setting, manageable steps, and steady company help children persist better than pressure or threats.",
    },
    classic: {
      workTitle: "《三字经》",
      originalLines: ["昔孟母，择邻处。子不学，断机杼。"],
      childExplanation: {
        zh: "这个古代故事重视成长环境和坚持。今天，大人可以用支持与拆分步骤陪孩子学习。",
        en: "This old story values a supportive environment and persistence. Today, adults can help by offering support and smaller steps.",
      },
      historicalContext:
        "“断机杼”带有古代劝学中的强烈警示色彩。本册明确把它放回历史语境，不模仿威胁和牺牲式教育，只保留家长主动改善环境、重视学习过程的启发。",
    },
    parentGuide: {
      goal: "当孩子说“我不会”时，先定位真正困难，再把任务拆成孩子愿意尝试的下一步。",
      reminder: "不要用孟母故事暗示“父母付出这么多，你必须成功”；孩子可以暂停，也有权决定何时继续。",
      questions: [
        "安安真正害怕的是骑车的哪一步？",
        "爸爸做了什么，既提供帮助又没有替她完成？",
        "你最近遇到的难事，可以拆成哪一步？",
      ],
      activity: "画一条三格“小步路线”：第一格是现在会的，第二格是下一次尝试，第三格是需要谁提供什么帮助。",
      ageTips: {
        age4to5: "把任务拆成身体能直接模仿的单一步骤。",
        age6to8: "邀请孩子自己说出困难点，并共同约定停止信号。",
      },
    },
    pages: SUPPORT_PAGES,
    ageLabel: "4–8 岁",
    publishedAt: "2026-08-27",
    order: 2,
    metadata: { personalizationEnabled: false, featured: true },
  },
  {
    id: RESPECT_ID,
    seriesId: SANZIJING_SERIES.id,
    title: "爱家人，也尊重自己",
    subtitle: "关心是双向的，分享也需要愿意",
    origin: "《三字经》礼仪与亲情段",
    moral: {
      zh: "爱既包括照顾和分享，也包括倾听拒绝、尊重物品与身体边界。",
      en: "Love includes care and generosity, as well as listening to no and respecting personal boundaries.",
    },
    classic: {
      workTitle: "《三字经》",
      originalLines: [
        "为人子，方少时。亲师友，习礼仪。",
        "香九龄，能温席。孝于亲，所当执。",
        "融四岁，能让梨。弟于长，宜先知。",
      ],
      childExplanation: {
        zh: "小时候，我们在家庭和朋友之间学习关心、礼貌与分享，也学习尊重每个人的界限。",
        en: "While young, we learn care, respect, and generosity with family and friends—and we learn to honour everyone's boundaries.",
      },
      historicalContext:
        "黄香温席和孔融让梨反映古代对孝悌的期待。今天不把照顾大人变成儿童义务，也不以年龄强迫让出物品；关心应当双向，分享应当自愿。",
    },
    parentGuide: {
      goal: "同时培养关心他人的能力与清楚表达、尊重界限的能力。",
      reminder: "不要用“你大/你小，所以必须让”结束冲突；先确认物品归属，再帮助孩子提出请求、协商时间。",
      questions: [
        "小禾照顾奶奶时，为什么要请姐姐帮忙？",
        "姐姐说“不”以后，小禾还能怎么表达愿望？",
        "自愿分享和被迫交出来，感受有什么不同？",
      ],
      activity: "全家各选一件“借用前必须先问”的物品，再共同选一件任何人都可以使用的共享物品。",
      ageTips: {
        age4to5: "练习“这是我的”“请先问我”“我现在不愿意”三句话。",
        age6to8: "讨论所有权、共享和轮流使用的区别，并让孩子提出协商方案。",
      },
    },
    pages: RESPECT_PAGES,
    ageLabel: "4–8 岁",
    publishedAt: "2026-08-27",
    order: 3,
    metadata: { personalizationEnabled: false, featured: true },
  },
  {
    id: EMOTIONS_ID,
    seriesId: SANZIJING_SERIES.id,
    title: "每一种心情都有名字",
    subtitle: "情绪都可以来，行动要保证安全",
    origin: "《三字经》七情段",
    moral: {
      zh: "接纳所有情绪，同时为行为设下安全边界：先命名，再选择。",
      en: "All feelings are welcome, while actions still need safe boundaries: name the feeling, then choose.",
    },
    classic: {
      workTitle: "《三字经》",
      originalLines: ["曰喜怒，曰哀惧。爱恶欲，七情具。"],
      childExplanation: {
        zh: "开心、生气、悲伤、害怕、喜爱、不喜欢和想要，都是人会有的感受。",
        en: "Joy, anger, sadness, fear, love, dislike, and desire are all feelings people can have.",
      },
      historicalContext:
        "古人用“七情”概括人的情感体验。本册不要求压住情绪，而是帮助孩子扩充情绪词汇，同时区分“感受可以存在”和“行为需要安全”。",
    },
    parentGuide: {
      goal: "帮助孩子识别混合情绪，并把情绪接纳与行为边界放在同一句话里。",
      reminder: "少说“不许生气”“这有什么好哭的”；可以说“你很生气，我不会让你扔积木”。",
      questions: [
        "果果同时有哪两种感受？",
        "生气时，哪些行动安全，哪些会伤到人？",
        "身体会怎样提醒你情绪正在变大？",
      ],
      activity: "每人用一种天气描述今天的心情，再说一个安全的需要：想抱抱、想安静、想喝水或想自己待一会儿。",
      ageTips: {
        age4to5: "先从开心、生气、难过、害怕四个基础词开始。",
        age6to8: "练习同时说出两种感受，并区分感受、想法和行动。",
      },
    },
    pages: EMOTIONS_PAGES,
    ageLabel: "4–8 岁",
    publishedAt: "2026-08-27",
    order: 4,
    metadata: { personalizationEnabled: false },
  },
  {
    id: VALUES_ID,
    seriesId: SANZIJING_SERIES.id,
    title: "善良、诚实和有分寸",
    subtitle: "做错以后，还可以承认、补救和重建信任",
    origin: "《三字经》五常段",
    moral: {
      zh: "品格不是从不犯错，而是在选择中看见别人，并愿意为自己的行为负责。",
      en: "Character is not never making mistakes. It is noticing others in our choices and taking responsibility for what we do.",
    },
    classic: {
      workTitle: "《三字经》",
      originalLines: ["曰仁义，礼智信。此五常，不容紊。"],
      childExplanation: {
        zh: "善意、公平、尊重、判断和诚信，要落实在每天怎样对待人、怎样做选择。",
        en: "Kindness, fairness, respect, judgment, and trustworthiness live in how we treat people and make daily choices.",
      },
      historicalContext:
        "“五常”来自传统伦理体系。本册不要求孩子背抽象规范，而用物品归属、诚实说明和关系修复，让价值变成可观察的行动。",
    },
    parentGuide: {
      goal: "让孩子理解诚实之后还需要修复，并相信承认错误不会失去大人的爱。",
      reminder: "孩子说真话时，先回应诚实与影响，再讨论补救；避免追问式审讯、羞辱或给孩子贴“小偷”“撒谎精”标签。",
      questions: [
        "舟舟为什么把手藏起来？",
        "他说出真话以后，还做了哪几件修复关系的事？",
        "如果你是糖糖，怎样才会重新感到安心？",
      ],
      activity: "家庭成员轮流完成一句话：“我有一次做错了……后来我用……来补救。”大人先示范一个真实但适龄的小错误。",
      ageTips: {
        age4to5: "用“发生了什么—谁受影响—现在能做什么”三个问题引导。",
        age6to8: "增加物品归属、借用同意和重建信任的讨论。",
      },
    },
    pages: VALUES_PAGES,
    ageLabel: "4–8 岁",
    publishedAt: "2026-08-27",
    order: 5,
    metadata: { personalizationEnabled: false },
  },
  {
    id: LEARNING_ID,
    seriesId: SANZIJING_SERIES.id,
    title: "会读、会想，也会玩",
    subtitle: "学习有方法，休息和游戏也是方法的一部分",
    origin: "《三字经》训蒙与学习段",
    moral: {
      zh: "真正的学习包含朗读、理解、提问、动手、休息和游戏，不以坐得久或背得快衡量。",
      en: "Real learning includes reading, understanding, questions, making, rest, and play—not simply sitting longest or reciting fastest.",
    },
    classic: {
      workTitle: "《三字经》",
      originalLines: [
        "凡训蒙，须讲究。详训诂，明句读。",
        "口而诵，心而惟。朝于斯，夕于斯。",
      ],
      childExplanation: {
        zh: "学习要讲方法：读清楚、想明白、提出问题，再通过练习把新知识连接起来。",
        en: "Learning needs methods: read clearly, think deeply, ask questions, and connect new ideas through practice.",
      },
      historicalContext:
        "原文强调训诂、句读和勤学，有其传统教育背景。本册保留“读与思结合”，同时明确休息、身体活动和游戏同样有学习价值，不采用“戏无益”的观念。",
    },
    parentGuide: {
      goal: "把“认真学习”从时间和背诵速度，转向理解、提问、表达与迁移。",
      reminder: "不要用坐得久、读得快判断专心；走动、搭建和游戏可能正是孩子处理信息的方式。",
      questions: [
        "米粒第一次为什么读完却没记住？",
        "哪一种方法让她突然理解候鸟的旅行？",
        "你学习什么时最喜欢用身体、图画或游戏帮忙？",
      ],
      activity: "选一个孩子正在学的概念，用“读一小段—问一个问题—动手摆出来—讲给别人听—休息”完成一次二十分钟学习循环。",
      ageTips: {
        age4to5: "以讲、画、摆和身体模仿为主，桌面任务保持短小。",
        age6to8: "让孩子复述、提出未解决问题，并自己选择一种展示理解的方法。",
      },
    },
    pages: LEARNING_PAGES,
    ageLabel: "4–8 岁",
    publishedAt: "2026-08-27",
    order: 6,
    metadata: { personalizationEnabled: false },
  },
];
