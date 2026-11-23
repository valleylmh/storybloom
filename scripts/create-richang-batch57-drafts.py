"""Create the bilingual production draft for Everyday book 57."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SLUG = 'mao-mao-chong-xiang-qian-chong'
TITLE = '毛毛虫向前冲'
SUBTITLE = '安安的大班亲子运动会'
GOAL = '让孩子按顺序讲出谁先出发、在哪里接力，体会自己也能为出发的大人加油。'
REMINDER = '读到“脚往前，屁股跟上”时，让孩子用手指指一指图里的动作。读到换棒时，一起找找安安和妈妈各在哪一头。'
QUESTIONS = [
    '安安先往哪一头挪？她到了以后，谁接着出发？',
    '读到最后，安安和妈妈各在哪一头？她们是怎么换过来的？',
]
ACTIVITY = '在桌上放两张小纸片当作气垫的两端。孩子用两个并拢的手指一点点走过去，家长从另一端走回来。交接时轮流说“到你啦”。'
PAGES = '''
大班亲子运动会上，红跑道上铺着一条长长的蓝气垫。安安在这头坐下，脚边放着一只黄布袋。妈妈在那头朝她挥手。|At kindergarten sports day, a long blue mat lay on the red track. An’an sat at one end with a yellow sack by her feet. Mom waved from the other end.|Wide opening. An’an sits at the green-cone end of one long blue inflatable mat, her loose yellow sack beside her feet. Mom waves from the opposite end at the orange cone, her lilac sack waiting at her feet.
“妈妈，等我过来！”安安双手拢在嘴边。张老师举起计时器。“小朋友先到对面，家长再接力挪回来。两人合起来用时最短的一队赢。”|“Mom, wait for me!” An’an called through her cupped hands. Teacher Zhang held up the stopwatch. “Kids go across first. Then your grown-ups scoot back. The team with the shortest time for both turns wins.”|At the green-cone start, An’an calls to Mom down the lane. Teacher Zhang stands to the side holding up one orange stopwatch. The empty yellow sack lies near An’an’s feet.
安安把两只脚都套进同一个黄布袋，坐稳了。“靠脚和屁股往前挪，两只手不能撑气垫。”张老师说。安安把手抬了起来。|An’an slipped both feet into the same yellow sack and sat steady. “Scoot with your feet and your bottom. Keep your hands off the mat,” said Teacher Zhang. An’an lifted her hands.|At the start, a closer view shows An’an seated with knees bent, both feet fully inside one short yellow foot sack and both hands hovering at her sides.
哨声一响，张老师按下计时器。安安把袋里的脚往前挪一点，屁股再跟上一点。她的两只手一直悬在身侧。|The whistle blew, and Teacher Zhang started the timer. An’an moved her feet forward a little inside the sack, then scooted her bottom after them. Both hands stayed up beside her.|Low side view of An’an beginning her first leg, hips on the mat, knees bent, feet together in the yellow sack. Her open hands hover clearly above the mat. The green cone is behind her.
安安使了好大的劲，才挪出去一小截。黄布袋在脚尖前皱成一团。她抿抿嘴，又把脚往前送了一点。|An’an tried her hardest and moved just a little. The yellow sack bunched up in front of her toes. She pressed her lips together and edged her feet forward again.|Mat-level close shot from in front and to the side. The wrinkled yellow cloth over both feet is in focus. An’an looks down, lips pressed, both hands suspended and hips seated.
脚往前，屁股跟上。脚再往前，屁股再跟上。安安抬起头，已经能看清妈妈笑弯的眼睛了。|Feet forward, bottom follows. Feet forward, bottom follows. An’an looked up. Now she was close enough to see Mom’s eyes crinkle when she smiled.|Three-quarter view from the relay end. An’an scoots toward Mom, who waits beside the orange cone. Their expressions are visible. An’an’s empty hands stay above the mat.
妈妈就在眼前，白线还差一点点。安安鼓着腮帮子，袋里的两只脚又往前蹭了一小下。|Mom was right there. The white line was still a little way off. An’an puffed out her cheeks and inched both feet forward inside the sack.|Low view near the relay stripe. An’an scoots toward it with a determined face. Leave a clear strip of blue between the yellow sack and the white stripe.
黄布袋碰到白线了。安安再挪一下，屁股也过了线。她仰起脸喊“到你啦，妈妈！”|The yellow sack touched the white line. With one more scoot, An’an got her bottom over it, too. She looked up and called, “Your turn, Mom!”|At the orange-cone relay end. An’an has crossed the white stripe, seated on the mat beyond it, hands raised in excitement. Mom crouches beside the mat, still waiting, her empty lilac sack nearby.
妈妈朝安安出发的那头坐好，把两只脚套进紫布袋。安安抽出自己的脚，退到气垫边上，给妈妈让出位置。|Mom sat facing An’an’s starting end and slipped both feet into the purple sack. An’an slid her feet out of her own sack and moved to the side of the mat to make room.|Reverse angle at the orange-cone end. Mom sits facing back down the mat with both feet in the lilac sack. An’an has moved off the mat and her red-trim shoes are outside the empty yellow sack.
妈妈的脚往前挪，屁股跟上，两只手一直悬着。安安以为妈妈一下能挪出老远。低头一看，妈妈也只挪出去一小截。|Mom moved her feet forward and scooted her bottom after them, keeping both hands up. An’an thought Mom might go a long way in one scoot. She looked down. Mom had moved just a little, too.|Clear side view of Mom’s first scoot on the way back. Both feet are together in the low lilac sack, knees bent, hips seated, both hands visibly in the air. An’an watches from behind at the orange-cone end.
妈妈挪远了一点。安安站在气垫边上，拢起两只手喊“妈妈，加油！”|Mom scooted a little farther. An’an stood beside the mat, cupped her hands, and called, “Go, Mom!”|Child-height medium close-up of An’an standing off the mat at the orange cone, cupping her hands and calling. The empty yellow sack lies near her shoes. She looks back along the mat.
妈妈回头笑了笑，还朝安安挥了一下手。脚挪一点，屁股跟上一点。紫布袋蹭过气垫，发出轻轻的沙沙声。|Mom looked back with a smile and waved to An’an. Feet forward a little, bottom follows. The purple sack made a soft shuffling sound against the mat.|Midway back, Mom looks over one shoulder and gives a small wave with one hand. Her other hand also hovers. She stays seated, with both feet in the lilac sack ahead of her hips.
妈妈挪过了气垫那头的白线。张老师在旁边按停计时器。“两棒都到啦！”|Mom scooted over the white line at the other end. Teacher Zhang stopped the watch beside her. “Both turns are done!”|At the green-cone finish, Mom’s seated hips and her lilac sack are both past the white stripe. Teacher Zhang stands to the side, finger visibly on the orange stopwatch button.
“妈妈，我看见你到啦！”安安在这头踮起脚。隔着长长的气垫，妈妈一下就听见了。|“Mom, I saw you finish!” An’an called from her end, rising onto her toes. Mom heard her across the long blue mat.|View from slightly behind An’an at the orange-cone end. She rises onto her toes on the track beside the mat. Mom is seated far away at the green-cone end, looking back toward An’an.
妈妈还坐在那头，转过脸朝安安挥手。“我也听见你给我加油啦！”|Still sitting at the far end, Mom turned to wave at An’an. “I heard you cheering for me, too!”|Warm close three-quarter portrait at the green cone. Mom stays seated on the mat beyond the stripe, her lilac sack around both feet, one hand waving and the other on her own knee.
安安也挥起手。蓝气垫还是那么长。刚才妈妈等在这头，现在，她在对面啦！|An’an waved back. The blue mat was still just as long. A moment ago, Mom had been waiting at this end. Now there she was, all the way across!|Echo the wide opening from the same side of the mat. Mom is now seated at the near green-cone end and waves. At the far orange cone, An’an stands beside her empty yellow sack and waves back.
'''


def main():
    target = ROOT / 'content-drafts/richang'
    batch = target / 'batch-57-57'
    draft = target / f'{SLUG}.json'
    if draft.exists() or batch.exists():
        raise SystemExit('Book 57 already exists; edit the production draft directly.')
    pages = [tuple(part.strip() for part in row.split('|')) for row in PAGES.strip().splitlines()]
    assert len(pages) == len({row[0] for row in pages}) == 16
    assert all(len(row) == 3 and all(row) for row in pages)

    order, date = 57, '2026-11-22'
    entry = dict(id=SLUG, title=TITLE, pages=len(pages), order=order)
    kit = json.loads((target / 'lan-ping-guo.json').read_text())['imagePromptKit'].copy()
    kit['characterConsistency'] += (
        ' Mom wears a coral cardigan, cream trousers and lace-up sneakers.'
        ' A single pale-blue inflatable mat runs along the red school track.'
        ' The green cone marks the child start and final finish. The orange cone marks the relay end.'
        ' An’an scoots out in a yellow foot sack, and Mom scoots back in a lilac foot sack.'
        ' Each bag encloses both feet together and leaves knees and hips visible.'
        ' Their hips stay on the mat and their hands remain off it while moving.'
    )
    book = dict(
        id=SLUG, seriesId='richang', title=TITLE, subtitle=SUBTITLE, ageLabel='4–8 岁',
        moral=dict(zh='你挪过去，我挪回来。接力时，等在另一头的人也在为你加油。',
                   en='You scoot there, I scoot back. The person waiting at the other end can cheer you on.'),
        publishedAt=date, order=order, comingSoon=True,
        pages=[dict(page=i, zhText=zh, enText=en, illustrationPrompt=scene, imageStatus='pending')
               for i, (zh, en, scene) in enumerate(pages, 1)],
        metadata=dict(
            category='family-growth', ageRange=dict(min=4, max=8), estimatedMinutes=5,
            languages=['zh', 'en'], seriesId='richang', seriesOrder=order, personalizationEnabled=False,
            tags=['日常系列', '亲子共读', '大班生活', '亲子运动会', '气垫', '接力', '亲子合作'],
            featured=False, bedtimeSuitable=True,
        ),
        parentGuide=dict(
            goal=GOAL, reminder=REMINDER, questions=QUESTIONS, activity=ACTIVITY,
            ageTips=dict(age4to5='请孩子在首尾两页找一找安安和妈妈，说说谁在哪一头。',
                         age6to8='请孩子指着两端复述接力规则，再说说为什么张老师要等妈妈到线才停止计时。'),
        ),
    )
    batch.mkdir()
    for file, value in [
        (draft, dict(book=book, imagePromptKit=kit)),
        (batch / 'plan.json', dict(approved=True, approvedAt=date, totalPages=len(pages), books=[entry])),
        (batch / 'progress.json', dict(manuscripts='complete', totalPages=len(pages), imagesComplete=0,
             narration='pending', books=[dict(**entry, completeImages=0, narration='pending', locallyReadable=False)],
             uploaded=False, deployed=False, status='manuscripts-ready', createdOn=date)),
    ]:
        file.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

    manuscript = [
        f'# {TITLE}', f'日常系列第 {order} 本 · {SUBTITLE}',
        '## 亲子目标', GOAL, '## 家长提醒', REMINDER,
    ]
    for i, (zh, en, scene) in enumerate(pages, 1):
        manuscript.extend([f'### 第 {i} 页', zh, en, f'**分镜**\n\n{scene}'])
    manuscript.extend(['## 共读问题', '\n'.join(f'- {item}' for item in QUESTIONS), '## 小活动', ACTIVITY])
    (batch / 'manuscript.md').write_text('\n\n'.join(manuscript) + '\n')
    print(f'Built {TITLE} with {len(pages)} bilingual pages.')


if __name__ == '__main__':
    main()
