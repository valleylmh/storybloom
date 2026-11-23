"""Create the bilingual production draft for Everyday book 56."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SLUG = 'xiao-xiong-yun-nan-gua'
TITLE = '小熊运南瓜'
SUBTITLE = '安安的大班亲子运动会'
GOAL = '让孩子顺着取球、运球、放球的顺序复述一次往返，体会运到一颗球就数一次的对应关系。'
REMINDER = '可以和孩子一起看安安怀里什么时候有球，再看看球什么时候进了黄筐。读到末页，可以跟着安安慢慢数。'
QUESTIONS = [
    '安安和爸爸从哪个筐拿球，又把球放进哪个筐？',
    '爸爸为什么说，数数黄筐里的球就知道跑了几趟？',
]
ACTIVITY = '在桌面两头各放一只碗，把几颗纸团放进其中一只。两人轮流用小托盘一次送一颗，每送到一颗就数一下。'
PAGES = '''
大班亲子运动会上，安安坐上一辆蓝色的四轮小车。爸爸指给她看。跑道那头的绿筐里装着一堆橙色的球，脚边的黄筐还空着。|At kindergarten sports day, An’an sat in a blue wagon with four wheels. Dad pointed down the track. A green basket at the far end held a pile of orange balls. The yellow basket by his feet was empty.|Opening and cover. An’an sits in the blue wagon at the return end with empty hands. Dad points toward the distant green basket full of orange balls. The empty yellow basket is nearby in the foreground.
“今天玩小熊运南瓜！”张老师说，“小朋友坐在车上，家长拉车。先去绿筐拿球，再运回来放进黄筐。”安安望着那堆球。原来今天的南瓜这么圆！|“Today’s game is the Little Bears’ Pumpkin Run!” said Teacher Zhang. “Kids ride in the wagon and grown-ups pull it. Take a ball from the green basket and bring it back to the yellow one.” An’an looked at the pile. Today’s pumpkins were round as could be!|Teacher Zhang explains the course beside Dad and An’an. The child stays seated with empty hands. The pale-yellow return basket is empty.
“时间一到，哪组运回来的球最多，哪组就赢。”张老师举起计时器，把哨子放到嘴边。安安把两只手扶在小车边上，等着那一声响。|“When time is up, the team that brought back the most balls wins.” Teacher Zhang raised her stopwatch and brought the whistle to her lips. An’an held the sides of the wagon and waited for the whistle.|Child-height portrait of Teacher Zhang on the grass by the running track about to blow her whistle, stopwatch in the other hand. She wears a yellow top and has a high ponytail.
哨声一响，爸爸拉着小车朝绿筐跑。安安扶着车沿。四个小轮子咕噜咕噜地转，她的膝盖上还空空的。|The whistle blew. Dad pulled the wagon toward the green basket. An’an held on to the sides. All four wheels went rumble, rumble. Her lap was still empty.|Elevated moving side view. Dad pulls the wagon from its front handle. An’an is seated inside with both hands on the rim and no ball. The green pickup basket is ahead.
小车在绿筐旁边停下。爸爸拿出一颗球，递到安安怀里。她用两条胳膊把它圈住，笑着说：“南瓜上车啦！”|The wagon stopped beside the green basket. Dad took out a ball and handed it to An’an. She wrapped both arms around it and grinned. “Pumpkin on board!”|At the green pickup basket, the wagon is stopped. Dad hands over one orange ball. An’an stays seated in the wagon and closes her arms around the ball.
爸爸掉了个头，拉着小车往回跑。安安低头看了看，球贴着她的衣服。她再抬起头，那个空空的黄筐一点点变大了。|Dad turned the wagon around and ran back. An’an looked down at the ball snug against her hoodie. When she looked up again, the empty yellow basket was getting bigger and bigger.|Wide view from the rear side of the moving wagon. Dad tows it toward the empty yellow basket. An’an holds one orange ball in her lap the whole way back.
小车停在黄筐旁边。安安把球递给爸爸，爸爸弯腰把它放进去。咕咚！黄筐里有了第一颗球。安安探过头看：“到啦！”|The wagon stopped beside the yellow basket. An’an passed the ball to Dad, and he bent down to put it inside. Thunk! The first ball was in the basket. An’an leaned over to look. “It made it!”|Close view of the first orange ball reaching the bottom of the previously empty yellow basket. Dad places it inside while An’an looks from her seat in the stopped wagon.
爸爸又把车头转向绿筐。安安把手放回车沿，回头看了一眼黄筐。那颗球还在筐底。“爸爸，再去接一颗！”|Dad turned the wagon back toward the green basket. An’an held on to the sides again and looked back. The ball was still at the bottom of the yellow basket. “Dad, let’s go get another!”|Wide high-angle view of the next outward trip. Dad pulls the wagon toward the green pickup end. The child’s hands are empty. One ball remains in the yellow basket behind them.
怀里空空地去，抱着球回来。安安已经认识这段路了。经过彩旗的影子，再过一道白线，黄筐就在眼前。|She went with an empty lap and came back holding a ball. An’an knew the way now. Past the shadows of the flags, over a white line, and there was the yellow basket!|Low wagon-height image with the yellow basket coming into view in the distance. An’an holds one ball, Dad leads the wagon by the tow bar, and flag shadows fall on the red track.
咕咚，又一颗。咕咚，又一颗。安安听见一声，就数一下。刚才还看得见的筐底，已经被圆滚滚的球盖住了。|Thunk, one more. Thunk, one more. An’an counted every time she heard a ball land. Round orange balls covered the bottom of the basket now.|Look into the pale-yellow return basket from above at a diagonal. A ball is just being put in over the balls already inside. Crop part of the opening to keep attention on the new ball.
又一趟回来，安安抱着球，看见张老师举起了哨子。离黄筐还有几步。她把球稳稳抱在膝盖上，等爸爸把车停下。|On the next trip back, An’an saw Teacher Zhang lift her whistle. The yellow basket was still a few steps away. She kept the ball steady in her lap and waited for Dad to stop the wagon.|Approaching the yellow basket with one orange ball in An’an’s lap. Dad pulls in front. In the middle distance Teacher Zhang raises her whistle to her lips.
车一停，安安就把球递过去。爸爸接住，弯腰放进筐里。咕咚！紧接着，哨声响了。“时间到！”张老师喊。|As soon as the wagon stopped, An’an handed the ball over. Dad caught it and put it in the basket. Thunk! Right after that came the whistle. “Time’s up!” called Teacher Zhang.|The wagon has stopped. The final ball falls from Dad’s hand into the yellow basket while An’an looks on from the wagon with empty hands. A partial view of the teacher with her whistle behind them.
小车停在黄筐边。爸爸两手扶着膝盖，呼呼喘气。安安仰起脸问：“爸爸，你跑了多少趟呀？”|The wagon stayed beside the yellow basket. Dad leaned on his knees, puffing for breath. An’an looked up at him. “Dad, how many trips did you make?”|Child-height side two-shot in the quiet after the race. Dad rests with hands on his knees beside the parked wagon. Still seated, An’an looks up at him. The return basket holds the delivered balls.
爸爸笑着指指筐里的球。“一颗就是一趟。一起数数！”安安伸出手指，先点着离自己最近的那颗。“一。”爸爸也跟着她数。|Dad smiled and pointed to the balls. “One ball for each trip. Let’s count!” An’an pointed to the one closest to her. “One.” Dad counted with her.|Closing intimate three-quarter view. Both smile and look down as An’an points from her wagon at the nearest ball. The yellow basket holds several visible balls with part of its interior out of view.
'''


def main():
    target = ROOT / 'content-drafts/richang'
    batch = target / 'batch-56-56'
    draft = target / f'{SLUG}.json'
    if draft.exists() or batch.exists():
        raise SystemExit('Book 56 already exists; edit the production draft directly.')
    pages = [tuple(part.strip() for part in row.split('|')) for row in PAGES.strip().splitlines()]
    assert len(pages) == len({row[0] for row in pages}) == 14
    assert all(len(row) == 3 and all(row) for row in pages)

    order, date = 56, '2026-11-22'
    entry = dict(id=SLUG, title=TITLE, pages=len(pages), order=order)
    kit = json.loads((target / 'lan-ping-guo.json').read_text())['imagePromptKit'].copy()
    kit['characterConsistency'] += (
        ' Dad has short black hair, a dark navy sweater, cream trousers and white lace-up sneakers.'
        ' An’an rides inside a low blue pull wagon with four black wheels.'
        ' Dad pulls from the front and handles pickup and delivery at the stops.'
        ' A green pickup basket and a pale-yellow return basket stand at opposite ends.'
        ' Each load is one smooth orange playground ball.'
    )
    book = dict(
        id=SLUG, seriesId='richang', title=TITLE, subtitle=SUBTITLE, ageLabel='4–8 岁',
        moral=dict(zh='运一颗，数一下。两个人来来回回送到的球，一点点装满了筐底。',
                   en='One ball, one count. Little by little, what two people carry together adds up.'),
        publishedAt=date, order=order, comingSoon=True,
        pages=[dict(page=i, zhText=zh, enText=en, illustrationPrompt=scene, imageStatus='pending')
               for i, (zh, en, scene) in enumerate(pages, 1)],
        metadata=dict(
            category='family-growth', ageRange=dict(min=4, max=8), estimatedMinutes=5,
            languages=['zh', 'en'], seriesId='richang', seriesOrder=order, personalizationEnabled=False,
            tags=['日常系列', '亲子共读', '大班生活', '亲子运动会', '四轮小推车', '亲子合作', '数数'],
            featured=False, bedtimeSuitable=True,
        ),
        parentGuide=dict(
            goal=GOAL, reminder=REMINDER, questions=QUESTIONS, activity=ACTIVITY,
            ageTips=dict(age4to5='请孩子用手指从绿筐走到黄筐，再一起数两三颗纸团。',
                         age6to8='请孩子说说，为什么运到的球数和完成的趟数一样，并自己试着边运边数。'),
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
