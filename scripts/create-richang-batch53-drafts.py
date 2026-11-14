"""Save the approved single book #53 (Today is not my birthday: treasure map of surprise gift)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SLUG = 'jin-tian-bu-shi-sheng-ri-ya'
TITLE = '今天不是生日呀'
SUBTITLE = '一个普通下午的藏宝图'
MORAL = '惊喜不是表现完美的奖励，而是妈妈一直把你放在心上的悄悄告白；普通的日子，也可以因为爱而闪闪发光。'
MORAL_EN = 'A surprise is not a reward for being perfect; it is Mom’s quiet way of saying she sees your effort and loves you every single day.'
TAGS = ['惊喜礼物', '亲子情感', '生活仪式感', '肯定与看见', '双向的爱', '家庭温暖']
GOAL = '引导孩子理解“被关注与被爱”不取决于分数或特定节日仪式；体会家人之间细致入微的观察与陪伴，培养孩子表达感恩与爱的双向情感能力。'
REMINDER = '送孩子惊喜时，不妨强调“我看到了你某件具体的努力”而非空洞的表扬，让礼物成为成长的温情见证；接纳孩子用图画、小拥抱等方式给予家人的爱心回馈。'
QUESTIONS = ['安安找到礼物的三个线索，分别藏在哪里？', '妈妈送安安的礼物是什么？为什么安安觉得比买来的大玩具还宝贝？']
ACTIVITY = '在家里设置一个“家庭悄悄话信箱”，放一个闲置的小盒子在客厅，家庭成员可以在任何平凡的一天塞进画或纸条，给彼此创造小惊喜。'
PAGES = '''
日历上没有红色的圈圈，今天不是六一儿童节，也不是安安的生日。放学回到家，安安坐在地毯上搭小桥，妈妈在厨房切着多汁的甜橙。|There was no red circle on the calendar; today was neither Children's Day nor An'an's birthday. Home after school, An'an built a block bridge on the rug while Mom sliced juicy sweet oranges in the kitchen.|Bright afternoon living room view: sunlight spills over clean oak floor and colorful rug; An'an in teal hoodie builds block bridge; Mom in coral cardigan slices oranges at pastel-green kitchen counter.
安安跑去擦手，忽然发现茶几正中央放着一只小巧的黄色折纸船。船帆的一侧，用彩色笔画着一个指向右边的小箭头。|Drying her hands, An'an noticed a small yellow origami boat resting right in the middle of the coffee table. On one side of the paper sail, a bright little arrow pointed to the right.|Living room eye-level medium close-up: a neat yellow origami boat sits on the smooth wooden coffee table; clean bold arrow on the sail points toward the hallway.
“妈妈，这是谁折的小船呀？”安安好奇地拿起来。妈妈端着橙子走过来，眨了眨眼睛：“家里藏着一个秘密宝藏，只有细心的小侦探才能找到第一把钥匙。”|“Mom, who made this little boat?” An'an asked, picking it up curiously. Mom walked over with the fruit plate and winked. “A secret treasure is hidden in our home, and only a sharp detective can find the first key.”|Warm two-shot: Mom bends near the coffee table with a small smile; An'an holds the yellow paper boat in her palms, her eyes wide with eager wonder.
安安轻轻展开小船，里面果然藏着一张小卡片。卡片上画着一个白色的小圆碟，碟子里放着一颗黄色的星星发夹。|An'an gently unfolded the paper boat, and out slipped a little card. On it was a drawing of a small white saucer holding a bright yellow star hair clip.|Close-up of small hands unfolding yellow paper: an illustrated white card shows a simple saucer and yellow star hair clip; An'an's joyful realization.
“这是我每天睡前放发夹的地方！”安安蹬蹬蹬跑进卧室。在小床头柜的白碟子底下，果然压着一只淡粉色的小信封。|“That's where I keep my hair clip every night!” An'an trotted into her bedroom. Sure enough, tucked beneath the white saucer on her low nightstand was a soft pink envelope.|Bedroom afternoon view: gentle sunlight on wooden cot and daisy blanket; An'an lifts the small white saucer, revealing a flat pastel-pink envelope beneath it.
打开信封，第二张卡片上画着绿油油的叶子和几颗圆滚滚的小红果。“是阳台上我们一起种的小番茄！”安安一跃而起。|Opening the envelope, she saw the second card: lush green leaves and plump little red fruits. “It's the cherry tomato plant on our balcony!” An'an hopped up excitedly.|Bedroom doorway medium shot: An'an holding the green leaf-and-berry card in one hand, eagerly turning toward the sunny balcony sliding doors.
跑进阳台，番茄花盆旁边端端正正放着小喷壶。花盆边贴着一张小纸条：“给番茄苗喝足水，下一把钥匙才会出现。”安安像在大班当值日生一样，耐心轻巧地喷洒着水珠。|Out on the balcony, a little spray mister sat neatly beside the tomato pot. A note was taped to the rim: “Give the plant a good drink, and the next key will appear.” Like a proud helper, An'an misted the leaves patiently.|Sunny balcony view: leafy potted tomato plant with small red cherry tomatoes; An'an holds small mist spray bottle steadily, misty droplets catching sunlight on glossy green leaves.
水雾在阳光下闪闪发亮。安安一眼看见喷水壶的手柄底下系着一根细细的蓝色缎带，一直悄悄延伸到客厅低矮的书架深处。|The water mist sparkled in the sun. An'an instantly spotted a slender blue ribbon tied beneath the spray mister's handle, trailing quietly toward the low bookshelf in the living room.|Balcony floor detail: An'an notices the thin sky-blue satin ribbon tied around the bottle handle, guiding the eye into the living room corner.
顺着丝带摸到书架最底层，安安从绘本后面抱出了一个沉甸甸的包裹。牛皮纸包得整整齐齐，上面扎着一个漂亮的小蝴蝶结。|Following the ribbon to the bottom shelf, An'an pulled out a substantial package hidden behind the picture books. It was wrapped neatly in brown craft paper with a lovely little bow.|Floor-level shot: An'an kneeling by the low wooden bookshelf, pulling out a neat rectangular parcel tied with yellow twine from behind colorful books.
安安捧着盒子跑到妈妈面前，小脸有些发红：“妈妈，今天既不是节日，也不是我的生日，我真的可以打开它吗？”|Holding the box, An'an hurried to Mom, her cheeks flushed. “Mom, today isn't a holiday and it's not my birthday. May I really open it?”|Living room two-shot: An'an hugs the brown paper package to her chest, looking up with shy longing; Mom kneels warmly before her with open arms.
妈妈张开手臂把安安揽在怀里：“谁说只有生日才能有礼物？妈妈看到你上了大班以后，能自己把书包收得整整齐齐，还能耐心照顾小植物。妈妈想在这个普通的星期二，抱抱我的大姑娘。”|Mom wrapped her arms around An'an. “Who says presents are only for birthdays? I saw how neatly you pack your schoolbag in big class, and how patiently you care for the plants. I simply wanted to give my big girl an extra hug this Tuesday.”|Tender embrace: Mom in coral cardigan hugs An'an tightly against her shoulder; both smile with calm sweetness; parcel rests safely on the coffee table.
安安拉开蝴蝶结，剥开软软的棉纸。盒子里静静躺着一只妈妈亲手用粗毛线钩织的柔软小黄星挂坠，还有一个刻着可爱纹路的原木色双层小木盒。|An'an untied the ribbon and peeled back the soft tissue paper. Inside lay a plump yellow star charm hand-crocheted from cozy yarn, alongside a double-tiered natural wood treasure box with carved patterns.|Top-down close-up: tissue paper peeled open; a plush crocheted yellow yarn star charm and a smooth two-tiered wooden box rest side by side in the parcel.
打开小木盒，上层刚好能放下她的乳牙小粉盒和黄色发夹；下层放着一本手缝的空白小手账，第一页贴着安安背着大班书包在门口大笑的照片。|Opening the wooden box, the top tray fit her pink tooth box and yellow star clip perfectly; the bottom held a hand-stitched blank journal, its first page showing a photo of An'an smiling proudly in her big-class backpack.|Detailed view: An'an lifts the top wooden tray; pink tooth keepsake box and yellow clip sit snugly inside; small blank journal with photo visible underneath.
安安立刻把毛线小黄星挂在了橙色书包的拉链上。挂坠随着拉链轻轻摇晃，就像妈妈暖和的大手一直牵着她一样。|An'an immediately fastened the soft yarn star onto the zipper of her orange backpack. The star swayed gently, feeling just like Mom's warm hand holding hers wherever she went.|Entryway view: An'an clips the plump yellow yarn star to the orange backpack zipper; the backpack hangs on the low coat peg, star swaying softly.
安安靠在妈妈怀里轻声说：“妈妈，我还以为我收书包、擦桌子的小事，谁都不会注意呢。”妈妈笑了：“妈妈的眼睛是一台神奇摄像机，你长大的每一小步，我都悄悄记下了。”|Nestling into Mom's side, An'an whispered, “Mom, I thought nobody noticed when I packed my bag or wiped the table.” Mom laughed softly. “My eyes are like a magic camera. Every little step of your growing up is quietly saved in my heart.”|Couch side view: An'an rests her head against Mom's arm on the sofa, looking up gratefully; Mom gently taps An'an's nose with an affectionate smile.
安安忽然坐直身子，抓起桌上的彩色铅笔，在手账本的第二页上画了一个大大的爱心，中间画着两个人紧紧牵手：“妈妈，这个本子是我们的悄悄话本，我也送你一朵永远不凋谢的红花！”|An'an suddenly sat straight, grabbed colored pencils from the table, and drew a big red heart on the journal's second page with two stick figures holding hands. “Mom, this is our whisper book. Here is an eternal flower for you, too!”|Desk view: An'an leans over the little blank journal drawing a vibrant red crayon flower and heart; Mom watches closely beside her, touched and beaming.
黄昏的金色日光悄悄爬上了餐桌。母女俩一起剥着甜甜的橙子，果香在客厅里弥漫开来，窗外是亮起温暖路灯的街道。|Golden twilight crept across the dinner table. Mother and daughter shared sweet orange slices together, the citrus aroma filling the room while soft streetlamps blinked on outside.|Warm evening dining room view: Mom and An'an sharing juicy orange wedges at the oak table; the wooden treasure box sits proudly beside the fruit bowl; evening streetlamps glow through the window.
睡前，安安在墙上的大日历里，给今天的“星期二”旁边认真画了一颗金黄色的小太阳。原来，不用等大大的节日，只要用心相爱，每一个普通的日子都能拆出闪闪发光的惊喜。|At bedtime, An'an drew a bright golden sun beside today's Tuesday on the wall calendar. It turns out you never have to wait for a big holiday; whenever love is shared, any ordinary day can unwrap a shining surprise.|Cozy bedtime bedroom: warm soft nightlight glow; An'an in pale yellow pajamas stands by the calendar adding a little golden sun beside Tuesday; peaceful happy smile.
'''


def rows():
    pages = [tuple(part.strip() for part in row.split('|')) for row in PAGES.strip().splitlines() if row.strip()]
    assert all(len(page) == 3 and all(page) for page in pages), TITLE
    return pages


def main():
    target = ROOT / 'content-drafts/richang'
    batch = target / 'batch-53-53'
    book_file = target / f'{SLUG}.json'
    if book_file.exists() or batch.exists():
        raise SystemExit('Book 53 already exists; edit the reviewed JSON draft instead of overwriting production work.')
    pages = rows()
    assert len(pages) == 18, f'{TITLE} has {len(pages)} pages, expected 18'
    assert len({p[0] for p in pages}) == 18, f'{TITLE} has duplicate page texts'

    kit = json.loads((target / 'lan-ping-guo.json').read_text())['imagePromptKit'].copy()
    kit['characterConsistency'] += (
        " Mom: adult Chinese woman, shoulder-length black hair, coral cardigan, cream trousers. "
        "An'an: six-year-old Chinese GIRL, round face, ear-length straight black bob, yellow star hair clip on her left, "
        "plain teal zip-front hoodie, blue jeans, white sneakers with red trim. Bedtime: pale yellow pajamas. "
        "Only page-specific cast appears."
    )

    order = 53
    book = dict(
        id=SLUG, seriesId='richang', title=TITLE, subtitle=SUBTITLE,
        moral=dict(zh=MORAL, en=MORAL_EN), ageLabel='4–8 岁', publishedAt='2026-11-04', order=order,
        comingSoon=True,
        pages=[dict(page=i, zhText=zh, enText=en, illustrationPrompt=scene, imageStatus='pending') for i, (zh, en, scene) in enumerate(pages, 1)],
        metadata=dict(
            category='family-growth', ageRange=dict(min=4, max=8), estimatedMinutes=6,
            languages=['zh', 'en'], seriesId='richang', seriesOrder=order, personalizationEnabled=False,
            tags=['日常系列', '生活智慧', '亲子共读', '幼小衔接', '家庭温情', *TAGS], featured=False, bedtimeSuitable=True,
        ),
        parentGuide=dict(
            goal=GOAL, reminder=REMINDER, questions=QUESTIONS, activity=ACTIVITY,
            ageTips=dict(
                age4to5='引导孩子观察图画中的寻宝线索，体会收到礼物的惊喜与开心；鼓励孩子用拥抱或画画回应妈妈的爱。',
                age6to8='讨论为什么普通日子也会有礼物，引导孩子认识到自己的成长与自理一直被父母看在眼里；建立双向感恩与表达爱的习惯。',
            ),
        ),
    )
    book_file.write_text(json.dumps(dict(book=book, imagePromptKit=kit), ensure_ascii=False, indent=2) + '\n')

    batch.mkdir(parents=True, exist_ok=True)
    plan = dict(approved=True, approvedAt='2026-11-04', totalPages=18,
                books=[dict(id=SLUG, title=TITLE, pages=18, order=order)])
    (batch / 'plan.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2) + '\n')

    manuscript = ['# 日常系列第 53 本逐页文稿与分镜（今天不是生日呀）\n',
                  f'用户于 2026-11-04 确认：妈妈给安安送惊喜礼物的寻宝绘本。\n',
                  f'## {TITLE}\n', f'副标题：{SUBTITLE}\n', f'寓意：{MORAL}\n',
                  f'亲子目标：{GOAL}\n', f'家长提醒：{REMINDER}\n']
    for i, (zh, en, scene) in enumerate(pages, 1):
        manuscript.append(f'### 第 {i} 页\n\n{zh}\n\n{en}\n\n分镜：{scene}\n')
    manuscript.append('共读问题：\n' + '\n'.join(f'- {question}' for question in QUESTIONS) + f'\n\n小活动：{ACTIVITY}\n')
    (batch / 'manuscript.md').write_text('\n'.join(manuscript))

    characters = {
        "An'an": "An'an is a six-year-old Chinese GIRL, round face, ear-length straight black bob, yellow star hair clip on her left, plain teal zip-front hoodie, blue jeans, white sneakers with red trim. Preserve her female identity.",
        'Mom': 'Mom is an adult Chinese woman, shoulder-length black hair, coral cardigan and cream trousers.',
    }
    jobs = []
    for page, (_, _, scene) in enumerate(pages, 1):
        cast = [description for name, description in characters.items() if name in scene]
        prompt = '\n'.join([
            kit['globalStyle'],
            'Asset type: one individual full-bleed square picture-book illustration, one coherent scene, never a multi-panel sheet.',
            *cast,
            'Draw ONLY the people named in this page scene. Keep identities, faces, hair and clothing consistent. No additional family members or bystanders. Cozy urban home living room, balcony and bedroom, oak furniture, pastel-green kitchen, sunny friendly atmosphere.',
            "THIS PAGE'S SCENE: " + scene,
            'Follow current object state literally. Do not anticipate later events. All notice boards, calendars, books and drawings stay blank with simple shapes, never readable text or letters. Match the requested camera view, natural hands and subtle readable feelings.',
            'Avoid: ' + kit['negative'],
        ])
        jobs.append(dict(id=SLUG, page=page, prompt=prompt))
    (batch / 'image-prompts.json').write_text(json.dumps(jobs, ensure_ascii=False, indent=2) + '\n')

    progress = dict(manuscripts='complete', totalPages=18, imagesComplete=0, narration='pending',
                    books=[dict(id=SLUG, title=TITLE, pages=18, order=order, completeImages=0, narration='pending', locallyReadable=False)],
                    uploaded=False, deployed=False, status='manuscripts-ready', createdOn='2026-11-04')
    (batch / 'progress.json').write_text(json.dumps(progress, ensure_ascii=False, indent=2) + '\n')
    print(f'Built {TITLE} with 18 bilingual pages.')


if __name__ == '__main__':
    main()
