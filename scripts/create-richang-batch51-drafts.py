"""Save the approved single book #51 (Wednesday duty helper and parent volunteer gate duty); never overwrite finished work."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

SLUG = 'ma-ma-zai-xiao-men-kou-zhan-gang'
TITLE = '今天妈妈在校门口站岗'
SUBTITLE = '一个值日生和一个志愿者'
MORAL = '帮大家做事的位置有很多种；在自己的岗位上做好小事，就是在为大家站岗。'
MORAL_EN = 'There are many places where we can help; doing our own small job well is already standing guard for everyone.'
TAGS = ['值日服务', '家长志愿者', '岗位与规则', '亲社会行为']
GOAL = '理解“值日”和“志愿服务”都是为集体做事，体验在自己的位置上完成责任的成就感，同时学习在成人工作时保持安全距离。'
REMINDER = '不把站岗说成“妈妈在看着你”，不让孩子因家长做志愿者而觉得自己特殊；也不鼓励孩子为了找妈妈离开班级队伍或跑出安全范围。'
QUESTIONS = ['安安当值日生做了哪几件事？', '安安在窗边看到妈妈站岗，为什么没有跑下楼？']
ACTIVITY = '和孩子一起做一张“家庭岗位表”，每人认领一件小事（摆碗筷、浇花、收快递），一周后互相说一句“谢谢你在自己的岗位上”。'
PAGES = '''
星期三的早晨，幼儿园门口的宣传栏上多了一张新的排班表，上面写着“家长志愿者护学岗”。安安一眼就看见了妈妈的名字。|On Wednesday morning a new roster appeared on the notice board by the kindergarten gate: “Parent Volunteer Gate Duty.” An'an spotted Mom's name right away.|Wide sunny gate view: wooden notice board with a plain colored grid of blank slots (no letters), Mom in coral cardigan pointing at it, An'an in teal hoodie and orange backpack on tiptoe.
“今天下午四点，妈妈要在门口当志愿者，穿黄马甲，帮大家慢慢走、看好路口。”妈妈蹲下来，把折好的黄马甲给她看。|“This afternoon at four, I'll volunteer at the gate in a yellow vest, helping everyone walk slowly and watching the crossing,” Mom said, kneeling to show An'an the folded vest in her tote bag.|Eye-level two-shot on clean gate steps: Mom kneels holding a plain folded yellow vest; An'an looks at it with curious bright eyes.
安安问：“站岗是不是就像我当值日生？”妈妈笑了：“有点像，都是在自己的位置上，帮大家做点小事。”|An'an asked, “Is gate duty like being the class helper?” Mom smiled. “A little. Both mean helping everyone from your own spot.”|Warm close two-shot: An'an tilting her head with a thinking smile; Mom answering with a gentle nod, morning light behind them.
走进大班教室，林老师正在更新值日表：“今天是周三，轮到安安值日啦。”印着金色小星的红袖标套上了安安的左胳膊。|Inside the senior classroom, Teacher Lin was updating the duty chart: “It's Wednesday, so An'an is our helper today.” A red armband with a gold star went onto An'an's left sleeve.|Classroom morning view: Teacher Lin fastens red star armband onto An'an's teal hoodie sleeve; Tiantian watches happily from a low wooden shelf.
第一件事是整理阅读角。安安把绘本按大小一本一本排好，把翘起来的书角轻轻压平。|The first job was the reading corner. An'an lined the picture books up by size and gently smoothed the curled corners.|Reading corner view: An'an kneeling at a low wooden shelf, arranging blank-cover picture books by height, small hands pressing a curled corner flat.
她发现一本书里夹着一张折成小方块的画，就把它交给林老师：“这不是书里的，可能是谁掉的。”|She found a small folded drawing tucked inside one book and brought it to Teacher Lin. “This isn't part of the book. Someone may have lost it.”|Close view: An'an holds a small folded paper with simple abstract shapes beside an open picture book; Teacher Lin reaches to take it.
第二件事是叠午睡用的小毛巾。毛巾筐放在高架子上，安安踮起脚，还是够不到。|The second job was folding the small nap towels. The basket sat high on a shelf, and even on tiptoe An'an could not reach it.|Medium shot: An'an stretching on tiptoe with heels on the floor, fingertips short of a wicker basket on a high shelf; no stool nearby.
她没有搬凳子往上爬，而是去请林老师帮忙：“老师，这个太高了，我够不着。”老师把毛巾筐取了下来。|She did not drag a stool over to climb. Instead she asked Teacher Lin, “It's too high for me — could you help?” The teacher lifted the basket down.|Two-person view: An'an speaking to Teacher Lin with an open honest face; Teacher Lin reaching up to lift the wicker basket down safely.
安安把毛巾一条一条叠成小方块，边角对整齐，再轻轻放进筐里。|An'an folded the towels one by one into neat squares, matching the corners, and set them gently in the basket.|Tabletop close-up: small hands folding a soft towel into a tidy square, a neat stack already finished beside a wicker basket.
天天凑过来小声问：“安安，你妈妈下午真的会来站岗吗？”安安点点头，心里也开始盼着四点。|Tiantian leaned in and whispered, “An'an, is your mom really coming for gate duty this afternoon?” An'an nodded, already looking forward to four o'clock.|Two children at the folding table: Tiantian in sky-blue sweatshirt whispering; An'an nodding with a hopeful smile, towel stack between them.
下午户外活动结束，安安在二楼走廊的窗边往下看。大门口的路边，一个穿黄马甲的身影正站在那里。|When outdoor play ended, An'an looked down from the second-floor corridor window. By the road at the gate stood a figure in a yellow vest.|Interior corridor window view looking down onto the sunny gate road: a small figure in a plain yellow vest standing at the crossing; An'an's hands on the sill.
是妈妈。妈妈举起手，示意过往的车慢一点，又弯下腰，牵着一个小朋友走过通道。|It was Mom. She raised a hand to signal the passing cars to slow down, then bent low to lead a small child across the walkway.|Gate-level medium shot: Mom in plain yellow vest over coral cardigan raising one hand to traffic, other hand holding a younger child's hand on a plain crosswalk.
安安刚想跑下楼，又停住了。她想起自己还在值日，玩具筐还没有收完。|An'an was about to run downstairs, then stopped. She remembered she was still on duty, and the toy baskets were not put away yet.|Corridor shot: An'an mid-step with one hand on the stair railing, glancing back toward her classroom door, caught between two choices.
她跑去问林老师：“我可以到窗边跟妈妈挥挥手吗？”老师说：“可以，就站在窗边，不离开队伍。”|She ran to ask Teacher Lin, “May I wave to Mom from the window?” The teacher said, “Yes — stand right at the window, and stay with our group.”|Two-person corridor view: An'an asking with a small hopeful gesture; Teacher Lin nodding and pointing to the corridor window, children waiting in line behind.
安安把小手贴在玻璃上，用力挥了挥。妈妈抬起头，也回了一个小小的挥手，然后继续看着路口。|An'an pressed her hand to the glass and waved hard. Mom looked up, waved back just once, then turned her eyes to the crossing again.|Framed window view from inside: An'an's palm flat on the glass, waving; outside and below, Mom glances up with a brief smile and raised hand.
妈妈没有走上来抱她。安安的鼻子有点酸，可看到妈妈身后的队伍排得整整齐齐，她又觉得心里暖暖的。|Mom did not come upstairs to hug her. An'an's nose tingled a little, but seeing the tidy line of children behind Mom, her heart felt warm again.|Close portrait of An'an at the window with slightly wistful eyes; beyond the glass, a neat queue of children and Mom small at the crossing.
收好最后一只玩具筐，安安把红袖标交回老师手里。林老师在她手心贴了一颗金色小星星：“今天的值日生，站好了自己的岗。”|With the last toy basket stored away, An'an returned the red armband. Teacher Lin pressed a small gold star into her palm: “Today's helper stood her post well.”|Classroom late-afternoon view: Teacher Lin placing a gold foil star in An'an's open palm; red armband resting neatly on the desk, tidy shelves behind.
放学时，安安排队走到门口。妈妈还站在岗位上，等最后一个小朋友被接走，才脱下黄马甲，蹲下来抱住她：“今天，我们都在自己的位置上帮了忙。”|At dismissal, An'an's line reached the gate. Mom stayed at her post until the last child was picked up, then took off the yellow vest and knelt to hug her: “Today we both helped from where we stood.”|Warm golden closing shot at the gate: Mom kneeling with open arms and folded yellow vest over her arm; An'an running into the hug, orange backpack bouncing, last children leaving hand in hand.
'''


def rows():
    pages = [tuple(part.strip() for part in row.split('|')) for row in PAGES.strip().splitlines() if row.strip()]
    assert all(len(page) == 3 and all(page) for page in pages), TITLE
    return pages


def main():
    target = ROOT / 'content-drafts/richang'
    batch = target / 'batch-51-51'
    book_file = target / f'{SLUG}.json'
    if book_file.exists() or batch.exists():
        raise SystemExit('Book 51 already exists; edit the reviewed JSON draft instead of overwriting production work.')
    pages = rows()
    assert len(pages) == 18, f'{TITLE} has {len(pages)} pages, expected 18'
    assert len({p[0] for p in pages}) == 18, f'{TITLE} has duplicate page texts'

    kit = json.loads((target / 'lan-ping-guo.json').read_text())['imagePromptKit'].copy()
    kit['characterConsistency'] += (' Teacher Lin: hair in neat low bun, sage-green cardigan, dark grey trousers. '
                                    'Tiantian: same-age Chinese boy, sky-blue sweatshirt, navy trousers. '
                                    'Mom\'s volunteer vest: plain fluorescent yellow safety vest with reflective strips, '
                                    'no letters, logos or badges, worn over her coral cardigan, only at the kindergarten gate crossing. '
                                    'Only page-specific cast appears.')

    order = 51
    book = dict(
        id=SLUG, seriesId='richang', title=TITLE, subtitle=SUBTITLE,
        moral=dict(zh=MORAL, en=MORAL_EN), ageLabel='4–8 岁', publishedAt='2026-10-27', order=order,
        comingSoon=True,
        pages=[dict(page=i, zhText=zh, enText=en, illustrationPrompt=scene, imageStatus='pending') for i, (zh, en, scene) in enumerate(pages, 1)],
        metadata=dict(
            category='family-growth', ageRange=dict(min=4, max=8), estimatedMinutes=6,
            languages=['zh', 'en'], seriesId='richang', seriesOrder=order, personalizationEnabled=False,
            tags=['日常系列', '生活智慧', '亲子共读', '幼小衔接', '大班生活', *TAGS], featured=False, bedtimeSuitable=True,
        ),
        parentGuide=dict(
            goal=GOAL, reminder=REMINDER, questions=QUESTIONS, activity=ACTIVITY,
            ageTips=dict(
                age4to5='允许孩子用指图、点头、手势等非语言方式表达；共读以倾听、感受安抚为主，不强求马上做到。',
                age6to8='讨论大班一日生活中的真实感受与解决策略，鼓励孩子自己提出小行动，家长承担托底支持与陪伴责任。',
            ),
        ),
    )
    book_file.write_text(json.dumps(dict(book=book, imagePromptKit=kit), ensure_ascii=False, indent=2) + '\n')

    batch.mkdir()
    plan = dict(approved=True, approvedAt='2026-10-27', totalPages=18,
                books=[dict(id=SLUG, title=TITLE, pages=18, order=order)])
    (batch / 'plan.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2) + '\n')

    manuscript = ['# 日常系列第 51 本逐页文稿与分镜（周三值日生与家长志愿者）\n',
                  f'用户于 2026-10-27 确认：周三安安当值日生，妈妈来园做志愿者站岗；结尾为妈妈在岗、安安在园内远远打招呼。\n',
                  f'## {TITLE}\n', f'副标题：{SUBTITLE}\n', f'寓意：{MORAL}\n',
                  f'亲子目标：{GOAL}\n', f'家长提醒：{REMINDER}\n']
    for i, (zh, en, scene) in enumerate(pages, 1):
        manuscript.append(f'### 第 {i} 页\n\n{zh}\n\n{en}\n\n分镜：{scene}\n')
    manuscript.append('共读问题：\n' + '\n'.join(f'- {question}' for question in QUESTIONS) + f'\n\n小活动：{ACTIVITY}\n')
    (batch / 'manuscript.md').write_text('\n'.join(manuscript))

    characters = {
        "An'an": "An'an is a six-year-old Chinese GIRL, round face, ear-length straight black bob, yellow star hair clip on her left, plain teal zip-front hoodie, blue jeans, white sneakers with red trim. Preserve her female identity.",
        'Mom': 'Mom is an adult Chinese woman, shoulder-length black hair, coral cardigan and cream trousers.',
        'Teacher Lin': 'Teacher Lin is an adult Chinese woman, hair in a neat low bun, sage-green cardigan and dark grey trousers.',
        'Tiantian': 'Tiantian is a six-year-old Chinese boy, short black hair, sky-blue sweatshirt, navy trousers.',
    }
    jobs = []
    for page, (_, _, scene) in enumerate(pages, 1):
        cast = [description for name, description in characters.items() if name in scene]
        prompt = '\n'.join([
            kit['globalStyle'],
            'Asset type: one individual full-bleed square picture-book illustration, one coherent scene, never a multi-panel sheet.',
            *cast,
            'Draw ONLY the people named in this page scene. Keep identities, faces, hair and clothing consistent. No additional family members or bystanders. Kindergarten Big Class classroom and gate area, wooden furniture, low shelves, green plants, bright friendly atmosphere.',
            "THIS PAGE'S SCENE: " + scene,
            'Follow current object state literally. Do not anticipate later events. All notice boards, books and signs stay blank with simple shapes, never readable text. Match the requested camera view, natural hands and subtle readable feelings. Distressed, wistful or disappointed children must not smile broadly.',
            'Avoid: ' + kit['negative'],
        ])
        jobs.append(dict(id=SLUG, page=page, prompt=prompt))
    (batch / 'image-prompts.json').write_text(json.dumps(jobs, ensure_ascii=False, indent=2) + '\n')

    progress = dict(manuscripts='complete', totalPages=18, imagesComplete=0, narration='pending',
                    books=[dict(id=SLUG, title=TITLE, pages=18, order=order, completeImages=0, narration='pending', locallyReadable=False)],
                    uploaded=False, deployed=False, status='manuscripts-ready', createdOn='2026-10-27')
    (batch / 'progress.json').write_text(json.dumps(progress, ensure_ascii=False, indent=2) + '\n')
    print(f'Built {TITLE} with 18 bilingual pages.')


if __name__ == '__main__':
    main()
