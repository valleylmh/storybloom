"""Create the bilingual production draft for Everyday book 54."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SLUG = 'an-an-man-man-shuo'
TITLE = '安安，慢慢说'
SUBTITLE = '在之江少年宫练习《八百标兵》'
MORAL = '说话可以有自己的节奏。分一小句，停一拍，听的人就跟得上了。'
MORAL_EN = 'You can speak at your own pace. Say one short phrase, pause for a beat, and give your listener time to follow.'
GOAL = '让孩子发现，兴奋时也可以用分句和短暂停顿，把想分享的事说清楚。'
REMINDER = '先听完孩子的话，再复述听清的部分。需要重听时，可以具体地问“你刚才说哪只鸟？”，等孩子自己接着说。'
QUESTIONS = ['安安第一次念绕口令时，发现哪几个字容易挤在一起？', '回家路上，安安在哪两句话之间停了一拍？']
ACTIVITY = '玩“拍一拍，再接一句”。孩子挑一句想说的话，在两个意思之间轻拍一下膝盖，然后接着说。家长说说自己听到了什么，再交换角色。'
STYLE = 'Square 1:1 text-free picture-book illustration, warm stylized 3D animation, soft natural daylight, rounded tactile materials, expressive child-scale framing. Keep each shown character consistent. No readable text or logos. THIS PAGE\'S SCENE: '
PAGES = '''
星期六，安安背着橙色小书包，和妈妈来到之江少年宫。今天，她要上第一节口才培训课。玻璃门一开，安安就看见大厅里挂着一串圆圆的彩纸。|On Saturday, An’an and Mom arrived at the Zhijiang Children’s Palace. An’an had her orange backpack on for her first speaking class. As the glass doors opened, she saw a string of colorful paper circles in the lobby.|An’an and Mom walk toward open glass doors of a contemporary children’s arts center, with colorful hanging paper circles visible in the airy lobby. Child wears one orange backpack. Wide establishing view from slightly behind.
“妈妈我看见一只小鸟它站在栏杆上我一走近它就飞了！”安安一口气说完。妈妈只听清了开头，蹲下来问：“小鸟刚才站在哪儿呀？”|“Mom I saw a bird it was on the railing and it flew away when I got close!” An’an said in one breath. Mom only caught the beginning. She crouched down and asked, “Where was the little bird standing?”|At the lobby window, Mom crouches to listen at An’an’s eye level. The girl gestures excitedly with open hands while wearing the orange backpack. Paper circles appear softly out of focus above. No bird appears.
“栏杆上！”安安指给妈妈看。刚好，教室门开了，徐老师探出头来：“来，给你的声音找个座位。”安安笑了。声音也要坐下来吗？|“On the railing!” An’an pointed it out to Mom. Just then, the classroom door opened. Teacher Xu peeked out. “Come in and find a seat for your voice!” An’an laughed. Did voices need seats, too?|Teacher Xu, an adult Chinese woman with a jaw-length dark bob tucked behind one ear, round dark glasses, indigo blouse, and cream trousers, holds open a mint classroom door and smiles at An’an. Girl is seen from behind with orange backpack. Oak floor, semicircle of pale wooden stools, oval yellow rug visible within.
安安把书包放到门边，和几个小朋友围着一块黄地毯坐下来。徐老师拍拍膝盖，问：“说话说得太急的时候，句子听起来会是什么样？”|An’an set her backpack by the door and sat with a few children around a yellow rug. Teacher Xu patted her knees. “What does a sentence sound like when it comes out in a rush?”|Wide classroom view. Teacher Xu sits on a low stool beside an oval yellow rug, patting her knees. An’an and two children sit in a semicircle on low stools. One orange backpack rests against the mint door, away from the children.
徐老师拿起一张画着两只小鼓的卡片：“今天我们练一个绕口令，叫《八百标兵》。”她先念了一小段：“八百标兵，奔北坡。”安安听见，中间有一点点空当。|Teacher Xu held up a card with two little drums on it. “Today’s tongue twister is called ‘Eight Hundred Soldiers.’” She began with one short line: “Eight hundred soldiers … hurry up the north slope.” An’an heard a tiny gap in the middle.|View over An’an’s shoulder as Teacher Xu holds up a small white card with two simple drum pictures and speaks gently. Yellow rug and low stools in the background. Nothing written on the card.
“八百标兵奔北坡！”轮到安安了。她一下子冲到句尾，“标兵”和“奔”挤在一起，听上去像玩具小火车撞了车。安安捂着嘴笑了。|“Eight hundred soldiers hurry up the north slope!” An’an raced to the end. The words bumped together like toy train cars. She covered her mouth and giggled.|Close child-level portrait of An’an giggling into one hand after racing through the line, one yellow star clip visible. Softly blurred teachers’ stool, yellow rug and warm classroom behind. No symbolic train or speech bubble.
徐老师从篮子里拿出两块蓝积木，摆在地毯上，中间留了一道缝。“这一块是‘八百标兵’，那一块是‘奔北坡’。说完第一小段，就在缝这儿停一拍。”|Teacher Xu set two blue blocks on the rug with a little gap between them. “This one is ‘eight hundred soldiers.’ That one is ‘hurry up the north slope.’ After the first part, pause for one beat right here in the gap.”|Near overhead close-up of exactly two plain blue wooden cube blocks with a clear finger-width gap on the oval yellow rug. Teacher Xu’s index finger points into the empty gap. No letters or diagrams.
安安指着第一块积木：“八百标兵。”她把手停在两块积木中间，轻轻吸了口气。“奔北坡。”这一次，几个字稳稳地落到了第二块积木上。|An’an pointed at the first block. “Eight hundred soldiers.” Her finger stopped between the blocks, and she took a small breath. “Hurry up the north slope.” This time, every word landed right where it belonged. |Side-on close-up of An’an kneeling at the yellow rug, one finger hovering in the gap between two blue cube blocks. Her face is visible in profile, lips relaxed as she takes a small breath. Classroom daylight.
“我听清啦，是北坡！”旁边的小朋友说。安安把手收回来，又念了一遍。这一回，手没有指积木，膝盖上倒多了一声轻轻的“嗒”。|“I heard it! The north slope!” said the child beside her. An’an tried the line again. This time she kept her hand off the blocks and gave her knee a soft tap instead.|An’an and a child beside her sit on low stools by the yellow rug. The other child has short black hair and a cream sweater with charcoal stripes and smiles in recognition. An’an gently taps one knee. The two blue cubes remain on the rug.
徐老师接着念：“炮兵并排，北边跑。”安安把“并排”说成了“北排”。她停下来，听徐老师又念了一次，再从“炮兵”接着往下说。|Teacher Xu went on: “The artillery crew runs side by side toward the north.” An’an mixed up two sounds in the words for “side by side.” She stopped to listen, then tried that part again from the beginning.|Medium two-shot in the classroom: Teacher Xu models a word gently at An’an’s level, and An’an listens with her hands resting on her knees. Unhurried expressions. The drum card rests face down beside Teacher Xu.
接下来，徐老师拍一下膝盖，安安就念一小句：“炮兵怕把标兵碰。”她停了一拍，再念：“标兵怕碰炮兵炮。”两个“怕”说得清清楚楚。|Teacher Xu tapped a knee, and An’an said one short line. “The artillery crew is afraid of bumping the soldiers.” An’an paused for a beat. “The soldiers are afraid of bumping the crew’s cannons.” Both lines came out clear. |Classroom side view. An’an speaks from her stool with a small confident smile while Teacher Xu taps a knee softly to mark the beat. The other children are listening, seated in the same semicircle. Show the speaking class only.
快下课了，徐老师问：“谁愿意把四句连起来念一遍？”安安举起手。她念完前两句，在心里数了一个“一”，才接着念后两句。念到最后，她还能听清自己的声音。|Near the end of class, Teacher Xu asked, “Who would like to put all four lines together?” An’an raised her hand. After the first two lines, she counted one quiet beat in her head, then said the last two. She could hear every word she said. |Over Teacher Xu’s shoulder toward An’an raising one hand willingly from her seat. The other children remain relaxed on the pale wooden stools. Low warm sunlight, yellow rug and two blue blocks in place.
下课铃响了，妈妈在门口等安安。安安背好小书包，张嘴就想把一整节课都讲出来。话到了嘴边，她先拍了拍自己的膝盖。|When class ended, Mom was waiting in the doorway. An’an put on her backpack and opened her mouth to tell her everything at once. Just before she started, she tapped her knee. |At the mint classroom door, An’an stands with her single orange backpack on, pausing to lightly tap one knee. Mom stands nearby in the hallway, turned toward her, waiting warmly. Afternoon light.
“我们念了《八百标兵》。”安安停一下。“我把‘并排’说错了，后来又试了一遍。”妈妈问：“你后来怎么念的？”安安仰起脸，把“并排”慢慢念给妈妈听。|“We said ‘Eight Hundred Soldiers,’” An’an began. She paused. “I mixed up ‘side by side,’ and then I tried it again.” Mom asked, “How did you say it the next time?” An’an looked up and said the words slowly for her. |Seated in lobby on a low oak bench, An’an looks up and speaks to Mom. Mom leans slightly toward her to listen. Orange backpack is worn by An’an. Bright paper circles are visible in the distance.
走出少年宫，安安一抬头，又看见了那只小鸟。它跳上栏杆，歪着小脑袋。安安拉拉妈妈的袖口，压低了声音：“妈妈，小鸟回来了。”|Outside the Children’s Palace, An’an looked up and saw the little bird again. It hopped onto the railing and tilted its head. An’an tugged Mom’s sleeve and whispered, “Mom, the bird is back.”|Outside the contemporary arts center, An’an tugs Mom’s coral sleeve gently and looks toward one small brown sparrow perched on a low dark metal railing. Show child, mother and bird in the same frame. Orange backpack stays on the girl.
小鸟扑扇着翅膀飞了。“它刚才跳了两下。”安安停了一拍，又指了指树梢，“然后飞到树上去了。”妈妈顺着她的手指看过去：“我也看见了！”|The bird flapped its wings and flew off. “It hopped twice.” An’an paused for a beat and pointed toward the treetop. “Then it flew up into the tree.” Mom followed her finger. “I saw it, too!”|Low angle near the path outside the arts center, An’an points to one small brown sparrow near the leafy tree canopy while Mom follows the gesture with her eyes. Railing stays empty. One orange backpack on An’an.
晚饭时，安安在桌角摆了两块蓝积木，中间也留了一道缝。轮到妈妈念，妈妈也把几个字说挤了。安安学着徐老师的样子，指指那道缝：“在这里，等一拍。”|At dinner, An’an set two blue blocks on one corner of the table and left a gap between them. When it was Mom’s turn, some of her words bumped together, too. An’an pointed to the gap, just like Teacher Xu. “Wait one beat right here.”|At home by the oak dining table, in a corner clear of dishes, exactly two plain blue wooden cubes stand with a small gap. An’an points into the gap while Mom tries the tongue twister, smiling mid-word. Soft warm evening light and pastel green kitchen behind.
妈妈又念了一遍。说到积木中间，两个人谁也没出声。那一小拍里，安安听见了窗外的一声鸟叫。她笑了笑，等妈妈把后半句说完。|Mom tried again. When she reached the gap between the blocks, they both went quiet. In that one little beat, An’an heard a bird outside. She smiled and waited for Mom to finish the line.|Quiet closing view from the side of the oak table: An’an smiles and listens while Mom pauses, a pair of separated blue cubes visible in the foreground. Evening window and leafy shadows behind, bird heard but not shown. Intimate and still.
'''


def main():
    target = ROOT / 'content-drafts/richang'
    batch = target / 'batch-54-54'
    book_file = target / f'{SLUG}.json'
    if book_file.exists() or batch.exists():
        raise SystemExit('Book 54 already exists; edit the production draft directly.')
    pages = [tuple(part.strip() for part in row.split('|')) for row in PAGES.strip().splitlines()]
    assert len(pages) == len({row[0] for row in pages}) == 18
    assert all(len(row) == 3 and all(row) for row in pages)
    order, date = 54, '2026-11-22'
    entry = dict(id=SLUG, title=TITLE, pages=len(pages), order=order)
    kit = json.loads((target / 'lan-ping-guo.json').read_text())['imagePromptKit'].copy()
    kit['characterConsistency'] += ' Teacher Xu wears round dark glasses, a jaw-length black bob tucked behind one ear, an indigo blouse, and cream trousers.'
    book = dict(
        id=SLUG, seriesId='richang', title=TITLE, subtitle=SUBTITLE,
        moral=dict(zh=MORAL, en=MORAL_EN), ageLabel='4–8 岁', publishedAt=date,
        order=order, comingSoon=True,
        pages=[dict(page=i, zhText=zh, enText=en, illustrationPrompt=scene, imageStatus='pending')
               for i, (zh, en, scene) in enumerate(pages, 1)],
        metadata=dict(
            category='family-growth', ageRange=dict(min=4, max=8), estimatedMinutes=6,
            languages=['zh', 'en'], seriesId='richang', seriesOrder=order, personalizationEnabled=False,
            tags=['日常系列', '亲子共读', '之江少年宫', '口才培训', '八百标兵', '绕口令', '表达与倾听'],
            featured=False, bedtimeSuitable=True,
        ),
        parentGuide=dict(
            goal=GOAL, reminder=REMINDER, questions=QUESTIONS, activity=ACTIVITY,
            ageTips=dict(age4to5='用两块积木摆出两个短语，选一小句试试停一拍。',
                         age6to8='试着给自己想讲的一件事分两小句，让听的人复述听到的顺序。'),
        ),
    )
    batch.mkdir()
    for file, value in [
        (book_file, dict(book=book, imagePromptKit=kit)),
        (batch / 'plan.json', dict(approved=True, approvedAt=date, totalPages=len(pages), books=[entry])),
        (batch / 'progress.json', dict(manuscripts='complete', totalPages=len(pages), imagesComplete=0,
             narration='pending', books=[dict(**entry, completeImages=0, narration='pending', locallyReadable=False)],
             uploaded=False, deployed=False, status='manuscripts-ready', createdOn=date)),
        (batch / 'image-prompts.json', [dict(id=SLUG, page=i, prompt=STYLE + scene)
             for i, (_, _, scene) in enumerate(pages, 1)]),
    ]:
        file.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    manuscript = [f'# {TITLE}\n\n日常系列第 {order} 本 · {SUBTITLE}\n', f'亲子目标：{GOAL}\n', f'家长提醒：{REMINDER}\n']
    for i, (zh, en, scene) in enumerate(pages, 1):
        manuscript.append(f'### 第 {i} 页\n\n{zh}\n\n{en}\n\n分镜：{scene}\n')
    manuscript.append('共读问题：\n\n' + '\n'.join(f'- {item}' for item in QUESTIONS) + f'\n\n小活动：{ACTIVITY}\n')
    (batch / 'manuscript.md').write_text('\n'.join(manuscript))
    print(f'Built {TITLE} with {len(pages)} bilingual pages.')


if __name__ == '__main__':
    main()
