"""Create the bilingual production draft for Everyday book 55."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SLUG = 'xiao-ma-yi-yun-qiu'
TITLE = '小蚂蚁运球'
SUBTITLE = '安安的大班亲子运动会'
MORAL = '两个人做着不同的事，也能商量出一个一起往前走的节奏。'
MORAL_EN = 'Partners can have different jobs and still find a way to move together.'
GOAL = '让孩子说出安安和妈妈各自的任务，并发现两个人怎样用球落地的声音配合。'
REMINDER = '读到球出圈时，停下来等孩子说说安安可能在想什么。再看她和妈妈回到起点后各自做了什么。'
QUESTIONS = [
    '球落到圈外以后，安安和妈妈回到了哪里？',
    '第二次出发时，安安听见了什么，就知道可以迈一小步？',
]
ACTIVITY = '一人轻敲桌面一下，另一人用手指往前走一步。一个人变快或变慢，两人一起找回舒服的节奏，再交换角色。'
PAGES = '''
今天是大班亲子运动会。彩旗在操场上轻轻晃，妈妈抱着一颗篮球。安安牵住妈妈的手，拉着她往红跑道那边跑。|It was sports day at An’an’s kindergarten, and families were joining in. Little flags fluttered over the playground. Mom had a basketball under one arm. An’an took her hand and ran toward the red track.|Opening and cover. An’an leads Mom by the hand toward the red running track. Mom carries the orange basketball under her free arm. A blue hula hoop rests on the track in the background. Pennants and cream school building, warm morning wide view.
跑道上躺着一个蓝色呼啦圈。安安蹲下去看看圈，又抬头看看妈妈怀里的球。“妈妈，这两个要一起玩呀？”|A blue hula hoop lay on the track. An’an crouched to look at it, then looked up at the ball in Mom’s arms. “Mom, do we play with both of these?”|Low, intimate view of An’an crouching beside one blue hoop lying flat. Mom stands to the side holding one orange basketball. The girl looks from the hoop up at Mom and the ball.
张老师指指地上的圈。“小朋友在前面拉圈，家长跟在后面拍球。球每一下都要落在圈里。这个游戏叫‘小蚂蚁运球’。”|Teacher Zhang pointed at the hoop on the ground. “Kids pull the hoop from the front. Grown-ups follow behind and bounce the ball. Every bounce has to land inside the hoop. We call it the Little Ants’ Ball Race.”|Teacher Zhang points at the opening of the blue hoop on the red track. An’an watches the pointing hand and Mom holds the ball. The teacher has a high ponytail, yellow top and a whistle on a navy lanyard.
乐乐和爸爸先试给大家看。乐乐拉着圈往前走，球在圈里“咚”地响了一声。张老师说，球要是跳出圈，就得回起点重新拍。最先到终点的一组获胜。|Lele and his dad showed everyone how to play. Lele pulled the hoop forward. Thump! The ball bounced inside it. Teacher Zhang explained that if the ball bounced out, the pair had to go back to the start and try again. The first pair to reach the finish won.|Clear side view of demo pair. Lele in mustard pulls the front of a red floor hoop. Behind him his dad in a slate jacket bounces an orange ball onto the track inside the hoop. Both pairs of shoes are outside the hoop.
哨声一响，安安拉起呼啦圈，妈妈在后面跟着拍球。咚，咚！两下都落在蓝圈里。安安咧开嘴笑了。|At the whistle, An’an took hold of the hoop. Mom followed behind, bouncing the ball. Thump, thump! Both bounces landed inside the blue hoop. An’an grinned.|Slightly elevated side view. An’an leads, holding only the leading edge of the blue hoop low behind her. Mom follows outside the rear rim and bounces the sole orange ball onto the track in the center of the hoop.
旁边一组赶了上来，鞋底踩得啪嗒啪嗒。安安也迈了一个大步。蓝圈一下往前滑，妈妈的球刚从地上弹起来。|A pair in the next lane was catching up. Their shoes went patter, patter! An’an took a big step, too. The blue hoop slid forward just as Mom’s ball bounced up.|Slightly overhead diagonal view. An’an takes a conspicuously longer stride, drawing the low blue hoop forward. Mom is behind with hand hovering above the rising ball near the hoop’s trailing edge. Softly blurred shoes in the adjacent lane.
咚！这一下，球落在圈外，滚到妈妈鞋边。安安手里还攥着圈，朝终点那头望了一眼。|Thump! This time the ball landed outside the hoop and rolled toward Mom’s shoe. Still holding the hoop, An’an looked down the track toward the finish.|Low, downward-angled reveal showing the whole blue loop and a clear strip of red track between its trailing rim and the orange ball beside Mom’s shoe. An’an holds the front rim low and looks down the lane.
妈妈捡起球。“得从起点再来一次。”安安拖着圈往回走。刚才才离开的那道白线，又到了她脚边。|Mom picked up the ball. “We have to go back to the start and try again.” An’an pulled the hoop back with her. Soon the white line she had just left was right by her shoes again.|From behind at a wide angle, An’an pulls the hoop back toward the distinct white starting stripe. Mom walks with her and carries the basketball in both hands. Their return goes in the opposite direction down the same lane.
站回白线后面，安安回过头。“妈妈，你拍一下，我走一小步，好不好？”妈妈点点头。“好，我也走小一点。”|Back behind the starting line, An’an turned to Mom. “How about this? You bounce the ball, and I take one little step.” Mom nodded. “I’ll take little steps, too.”|Child-height two-shot at the start line. An’an on one end of the hoop turns to Mom on the other end. Mom crouches slightly to listen, holding the basketball, with a small smile.
妈妈把球往下一拍。咚。球落在蓝圈正中间。安安听见了，迈出一小步。妈妈也跟了一小步。|Mom bounced the ball. Thump. It landed right in the middle of the blue hoop. An’an heard it and took one little step. So did Mom.|Close view of the blue hoop and four visible shoes outside its opening. The single basketball meets the track dead center within the ring. An’an takes a short step in front while Mom follows from behind.
咚，走一步。咚，再走一步。安安看着前面的路，听着身后的球声。红边小鞋一步一步往前走。|Thump. One step. Thump. Another step. An’an watched the track in front of her and listened to the ball behind her. Her red-trimmed sneakers stepped steadily forward.|Low three-quarter view from slightly ahead and to the side. An’an’s focused face and red-trimmed shoes lead the composition. One hand pulls the front of the low loop behind her. Mom is visible behind the hoop, dribbling the ball inside it.
妈妈的步子也小了。球一下一下落在蓝圈里。安安听得见球声，也听得见妈妈的鞋底轻轻擦过跑道。终点那道白线越来越近了。|Mom took smaller steps now. The ball kept bouncing inside the blue hoop. An’an could hear each bounce and the soft scuff of Mom’s shoes. The white finish line was getting closer.|View from behind and to the side of Mom, who steps lightly and reaches toward the orange ball inside the hoop. An’an is clearly ahead leading toward a single white finish stripe a little farther along the track.
白线就在脚尖前，安安顿了顿。又一声“咚”从身后传来。她把蓝圈拉过白线，妈妈跟着拍球，两个人一起到了终点。|The line was right in front of An’an’s toes. She paused for another thump. Then she pulled the blue hoop over the line. Mom kept bouncing the ball as they reached the finish together.|Wide side view at the finish. An’an crosses the white stripe first, pulling the blue hoop. The ball is still within the hoop as it crosses. Mom follows closely behind with her dribbling hand above the ball.
妈妈把球抱住。安安轻轻放下圈，回过头笑了。“妈妈，最后那一下，我也听见了！”妈妈伸出空着的手，安安也举起手。啪！|Mom caught the ball. An’an set down the hoop and turned around, smiling. “Mom, I heard that last bounce, too!” Mom held up her free hand. An’an raised hers for a high five. Smack!|Warm ending at the finish beyond the white stripe. Mom cradles the basketball with one arm. An’an gives her a high five with one hand. The blue hoop is flat on the track beside them.
'''


def main():
    target = ROOT / 'content-drafts/richang'
    batch = target / 'batch-55-55'
    draft = target / f'{SLUG}.json'
    if draft.exists() or batch.exists():
        raise SystemExit('Book 55 already exists; edit the production draft directly.')
    pages = [tuple(part.strip() for part in row.split('|')) for row in PAGES.strip().splitlines()]
    assert len(pages) == len({row[0] for row in pages}) == 14
    assert all(len(row) == 3 and all(row) for row in pages)

    order, date = 55, '2026-11-22'
    entry = dict(id=SLUG, title=TITLE, pages=len(pages), order=order)
    kit = json.loads((target / 'lan-ping-guo.json').read_text())['imagePromptKit'].copy()
    kit['characterConsistency'] += (
        ' Teacher Zhang has a high black ponytail, goose-yellow knit sports top, khaki trousers and a small whistle.'
        ' At sports day Mom wears lace-up sneakers. An’an leaves her backpack off the track.'
        ' Their lane has one blue hula hoop and one orange basketball. The child tows the leading edge low,'
        ' the parent dribbles into the opening from behind, and both stand outside the hoop.'
    )
    book = dict(
        id=SLUG, seriesId='richang', title=TITLE, subtitle=SUBTITLE,
        moral=dict(zh=MORAL, en=MORAL_EN), ageLabel='4–8 岁', publishedAt=date,
        order=order, comingSoon=True,
        pages=[dict(page=i, zhText=zh, enText=en, illustrationPrompt=scene, imageStatus='pending')
               for i, (zh, en, scene) in enumerate(pages, 1)],
        metadata=dict(
            category='family-growth', ageRange=dict(min=4, max=8), estimatedMinutes=5,
            languages=['zh', 'en'], seriesId='richang', seriesOrder=order, personalizationEnabled=False,
            tags=['日常系列', '亲子共读', '大班生活', '亲子运动会', '呼啦圈', '篮球', '亲子合作'],
            featured=False, bedtimeSuitable=True,
        ),
        parentGuide=dict(
            goal=GOAL, reminder=REMINDER, questions=QUESTIONS, activity=ACTIVITY,
            ageTips=dict(age4to5='请孩子指一指谁拉圈、谁拍球，再用一个敲击声配一个小动作。',
                         age6to8='请孩子讲讲第二趟两个人各自做了什么，再想出一个自己愿意试的配合信号。'),
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
