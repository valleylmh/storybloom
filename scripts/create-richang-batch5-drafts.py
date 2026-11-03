"""Save the user-approved fifth everyday batch (kindergarten senior class / school transition); never overwrite finished work."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BOOKS = []


def add(slug, title, subtitle, moral, moral_en, tags, goal, reminder, questions, activity, rows):
    pages = [tuple(part.strip() for part in row.split("|")) for row in rows.strip().splitlines() if row.strip()]
    assert all(len(page) == 3 and all(page) for page in pages), title
    BOOKS.append((slug, title, subtitle, moral, moral_en, tags, goal, reminder, questions, activity, pages))

add('xiao-men-kou-de-na-yi-ci-hui-shou', '校门口的那一次挥手', '把妈妈的爱装进口袋里',
    '分开时的不舍很自然；装满安全感的小约定，能陪我们勇敢走进大班。',
    'It is natural to feel reluctant when parting; a warm promise filled with love helps us step bravely into our day.',
    ['分离与适应', '幼小衔接', '安全感建立'],
    '接纳离园时的依恋情绪，通过具体、可感知的约定帮助孩子建立安全依恋。',
    '不用“都是大班孩子了还不懂事”羞辱难过，不偷偷溜走。分别仪式要温暖而简短，由成人坚守接园时间。',
    ['妈妈在安安手心画了什么？', '上学想家的时候，你有什么给自己打气的小办法？'],
    '和孩子一起设计一个专属的“告别击掌密码”或“口袋爱心”，并在入园前练习一次温和道别。', '''
清晨，阳光洒在幼儿园大门前的台阶上。红色的欢迎拱门高高立着，许多小朋友正背着书包走进去。|Morning sunlight poured over the kindergarten steps. A welcoming archway stood tall as children walked in with their backpacks.|Wide sunny kindergarten entrance: colorful archway near stone steps, morning trees, An'an wearing orange backpack and Mom holding her hand; welcoming courtyard.
安安站在校门口的大树旁，脚步停住了。她拉着妈妈的手，手指抓得紧紧的。|An'an paused beside the big tree near the gate. She held Mom's hand, her small fingers gripping tightly.|Medium outdoor gate view: An'an stops near tree trunk holding Mom's hand tightly, hesitant watery eyes, orange backpack; Mom looks down with warm patient face.
“安安已经是大班的哥哥姐姐啦。”一位叔叔走过时笑着说。可安安却把头靠在妈妈胳膊上，没有出声。|“An'an is in the senior class now, a big kid!” a neighbor smiled while walking past. But An'an rested her head against Mom's arm in quiet hesitation.|Medium portrait: An'an leans head against Mom's coral cardigan, reluctant expression, orange backpack straps visible; Mom stands gently beside her.
大班的教室在二楼，走廊比以前更长。安安看着那些高高的窗户，觉得幼儿园好像一下子变大了好多。|The senior classroom was on the second floor with longer hallways. Looking up at the tall windows, An'an felt the school had suddenly grown much bigger.|Low upward perspective: tall windows and kindergarten building above leafy trees; small An'an in teal hoodie looks up with uncertainty.
妈妈蹲下身来，把安安脸颊边的一缕碎发理到耳后，目光平平地看着她的眼睛。|Mom knelt down, gently brushed a loose strand of hair behind An'an's ear, and met her eyes at eye level.|Warm two-person eye-level medium shot: Mom kneels on clean pavement, tucking hair behind An'an's ear; yellow star hair clip gleams.
“安安是不是觉得，大班的事情又新又多，心里有点没准备好？”妈妈轻声问。|“Does the senior class feel big and new, making you feel a little unready inside?” Mom asked softly.|Close two-person conversation: Mom speaks with calm empathy at child height; An'an listens with moist eyes, nodding slightly.
安安点点头，声音小小的：“我想和你在一起。如果我想你了，怎么办呢？”|An'an nodded, her voice very quiet. “I want to stay with you. What if I miss you during the day?”|Close portrait: An'an looks at Mom with sincere emotion, lips pressed softly; Mom's listening hands rest gently on An'an's arms.
妈妈握住安安的小手，轻轻展开她的手掌。妈妈伸出食指，在安安的手心里画了一个小小的圆圈。|Mom took An'an's hand and gently opened her palm. With her forefinger, Mom drew a small circle in the center.|Close-up of hands: Mom's gentle finger traces an invisible circle in An'an's small open palm, warm morning light on skin.
“这是一颗隐形的小爱心。”妈妈微笑着按了按那块手心，“当你想妈妈时，就合上小手，把它按进心窝里。”|“This is a little invisible heart,” Mom smiled, pressing gently on her palm. “Whenever you miss me, close your hand and press it to your chest.”|Close two-person view: Mom presses An'an's palm softly; An'an looks down at her palm with curious wonder.
安安慢慢合拢手指，紧紧攥住手心里的温热，就像真的抓到了一颗红亮亮的小糖果。|An'an slowly curled her fingers into a fist, holding tight to the warmth in her palm as if gripping a shiny little sweet.|Medium shot: An'an brings her curled fist gently against her teal hoodie chest, feeling the warmth; Mom smiles reassuringly.
“时针转到数字4的时候，妈妈会第一个站在校门这棵树下等你。”妈妈指了指校门旁的大树。|“When the clock's hand points to four, I will be the first one waiting right under this tree,” Mom promised, pointing to the tree.|Medium view: Mom points toward leafy green tree near school gate, morning breeze rustling leaves; An'an listens attentively.
林老师从校门里迎出来，微笑着向安安伸出手：“早上好，安安！今天植物角的小番茄又长高了一点呢。”|Teacher Lin walked out from the gate, smiling as she offered a welcoming hand. “Good morning, An'an! The cherry tomatoes in our plant corner grew taller today.”|Three-person entrance scene: Teacher Lin in sage-green cardigan bends slightly to greet An'an; Mom stands beside, encouraging gently.
安安转头看看妈妈，妈妈微笑着点点头，松开了手：“去吧，安安。妈妈的爱就在你的口袋里。”|An'an looked back at Mom. Mom smiled and released her hand gently. “Go ahead, An'an. My love is right in your pocket.”|Medium shot: An'an takes one step forward toward Teacher Lin, looking back with brave expression; Mom waves with open relaxed posture.
安安迈步走过欢迎拱门。走进楼梯前，她停下脚步，在走廊的大窗户边回过头去。|An'an stepped through the archway. Before heading up the stairs, she stopped and looked back through the wide corridor window.|Interior hallway view: An'an stands by bright corridor window looking down toward courtyard, clutching her backpack strap.
大树下，妈妈依然站在那里。妈妈抬起手，用力地、慢慢地向她挥动着手臂。|Under the big tree, Mom was still standing there, raising her arm and waving slowly and steadily toward the window.|Framed window view: outside in the sunny courtyard under the green tree, Mom waves with warm clear arm gesture.
安安把右手贴在胸口摸了摸那颗“小爱心”，然后也举起小手，隔着玻璃朝妈妈大声挥了挥。|An'an pressed her right hand to her chest over the invisible heart, then raised her hand to wave back bravely through the glass.|Close emotional portrait: An'an smiles through the sunny window, hand waving high, yellow star hair clip sparkling in morning sun.
走上二楼，阳光铺满大班的教室。乐乐正在积木区招手：“安安，快来帮我搭大吊桥！”安安快步跑了过去。|Upstairs, sunlight filled the senior classroom. Lele waved from the building block rug: “An'an, come help me with the big bridge!” An'an hurried over happily.|Bright classroom wide shot: wooden shelves, reading rug, Lele sitting beside wooden blocks waving; An'an walks in cheerfully.
下午四点，放学铃声响起。安安背好书包飞奔出校门，大树下，妈妈果然张开双臂，正微笑着迎向她。|At four in the afternoon, the dismissal bell chimed. An'an ran out through the gate; under the big tree, Mom was waiting with open arms.|Warm afternoon closing shot: golden sunset glow under big tree, An'an runs toward smiling Mom with backpack bouncing happily.
''')

add('yao-huang-de-di-yi-ke-xiao-ru-ya', '摇晃的第一颗小乳牙', '咬苹果的小秘密与长大的信号',
    '身体的变化是在提醒我们悄悄长大；不必因为掉牙害怕或害羞。',
    'Changes in our bodies remind us that we are growing; there is no need to feel afraid or shy about losing a baby tooth.',
    ['换牙期', '身体认知', '接纳自己'],
    '帮助 6 岁孩子认识乳牙脱落的自然生理过程，缓解对流血、疼痛和同伴眼光的焦虑。',
    '不取笑孩子说话漏风或掉牙的外貌，不强行用线硬拔。关注口腔卫生，庆祝长大的里程碑。',
    ['安安一开始为什么不敢大声说话？', '乳牙摇晃的时候，下面正在发生什么奇妙的事？'],
    '准备一个干净的小盒子当作“乳牙纪念盒”，和孩子一起在镜子前数数自己已经长出了几颗坚固的牙齿。', '''
上午加餐时间，桌上摆着一盘切好的红苹果片。安安拿起一块，咬了一大口。|During morning snack time, a plate of fresh red apple slices sat on the table. An'an took a piece and took a big bite.|Bright classroom snack table: wooden dining table with a plate of crisp apple slices; An'an holds an apple slice to her mouth.
“哎呀！”安安轻轻叫了一声，手里的半块苹果停在嘴边。她觉得下排中间的小牙齿晃了一下。|“Oh!” An'an gasped softly, pausing with the apple slice at her lips. She felt a lower front tooth wiggle slightly.|Close portrait: An'an pauses with apple slice near mouth, eyes wide with surprise, touching her lower lip gently.
安安放下苹果，伸出舌尖轻轻推了推。那颗小牙真的前后晃动了一下，像一颗松动的小积木。|An'an set the apple down and gently poked with the tip of her tongue. The tooth really moved back and forth like a loose little block.|Close-up: An'an's thoughtful face, tongue pressing subtly behind bottom lip, curious and cautious expression, plate nearby.
她用手指摸了摸牙齿，有点酸酸胀胀的。“牙齿怎么会摇晃呢？会不会掉下来流好多血？”安安心里怦怦直跳。|She touched the tooth with a clean finger; it felt slightly tender. “Why is it loose? Will it fall out and bleed a lot?” Her heart beat fast.|Medium table shot: An'an sits alone at the table touching her lower jaw, slightly worried look, unfinished apple on plate.
乐乐端着水杯走过来，看见安安捂着嘴巴，笑着说：“安安，你是不是要掉牙变成说话漏风的小老头啦？”|Lele walked over with his water cup. Seeing An'an covering her mouth, he teased playfully: “Are you losing a tooth and going to whistle when you talk?”|Two-person table shot: Lele in mustard sweatshirt holds a water cup smiling; An'an quickly covers mouth with both hands, defensive and shy.
安安赶紧把嘴巴闭得紧紧的。一整个上午，她都不敢开口说话，生怕一张嘴牙齿就掉在地上。|An'an clamped her mouth shut tight. All morning, she hardly opened her lips, afraid the loose tooth might fall right onto the floor.|Classroom reading corner: An'an sits quietly hugging a picture book with pressed lips, refusing to speak; other children play nearby.
画画课上，老师请安安讲讲自己的小画，安安只是低着头指了指纸上的彩虹，声音小得像蚊子嗡嗡叫。|During art time, the teacher asked An'an about her drawing. An'an only pointed shyly at her painted rainbow, whispering like a tiny breeze.|Art table medium shot: Teacher Lin in sage-green cardigan bends to listen; An'an points timidly at rainbow drawing with mouth tightly shut.
下课后，林老师轻轻拍了拍安安的肩膀：“安安，今天嘴巴里是不是藏着一个小秘密？”|After class, Teacher Lin gently touched An'an's shoulder. “An'an, is there a little secret hiding in your mouth today?”|Quiet classroom corner: Teacher Lin sits beside An'an on small wooden chairs, gentle inquiring gaze, no other children around.
安安看了看四周，才慢慢张开嘴，指了指下门牙：“老师，我的牙齿摇晃了。它是不是坏掉了？”|An'an glanced around, then slowly opened her mouth and pointed to her bottom tooth. “Teacher, it's loose. Is it broken?”|Close two-person shot: An'an points to her lower front tooth with genuine concern; Teacher Lin looks closely with warm understanding smile.
林老师微笑着张开嘴让安安看自己的牙齿：“老师小时候也掉过牙呢。你的小牙没有坏，它是在给你送信呢！”|Teacher Lin smiled warmly: “I lost baby teeth when I was little too. Your tooth isn't broken—it is delivering an exciting message!”|Close portrait: Teacher Lin explains gently with warm gestures, pointing to an educational tooth model on low shelf nearby.
“每一颗小乳牙下面，都藏着一颗新恒牙。”老师拿来一张卡通牙齿图卡，“新牙齿在土里发芽长大，把小乳牙轻轻顶松啦。”|“Beneath every baby tooth, a strong adult tooth is growing,” the teacher showed a colorful diagram. “It pushes gently from below as it sprouts.”|Tabletop diagram view: Teacher Lin shows an illustrated card of baby teeth and adult teeth; An'an leans in, listening intently with wide eyes.
“这是大班小朋友专属的长大勋章！”林老师从抽屉里拿出一个小巧的粉色透明小盒子递给她，“这是乳牙收集盒。”|“This is a special badge of growing up for big kids!” Teacher Lin brought out a small clear pink box. “Here is a little tooth treasure box.”|Close view: Teacher Lin hands small pink keepsake box to An'an; An'an cradles it in both hands, eyes brightening with relief.
安安捧着小盒子，心里的害怕一下子被好奇代替了：“那……它掉下来的时候会疼吗？”|Holding the little box, An'an's fear gave way to curiosity. “Will it hurt when it comes out?”|Two-person intimate shot: An'an holds the pink keepsake box, looking up hopefully; Teacher Lin smiles reassuringly.
“就像熟透的小苹果从树上轻轻落下来一样，自然掉落时只有一点点感觉。”林老师说，“我们只要每天把它刷干净就好。”|“Just like a ripe apple falling softly from a branch, it barely pinches when it's ready,” the teacher said. “Just keep brushing gently.”|Medium shot: Teacher Lin mimics a leaf falling with her hand; An'an giggles softly, no longer covering her mouth.
午饭时，安安换成用后面的大牙轻轻嚼米饭。乐乐跑过来问：“你的牙齿还要留着吗？”安安骄傲地说：“它在为新牙齿让路呢！”|At lunch, An'an chewed softly with her back teeth. When Lele came by, she said proudly: “It's making room for my strong new tooth!”|Lunch table scene: An'an sits with lunch bowl, speaking with gentle confidence to Lele; Lele looks surprised and curious.
傍晚回到家，安安站在洗手台前刷牙。刷到门牙时，牙刷轻轻一碰，那颗小牙骨碌碌滚落到了白毛巾上。|In the evening at home, An'an brushed her teeth. As the bristles brushed her front tooth, it popped right out onto the clean white towel.|Bathroom mirror view: An'an holding yellow toothbrush in front of mirror, a tiny white tooth resting on a clean white washcloth below.
一点儿也不疼，只有水池里淡淡的一小点粉红。安安漱了漱口，小心翼翼地把洁白的小乳牙装进粉色盒子里。|It didn't hurt at all, just a tiny rinse of pink water. An'an rinsed and carefully placed the white baby tooth into her pink box.|Close overhead view: child's careful fingers place tiny white tooth into open pink case on marble sink counter, warm bathroom light.
安安跑到镜子前，咧开嘴笑了起来。虽然门牙中间多了一个小小的门洞，但安安觉得，自己今天真的长大了一点。|An'an ran back to the mirror and gave a wide grin. Even with a tiny gap between her teeth, she felt she had truly grown today.|Warm bedroom ending: An'an grins at desk mirror showing cute little gap, holding up pink tooth box proudly; Mom smiles from doorway.
''')

add('pin-yin-wang-guo-li-de-xiao-wan-gou', '拼音王国里的小弯钩', 'b 和 d 怎么又转晕啦？',
    '刚学新符号分不清很正常；把身体当成小尺子，多试几次就能找到方向。',
    'It is normal to confuse new symbols at first; using our hands and body makes finding the way fun and clear.',
    ['拼音启蒙', '幼小衔接', '学习抗挫'],
    '将抽象的拼音符号与具象身体动作连接，化解大班幼小衔接中的认读混淆与挫败感。',
    '避免在孩子混淆时严厉催促或贴上“笨、粗心”的标签。用游戏和身体律动代替枯燥的死记硬背。',
    ['安安用什么办法分清了左边的 d 和右边的 b？', '遇到容易转晕的新字母时，我们能怎么玩？'],
    '两个人伸出左右手竖起大拇指，玩“b 还是 d”的捉迷藏身体反应游戏，边念儿歌边比划。', '''
大班的黑板旁边，贴上了一张彩色的拼音字母表。红的、蓝的、绿的小字母，像一队队正在列车上排队的小乘客。|Beside the big blackboard hung a colorful pinyin chart. Red, blue, and green letters lined up like cheerful passengers on a train.|Bright classroom wall view: colorful chart with abstract rounded pinyin shapes on cork board; wooden desks and daylight from window.
今天，林老师领着大家认读声母：“右下半圆 b b b，左下半圆 d d d。”安安跟着大家一起大声念着。|Today, Teacher Lin led the class reading initials: “Circle on the right is b; circle on the left is d.” An'an chanted along aloud.|Classroom front view: Teacher Lin points to wooden pointer near chart; children sitting at desks chanting together.
开始书写练习了。安安握着短短的铅笔，认认真真在四线三格本上写字。竖线直直的，可圆圈画到哪边呢？|It was time to practice writing. An'an held her pencil carefully, ready to write in her four-line notebook. Which side did the circle go on?|Desk close-up: An'an holds yellow pencil above blank lined notebook, brow furrowed in deep thought; yellow star clip visible.
安安盯着本子看了半天，小脑袋歪向左边，又歪向右边。两个字母在脑子里转来转去，像转动的小陀螺。|An'an stared at her notebook, tilting her head left and then right. The two letters seemed to spin inside her mind like little tops.|Medium desk view: An'an tilts head with puzzled expression, eraser in left hand, pencil poised in right, blank lines on open book.
她一笔画下去，把圆圈画在了左边，可心里又觉得不对。拿橡皮擦掉，重新画在右边，怎么看还是觉得别扭。|She drew a circle on the left, but felt it was wrong. She erased it and drew it on the right, still feeling unsure.|Close overhead view: pencil marks erased leaving faint gray smudges on paper, pencil tip resting beside lines; child's hand uncertain.
同桌小宇已经写完了整整一行，一排排漂亮的小字母整齐地站着，像站岗的小哨兵。|Her desk partner Xiaoyu had already finished a whole row. His letters stood neat and tidy like little sentinels on parade.|Two-desk view: Xiaoyu in forest-green sweatshirt writes smoothly; An'an glances sideways at his notebook with a worried sigh.
安安急得吸了吸鼻子，手心开始冒出汗水。用力一擦，本子上的格子线被擦得模模糊糊，铅笔尖也“啪”的一声断掉了。|An'an grew anxious, her palms turning sweaty. She rubbed too hard, smudging the lines until her pencil lead snapped with a tiny snap.|Close desk view: snapped pencil lead on notebook page beside rubber shavings, tear welling in An'an's eye; eraser held tightly.
安安吸了吸泛酸的鼻子，把头埋进手臂里，眼泪一滴滴落在了桌面上。“我怎么总分不清呢……”她小声吸泣。|An'an sniffled, burying her face in her arms as a tear slipped onto the oak desk. “Why do I always mix them up?” she sobbed softly.|Side view: An'an rests head on arms across desk, shoulders shaking slightly; notebook pushed aside, broken pencil nearby.
轻柔的脚步声走过来，林老师没有批评她弄脏本子，而是轻轻把安安抱到教室后面的活动地垫上坐下。|With gentle steps, Teacher Lin walked over. Instead of scolding, she helped An'an up and led her to the cozy reading rug at the back.|Warm classroom carpet scene: Teacher Lin sits cross-legged beside tearful An'an on green foam mat, holding a soft tissue.
老师递给安安一张纸巾，擦干泪花：“安安别着急。刚去别人家做客，常常会认错双胞胎兄弟，对不对？”|Handing An'an a tissue, the teacher said: “Don't worry, An'an. When you meet twins for the first time, it's easy to mix them up, right?”|Close two-person conversation: Teacher Lin dabs An'an's cheek gently; An'an looks up, listening with reddened nose.
安安点点头。林老师伸出自己的两只手，握紧拳头，竖起大拇指：“来，我们和字母兄弟握握手！”|An'an nodded softly. Teacher Lin raised both hands, curled her fingers into fists, and stuck her thumbs straight up: “Let's shake hands with them!”|Two-person medium shot: Teacher Lin holds up both thumbs-up fists in front of her; An'an watches curiously.
“伸出左手竖大拇指，你看，拳头是圆圆的肚子，大拇指是长长的小天线，这是谁呀？”老师晃了晃左手。|“Put up your left thumb. Look, the curled fingers make a round belly, and the thumb is the tall stick. Who is this?” the teacher asked.|Close view of hands: Teacher Lin's left thumb-up fist mimics the letter 'd'; An'an observes the shape with widening eyes.
“是 d！”安安脱口而出。“那右手竖起大拇指呢？”老师晃了晃右手。“肚子跑到右边去了……是 b！”安安喊道。|“That's d!” An'an blurted out. “And with the right hand?” Teacher Lin wiggled her right thumb. “The belly is on the right—that's b!” An'an cheered.|Close view: An'an imitates with her own small hands, raising both thumbs up, a bright realization dawning across her smiling face.
“对啦！左手比出 d，右手比出 b。你的两只小手，就是随身带着的小尺子！”林老师拍手笑起来。|“Exactly! Left hand for d, right hand for b. Your two hands are little rulers you carry everywhere!” Teacher Lin clapped and smiled.|Medium mat view: Teacher Lin and An'an both hold up their thumbs-up fists together, laughing and matching their hands.
乐乐和小宇也跑了过来，大家一起坐在地垫上，伸出小手玩起了口令游戏：“大白鹅游水，b b b！小马奔跑，d d d！”|Lele and Xiaoyu ran over to join in. Everyone sat on the mat, flashing their hands to rhyme games: “White goose swimming, b b b! Little horse galloping, d d d!”|Wide cheerful rug scene: An'an, Lele, and Xiaoyu sit in a circle on green mat laughing and flashing thumbs-up signs with Teacher Lin.
安安回到座位上，拿出一支新削好的红铅笔。写字前，她先悄悄在桌子底下伸出两只小手比了比。|An'an returned to her seat with a freshly sharpened pencil. Before writing, she peeked under the desk to check her two thumbs.|Low desk shot: An'an looks down under the desk where her left and right thumbs form friendly shapes, grinning secretly.
一笔、两笔，圆圆的肚子稳稳地画在了正确的方向上。本子上的小字母站得笔直，再也没有转晕了。|Stroke by stroke, the round bellies landed on the correct sides. The little letters stood straight, spinning in confusion no longer.|Close-up of notebook: clean smooth lines form neat b and d rows; An'an's hand writes steadily with newfound confidence.
放学时，安安给妈妈展示写满星星印章的练习本：“妈妈，我的两只小手学会了神奇的拼音魔法啦！”|At dismissal, An'an showed Mom her notebook stamped with little stars: “Mom, my two hands learned a magical pinyin trick today!”|Courtyard exit closing shot: An'an proudly holds up open notebook to smiling Mom, yellow star clip gleaming under warm afternoon light.
''')

add('tiao-chu-tian-zi-ge-de-xiao-shu-zi', '跳出田字格的小数字', '橡皮擦不掉的慢慢练',
    '手指的力气是一点点长出来的；歪歪扭扭的痕迹，都是努力长大的脚印。',
    'Strength in our fingers grows day by day; wobbly marks are just the footprints of our honest practice.',
    ['握笔练习', '写数字', '允许不完美'],
    '引导孩子接受肌肉控制发展中的不完美，学会手部放松，放下“一定要一笔写好”的紧绷感。',
    '6 岁小手小肌肉正在发育，不施加长时间高强度的机械描红。擦破纸时先安抚情绪，肯定孩子的努力。',
    ['安安写字手酸的时候，妈妈带她做了什么小游戏？', '为什么说写得不太圆的数字也是好朋友？'],
    '玩“小乌龟抓抓抓”手指放松操，并用彩色毛线在桌面上摆出 6、8、9 的圆润轨道，用手指顺着走。', '''
午后的阳光照进客厅。书桌上摆着一本带绿色田字格的算术描红本，安安端端正正地坐着。|Afternoon sunlight streamed into the living room. On the desk lay an arithmetic practice book with green grid squares; An'an sat upright.|Sunny living room study desk: oak desk near window, green-lined practice workbook, yellow pencil in child's small hand.
今天大班的作业是练习写数字 8 和 6。安安捏紧铅笔，指节用力得微微发白。|Today's practice was numbers 8 and 6. An'an gripped her pencil tightly, her small knuckles turning pale with effort.|Close-up of hand: child's fingers pinch yellow pencil very tightly close to the tip, tense hand muscles, paper beneath.
从上往下画圆，再绕一个圈。安安屏住呼吸，可笔尖总是不听使唤，数字 8 拧成了一个歪歪斜斜的小麻花。|Starting from the top and looping around, An'an held her breath. But the pencil tip wobbled, and the 8 twisted like a crooked pretzel.|Close overhead view: pencil tip leaves an uneven, lopsided figure 8 sprawling outside the green grid lines; child's tense hand.
“怎么又跳出格子外面去啦？”安安小声咕哝着，拿起大橡皮使劲地擦。|“Why did it hop outside the box again?” An'an muttered softly, grabbing a chunky eraser to rub hard.|Medium view: An'an rubs paper vigorously with large eraser, brow furrowed, small eraser crumbs scattering across desk.
她又试着写数字 6。圆圆的小肚子一拐弯，竟然反向朝向了右边，像一只调皮的小鸭子转错了身。|She tried writing a 6 next. But the round belly curved backward to the right, like a duckling facing the wrong direction.|Close-up of paper: a reversed 6 drawn with heavy dark strokes; eraser shavings spread across the page.
“不对，又反了！”安安越来越急。她抓起橡皮在同一个地方用力来回擦蹭。|“No, it's backward again!” An'an grew more frustrated. She scrubbed back and forth on the same spot with all her might.|Medium view: An'an scrubs forcefully, shoulders hunched with stress; paper wrinkling under pressure.
只听“嗤”的一声轻响，薄薄的练习纸经不住猛力，破开了一个小小的破洞。|With a soft tear, the delicate practice paper gave way, ripping open a small ragged hole.|Close-up of workbook: a small hole torn in the green grid, gray smudged paper torn around the edges; eraser still in hand.
安安停住了手。黑乎乎的铅笔屑落满桌子，本子也皱皱巴巴的。她的手腕酸酸胀胀，手指又僵又疼。|An'an froze. Dark pencil smudges covered the desk and the page was crumpled. Her wrist ached and her fingers felt stiff and sore.|Close portrait: An'an gazes down at torn workbook with trembling lips, eyes rimmed with tears; limp hand resting on desk.
“我写不好……我再也不想写了！”安安趴在桌子上，把脸埋进臂弯里，难过地抽泣起来。|“I can't write it right... I don't want to write anymore!” An'an collapsed onto the desk, burying her face in her arms in tears.|Wide side shot: An'an slumps over oak desk in quiet despair, green workbook and eraser beside her, sunny living room.
妈妈端着一小盘洗好的蓝莓走进来，看到桌上的小破洞和抽泣的安安，轻轻放下了果盘。|Mom walked in carrying a bowl of fresh blueberries. Seeing the torn page and An'an sobbing, she set the bowl down gently.|Two-person medium shot: Mom in coral cardigan sets blueberry bowl on side table, approaching An'an with soft compassionate face.
妈妈没有问“怎么又哭了”，而是轻轻拉起安安那只写字的小手，帮她慢慢揉着发酸的手指关节点。|Mom didn't scold. Instead, she gently took An'an's writing hand, tenderly massaging each tight, tired finger joint.|Close shot of hands: Mom's gentle warm hands massage An'an's small tense fingers, relaxing stiff knuckles.
“写字是一群小手指在跳舞。如果小舞者太紧张、使劲抓着地，很快就会累得走不动啦。”妈妈轻声说。|“Writing is like tiny fingers dancing. If the little dancers grip too hard, they get tired and can't dance smoothly,” Mom said softly.|Warm two-person eye-level shot: Mom sits beside An'an speaking gently; An'an sniffles, her rigid shoulders gradually dropping.
妈妈拉着安安站起来：“我们先来给手指做做体操！两只小手变乌龟，张开——抓抓抓！变小鸟，飞呀飞！”|Mom helped An'an stand: “Let's do finger gym first! Turn hands into turtles: stretch open—claw, claw, claw! Now little birds, flap, flap!”|Medium wide shot: Mom and An'an stand laughing together, spreading fingers and shaking hands loosely in the air to loosen up.
手指甩轻松了，妈妈用一张彩色贴纸贴好破洞：“它变成了一颗鼓励星！”接着在桌上用红毛线盘成一个大大的 8 字。|With loose fingers, Mom covered the tear with a colorful star sticker: “An encouragement star!” Then she arranged thick red yarn into a smooth figure 8 on the table.|Tabletop view: star sticker over paper tear; bright red yarn shaped into a large smooth figure 8 on oak tabletop, Mom and An'an smiling.
“闭上眼睛，用指尖顺着红毛线滑一圈，感受一下滑梯是怎么滑的。”妈妈握着安安的手指在毛线上轻柔滑动。|“Close your eyes and trace the red yarn with your finger, feeling how the slide curves smoothly,” Mom guided An'an's fingertip along the yarn.|Close view: An'an's small finger smoothly follows the soft red yarn track on the wooden surface, a calm relaxed smile appearing.
“就像坐旋转滑梯一样，轻轻的，不用力按。”安安睁开眼，重新拿起铅笔。这一次，她的手指握得松松软软的。|“Just like riding a gentle slide—lightly, without pressing down hard.” An'an opened her eyes and picked up her pencil with a relaxed grip.|Close portrait: An'an holds the pencil loosely with relaxed fingers, taking a calm breath, pencil point resting softly on clean grid.
圆弧顺滑地滑下来，又稳稳地绕了回去。虽然数字 8 还是有一点点胖乎乎，但它乖乖地待在绿色的田字格里，没有出格。|The curve looped smoothly down and circled back up. Even if the 8 was still a little chubby, it stayed comfortably inside the green grid.|Close shot of notebook: a rounded, cheerful pencil-written 8 sits neatly centered in the green square; star sticker nearby.
“太棒啦！它是一个健康的小雪人！”妈妈在旁边鼓起掌来。安安笑了，原来不用橡皮擦，慢慢画也能画出漂亮的弧线。|“Wonderful! It looks like a happy little snowman!” Mom clapped softly. An'an smiled; slow and steady made lovely curves without erasing.|Warm closing shot: An'an proudly shows the page with three neat numbers to smiling Mom, enjoying a sweet blueberry reward together.
''')

add('wo-xiang-qu-xi-shou-jian-ke-yi-ju-shou-ma', '我想去洗手间，可以举手吗？', '身体的小信号最重要',
    '规则是为了照顾大家，而身体的健康永远排在第一位；有需要就勇敢举手。',
    "Rules help care for everyone, and our body's health always comes first; raise your hand bravely when you need to.",
    ['生理需求', '课堂举手', '自我照顾'],
    '破除孩子对课堂纪律的绝对恐惧，赋予在集体生活中坦荡表达生理需求的勇气。',
    '绝不因孩子课上上厕所而训斥或当众盘问，建立老师作为安全保护者的信任形象。',
    ['安安想去洗手间时，为什么一开始不敢举手？', '老师是怎么告诉全班小朋友的？'],
    '在家和孩子进行一次“小课堂模拟”，练习挺直后背举手、声音清晰地说出“老师我想喝水/去洗手间”。', '''
大班的早读课刚结束，林老师站在黑板前，开始绘声绘色地讲一本关于大鲸鱼的奇妙故事书。|Morning reading just finished. Teacher Lin stood by the blackboard, sharing a wonderful storybook about a great whale.|Classroom wide view: Teacher Lin holds up large illustrated picture book; children sitting on wooden chairs listening attentively.
教室里安安静静的，大家都在聚精会神地听着。窗外小树叶在风里轻轻摇晃。|The room was peaceful and quiet as everyone listened intently. Outside, young leaves rustled gently in the morning breeze.|Classroom middle shot: neat rows of low desks, quiet atmosphere, sunlight streaming through large classroom windows.
安安坐在第三排，两只手规规矩矩地放在膝盖上。突然，她觉得肚子里“咕噜”响了一声，小肚子变得鼓鼓胀胀的。|An'an sat in the third row with hands folded on her knees. Suddenly, her tummy gave a soft rumble and felt uncomfortably full.|Medium desk shot: An'an sits upright, but her eyebrows knit together and hands move instinctively toward her lower tummy.
“哎呀，好想去洗手间呀……”安安心里暗暗叫了一声。早上出门前喝了满满一大杯温牛奶，现在憋得好难受。|“Oh no, I really need the bathroom...” An'an thought anxiously. She had drank a full glass of milk before leaving home.|Close portrait: An'an looks worried, shifting slightly in her wooden chair, eyes darting toward the classroom door.
她想起开学第一天老师说的纪律：“上课时要保持安静，不随意走动。”安安把两只脚并得紧紧的，不敢乱动一下。|She remembered the first-day rule: “Stay quiet during class and do not wander.” An'an clamped her feet tight, afraid to move.|Low shot: An'an's legs pressed firmly together, white-red sneakers planted side by side, knees trembling with strain.
林老师翻开下一页，讲到了大鲸鱼喷出高高的水花。全班同学都笑了起来，可安安却一点儿也笑不出声来。|Teacher Lin turned the page to a whale spouting water. The class laughed in delight, but An'an could not even smile.|Medium classroom shot: other kids smiling at the book; An'an sits stiffly with pale cheeks and tense clenched fists.
随着时间的过去，肚子胀得越来越厉害，像装了一个快要吹爆的小气球。安安的额头甚至渗出了一颗颗亮晶晶的小汗珠。|As minutes ticked by, her tummy felt like a balloon stretched to bursting. Tiny beads of sweat appeared on her forehead.|Close portrait: An'an bites her lower lip, sweating softly at temple, eyes brimming with held-back tears of discomfort.
“现在举手，老师会不会当着全班同学批评我下课没去厕所？”安安心里像打鼓一样七上八下，手缩在桌子下面直打颤。|“If I raise my hand now, will the teacher scold me in front of everyone?” Her heart drummed in panic; her hands shook under the desk.|Desk view: An'an's hands clutched tightly under oak table, head bowed, feeling cornered by embarrassment.
同桌乐乐注意到了安安的不自在。乐乐侧过身，悄悄拉了拉安安的衣角：“安安，你怎么啦？脸都白了。”|Desk partner Lele noticed her discomfort. He leaned in and tugged her sleeve softly: “An'an, what's wrong? You look pale.”|Two-person desk view: Lele in mustard sweatshirt whispers with concern; An'an whispers back with tight lips.
“我想去洗手间……但我不敢举手。”安安带着哭腔小声说。|“I need the bathroom... but I'm scared to raise my hand,” An'an whispered with a catch in her throat.|Close two-person view: An'an whispers to Lele with watery eyes; Lele listens with an earnest, supportive nod.
“快举手吧！憋着肚子会生病的！林老师特别好，绝对不会凶你的。”乐乐小声给安安打气。|“Raise it now! Holding it makes your tummy sick! Teacher Lin is kind—she won't be angry at all,” Lele encouraged warmly.|Close view: Lele pats An'an's arm encouragingly, nodding toward the front; An'an looks toward the teacher.
安安深吸了一口气。她想起了妈妈说过的话：“身体不舒服时，一定要第一时间告诉大人。”|An'an took a deep breath. She remembered Mom's words: “Whenever your body feels uncomfortable, tell a grown-up right away.”|Medium shot: An'an straightens her back, taking courage, tears still lingering on lashes.
安安举起了右手。小手臂直直地伸向空中：“林老师……我想去洗手间。”声音不大，但清楚明白。|An'an raised her right arm straight up into the air. “Teacher Lin... may I go to the bathroom?” Her voice was soft, but clear.|Front classroom view: An'an raises hand high from her desk; Teacher Lin pauses storybook and looks toward her warmly.
教室里没有哄堂大笑，也没有严厉的责怪。林老师立刻放下了手里的绘本，微笑着对安安点头：“快去吧，安安！”|There was no laughter and no scolding. Teacher Lin lowered the book at once and smiled warmly: “Go right ahead, An'an!”|Medium shot: Teacher Lin gestures gently toward the door with an open, welcoming smile; class remains quiet and respectful.
“天天，你当班长，帮安安扶一下洗手间的推拉门。”老师还体贴地安排了小帮手。安安赶紧快步走出了教室。|“Tiantian, as class helper, please hold the bathroom door for An'an,” the teacher added kindly. An'an hurried out toward the hall.|Corridor view: Tiantian in sky-blue sweatshirt holds open the door; An'an steps quickly into clean, bright washroom area.
从洗手间洗好手出来，肚子的胀痛全都消失了，整个人像卸下了一块大石头一样轻松自在。|Coming out after washing her hands, the painful pressure was gone. An'an felt as light as if a heavy stone had rolled away.|Bright hallway scene: An'an dries clean hands on a paper towel, a relaxed, peaceful smile returning to her round face.
回到教室坐好，林老师走过来，悄悄把一张擦手纸递到她手心，还对她眨了眨眼睛。|Back in her seat, Teacher Lin walked over, slipped a clean dry tissue into her hand, and gave her an affectionate wink.|Two-person desk moment: Teacher Lin gently passes tissue to smiling An'an; Lele gives An'an a happy thumbs-up.
放学前，林老师对全班小朋友说：“规则很重要，但大家身体发出的红色信号最重要！任何时候想去洗手间，都可以勇敢举手！”|Before dismissal, Teacher Lin announced: “Rules are important, but body signals are most important! Raise hands anytime you need the bathroom!”|Wide classroom closing shot: Teacher Lin speaks warmly from blackboard; An'an and classmates raise hands smiling together.
''')

add('shui-bu-zhao-de-wu-xiu-xiao-chuang', '睡不着的午休小床', '安静地躺一会儿，身体也在充电',
    '睡不着也没关系；闭上眼睛轻轻呼吸，身体就会慢慢积蓄起下午的活力。',
    'It is okay if sleep does not come right away; resting quietly with closed eyes still recharges our body with energy.',
    ['大班午休', '睡眠放松', '集体适应'],
    '卸除大班孩子在集体午休中“非睡不可”的焦虑，学会不打扰他人的安静独处与身体放松。',
    '承认大班儿童睡眠需求存在个体差异，不以“必须入睡”作为乖巧标准，允许静卧休息。',
    ['安安睡不着的时候，心里在担心什么？', '就算没有睡着，闭上眼睛躺着有什么好处？'],
    '和孩子一起体验 3 分钟“静音听风”呼吸游戏：闭上眼睛，数出房间里能听到的三种细微声音。', '''
午饭后，大班的教室拉上了厚厚的鹅黄色遮光窗帘，屋子里一下子变成了柔和温暖的黄昏模样。|After lunch, the senior classroom drew its thick honey-yellow curtains, turning the room into a cozy twilight space.|Dim cozy classroom: yellow curtains drawn, soft filtered daylight, neat rows of small wooden cots laid out across the floor.
一排排小木床整整齐齐地排在地毯上。小朋友们脱掉小鞋子，钻进了各自的小被窝里。|Neat rows of low wooden cots lined the carpet. Children took off their shoes and tucked into their little blankets.|Medium wide cot scene: children climbing into beds with small colorful quilts; unworn shoes placed neatly beside beds.
安安盖着自己的淡绿色小花被子，脱掉的红白运动鞋整齐地摆在床头边的小地垫上。|An'an lay under her pale-green floral quilt, her white-red sneakers placed neatly on a small mat beside her pillow.|Low view: An'an lies on her cot with quilt pulled up to shoulders, yellow star clip placed on little bedside dish.
周围渐渐安静下来。隔壁床的小宇翻了个身，很快传出了轻微匀称的呼噜声；乐乐也把小熊抱在胸口睡熟了。|Quiet settled around them. Next door, Xiaoyu rolled over and began snoring softly; Lele hugged his plush bear fast asleep.|Medium bedroom scene: neighboring children sleeping peacefully with soft breathing; dim peaceful room.
可是，安安睁着大大的眼睛，盯着天花板上的吊扇发呆。她一点儿睡意也没有，脑子里特别清醒。|Yet An'an's eyes were wide open, gazing up at the ceiling fan. She didn't feel sleepy at all; her mind felt completely wide awake.|Close portrait: An'an lies on back, round face gazing up into the gentle dimness, clearly awake, arms inside green quilt.
安安侧过身，床板“吱呀”轻轻响了一声。这微小的声音在安静的教室里显得格外刺耳，吓得她赶紧僵住不敢动。|An'an rolled to her side, and the wooden cot creaked softly. In the quiet room, the noise felt huge, making her freeze in place.|Low bed view: An'an freezes on her side with eyes alert, worried that the sound might disturb others; dim room.
“大家都睡着了，只有我不睡觉，老师会不会觉得我是个不听话的坏孩子？”安安心里像揣了一只小兔子般不安。|“Everyone is asleep except me. Will the teacher think I'm being naughty?” An'an worried, her heart fluttering nervously.|Close-up of face: An'an presses cheek into cotton pillow, brows knit with anxiety, staring into empty dim air.
为了快点睡着，安安紧紧闭上眼睛，在心里默念数羊：“一只羊、两只羊、三只羊……”可数到了一百只，还是醒着的。|To fall asleep faster, An'an squeezed her eyes shut and counted sheep: “One sheep, two sheep, three sheep...” But at one hundred, she was still awake.|Close-up: An'an squeezes eyelids tight, facial muscles tense with the effort of forcing sleep; quilt tucked to chin.
她越是逼着自己睡觉，太阳穴就越是跳得欢，甚至觉得小枕头有点硬邦邦的，被窝里也有点热烘烘的。|The harder she forced herself, the more her temples throbbed; the pillow felt stiff and the blanket uncomfortably warm.|Medium overhead view: An'an tossing restlessly on cot, small feet kicking slightly at the blanket hem, looking miserable.
轻轻的脚步声在地毯上停下，巡视午休的林老师悄悄走了过来，在安安的小床边半蹲下来。|Gentle footsteps stopped by the carpet. Teacher Lin, patrolling the quiet room, knelt softly beside An'an's cot.|Dim intimate two-person shot: Teacher Lin in sage cardigan squats beside low bed, looking down with warm gentle eyes.
安安吓得赶紧把眼睛闭得死死的，假装已经睡熟了。但她微微颤抖的长睫毛把秘密全都透露了。|An'an quickly clamped her eyes shut, pretending to be fast asleep. But her fluttering eyelashes gave her secret away.|Close portrait: An'an feigning sleep with twitching eyelashes and tightly shut mouth; Teacher Lin's hand rests gently nearby.
林老师没有叫醒她责备，而是伸出温暖干燥的手，轻轻抚了抚安安有些汗湿的额头。|Instead of waking her with a scold, Teacher Lin reached out and gently smoothed An'an's warm, sweaty forehead.|Close shot: Teacher Lin's calm hand brushes hair from An'an's temple, soothing the furrow in her brow with tender touch.
安安慢慢睁开眼睛，难过地小声说：“老师……我努力数了一百只羊，可我还是睡不着。”|An'an opened her eyes slowly, whispering with shame: “Teacher... I counted a hundred sheep, but I just can't sleep.”|Close two-person whisper: An'an looks up tearfully from pillow; Teacher Lin bends close, smiling with serene kindness.
“睡不着一点罪过都没有呀，傻孩子。”林老师在床边坐下，温和地耳语道。|“There is nothing wrong with being unable to sleep, sweet child,” Teacher Lin whispered soothingly, sitting on the carpet.|Two-person whisper view: Teacher Lin speaks close to An'an's ear; An'an listens with wide relieved eyes.
“小身体有时候像一块充满电的小电池，不一定每次都需要关机睡着。”老师帮她把被角塞得平平整整。|“Sometimes our body is like a fully charged battery; it doesn't need to shut down every afternoon,” the teacher smoothed the quilt.|Close hands: Teacher Lin's hands tuck the pale-green quilt comfortably around An'an's shoulders without pressure.
“只要安静地闭上眼睛躺着，给小腿和小眼睛放个假，听听窗外树叶的沙沙声，身体就在默默充电呢。”老师说。|“Just resting with eyes closed gives little legs and eyes a holiday. Listening to leaves rustling still recharges you,” she said.|Medium peaceful scene: Teacher Lin points softly toward the window; An'an's tense shoulders completely melt into relaxation.
听了老师的话，安安心里那块沉甸甸的石头放下了。她不再逼自己打呼噜，只是舒服地闭上眼睛，听着微风吹动窗帘。|Hearing this, the heavy stone in An'an's heart disappeared. She stopped forcing sleep, simply resting and listening to the breeze.|Close serene portrait: An'an closes eyes naturally with a peaceful faint smile, relaxed breathing, hand resting on quilt.
不知不觉中，紧绷的身心松弛下来，在柔和的黄昏光影里，安安真的香甜地睡着了，还做了一个彩色的梦。|Without realizing it, her tension melted away. In the soft amber glow, An'an drifted into a sweet, restful dream.|Peaceful wide closing shot: An'an sleeping peacefully among neat cots; soft sunlight through yellow curtains, alarm clock nearby.
''')

add('wo-ke-yi-he-ni-men-yi-qi-wan-ma', '我可以和你们一起玩吗？', '操场上的勇敢敲门声',
    '带着自己的好点子敲门，朋友就会打开大门；即使暂时满员，也有属于自己的好玩法。',
    'Knocking with a helpful idea opens doors to play; and even when a game is full, we can always find our own joy.',
    ['同伴交往', '破冰社交', '接纳拒绝'],
    '提供实用的社交介入语言与合作策略，建立面对拒绝时的心理弹性。',
    '不替孩子强行出头包办社交，也不批评孩子“胆小不合群”。教给具体的介入话术。',
    ['安安是用什么办法加入小宇和天天的搭积木游戏的？', '如果别的小朋友游戏人满了，我们可以怎么说？'],
    '角色扮演操场社交：孩子扮演想加入游戏的小伙伴，练习带着玩具或新玩法礼貌询问。', '''
大课间铃声响起，操场上一下子沸腾起来。阳光把塑胶跑道照得暖烘烘的，微风吹着大树的绿叶。|The recess bell rang and the playground came alive. Warm sunshine bathed the running track and a breeze rustled the leafy trees.|Wide sunny playground scene: kindergarten playground with blue running track, green lawn, trees, children playing in groups.
安安手里拿着两辆自己心爱的小汽车：一辆红色小跑车，一辆黄色工程救援车。她快步来到大沙坑旁。|An'an held two favorite toy cars in her hands: a little red roadster and a yellow tow truck. She hurried over to the sandpit.|Medium outdoor view: An'an walks across playground grass holding two small toy vehicles; yellow star clip sparkling in sun.
大沙坑边上热闹非凡。小宇和天天正蹲在沙堆前，忙得热火朝天。|The sandpit was bustling. Xiaoyu and Tiantian knelt by a large sand mound, completely absorbed in their project.|Medium sandpit scene: Xiaoyu in forest green and Tiantian in sky blue build a large sand castle with moats and bridges.
他们用湿润的细沙堆起了一座高大的连环城堡，周围还用小树枝插出了一圈威风凛凛的城墙。|They shaped damp sand into a towering fortress, rimmed with dry twigs that looked like sturdy palace ramparts.|Detailed sandcastle view: elaborate sand fortress with tunnels and twig towers; boys adding wooden ramparts happily.
“这里需要一个大车库，可是沙子总往下塌！”天天一边挖洞一边着急地说。|“We need a garage tunnel here, but the sand keeps tumbling down!” Tiantian said anxiously as he dug.|Two boys at sandpit: Tiantian digging a tunnel while Xiaoyu reinforces walls with flat wooden sticks, focused expressions.
安安停在三步远的地方，看着他们那么投入，心里特别想加入他们一起玩。|An'an stopped three paces away. Watching them play with such excitement, she wished deeply to join the adventure.|Three-person composition: An'an stands hesitant in foreground clutching her two toy cars; two boys build sandcastle behind her.
可她的脚像生了根一样停在原地，手指紧紧捏着小黄车，心想：“他们玩得那么高兴，会不会嫌我麻烦？”|Her feet seemed rooted to the ground. Gripping the yellow car tightly, she thought: “Will they think I'm getting in the way?”|Close portrait: An'an watching shyly from distance, lips pressed together, clutching toys to chest with uncertain longing.
乐乐拍着皮球从旁边路过，看见安安在沙坑边转圈，跑过来问：“安安，你怎么站在这里发呆呀？”|Lele bounced his basketball by. Seeing An'an circling the sandpit, he ran over: “An'an, why are you just standing here?”|Medium shot: Lele in mustard sweatshirt holds rubber ball, looking quizzically at An'an; sandpit visible behind them.
“我想和他们一起搭城堡，但我不敢过去说。”安安低着头小声说。|“I want to build castles with them, but I'm afraid to go over and ask,” An'an whispered, looking down at her sneakers.|Two-person medium shot: An'an speaks bashfully to Lele, pointing shyly toward the sandpit; Lele listens attentively.
乐乐笑了：“光站在旁边看，别人怎么知道你想玩呢？带上你的小汽车去敲敲门，夸夸他们的城堡，再告诉他们你能帮上什么忙！”|Lele grinned: “If you just stand watching, how will they know you want to play? Bring your cars over to knock on their door, praise their castle, and tell them how you can help!”|Two-person shot: Lele points encouragingly at the sandcastle and An'an's toy cars, giving her helpful tips with open friendly gestures.
安安深吸了一口气，迈开步子走到了沙坑边缘。两个小男孩正专心地修筑护城河，没有注意到她。|An'an took a steady breath and stepped up to the edge of the sandpit. The two boys were busy digging and hadn't noticed her yet.|Medium ground-level shot: An'an stands at the wooden border of the sandpit looking down at the two boys working.
安安清了清嗓子，大声说：“哇！你们搭的沙子城堡真壮观，像一座真的石头王宫！”|An'an cleared her throat and spoke clearly: “Wow! Your sand castle is amazing—it looks like a real stone fortress!”|Medium three-person scene: An'an speaks with open, friendly smile; Xiaoyu and Tiantian look up surprised from their digging.
两个小男孩抬起头来，脸上沾着沙粒，听到称赞，眼睛都亮了起来：“真的吗？我们修了一整个大课间呢！”|The two boys looked up with sandy smudges on their cheeks. Hearing the compliment, their eyes lit up with pride: “Really? We worked so hard!”|Low angle from sandpit: Xiaoyu and Tiantian wipe sandy hands on knees, smiling happily at An'an's praise.
安安趁机蹲下来，举起手里的小黄车：“我可以和你们一起玩吗？我带了工程救援车，可以帮你们架一座不会塌的塑料吊桥！”|An'an seized the moment, crouching down: “May I play with you? I brought my tow truck to build a bridge that won't collapse!”|Ground-level medium view: An'an crouches beside sandpit, offering her yellow toy crane car across the sand moat.
小宇眼前一亮，高兴得直拍手：“太好了！我们刚才正愁没有结实的桥面呢！大工程师，快来这边！”|Xiaoyu's eyes widened and he clapped with glee: “Awesome! We were just wishing for a bridge! Come on over, Chief Engineer!”|Excited group composition: Xiaoyu beckons warmly; Tiantian clears a smooth sandy bank for An'an's truck.
天天也把一把小铲子递给安安：“你来负责挖西边的深水渠，我们给救援车开一条平整的大道！”|Tiantian handed a mini plastic shovel to An'an: “You can dig the west canal, and we'll pave a smooth road for your truck!”|Low action shot: children working together in sand; An'an digs canal with shovel while Xiaoyu places toy car across twigs.
三只小手在细沙里忙碌着，安安的小汽车稳稳地停在了城堡顶端，小树枝搭成的吊桥坚固又漂亮。|Three pairs of hands bustled in the sand. An'an's little cars perched safely on the battlements, linked by a lovely twig bridge.|Close detailed shot: completed sand castle with yellow crane truck and red car parked atop, twig bridge crossing neat sand moat.
过了一会儿，又有两个别班的小朋友想加入运沙子。沙坑边已经挤满了人，工具也分完了。|Later, two other children ran up wanting to carry sand. But the pit was already crowded and all tools were in use.|Wide playground scene: two new kids approach crowded sandpit where four children are already playing together.
小宇礼貌地对他们说：“现在沙坑有点挤，工具也不够啦。等下一节大课间，我们换班让你们当第一组，好吗？”|Xiaoyu said politely: “It's quite crowded right now and we're out of shovels. Next recess, we'll let you be group one, okay?”|Medium shot: Xiaoyu explains gently to approaching children; the newcomers nod cheerfully and head toward swings.
安安看着他们，心里明白了一个大秘密：主动敲门不仅能找到好朋友，而且学会理解和礼貌拒绝，也是长大的本领。|Watching them, An'an learned a valuable lesson: knocking bravely opens doors to friendship, and handling turns with grace is growing up too.|Sunny closing shot: An'an, Xiaoyu, Tiantian, and Lele sit side by side on playground grass smiling happily around sand castle.
''')

add('wo-de-xiao-shu-bao-jin-tian-zi-ji-shou', '我的小书包，今天自己收', '给铅笔和水壶找个固定的家',
    '自己收拾的小书包最懂你；给每样东西固定一个家，找起来就不慌张。',
    'A backpack packed by ourselves knows us best; giving everything a home keeps our day calm and steady.',
    ['自主整理', '物品自理', '幼小衔接'],
    '建立自主分类、核对与归位的自理习惯，培养对个人学具的掌控感与责任心。',
    '初始阶段允许丢三落四，不代劳包办也不暴躁数落。用打卡清单和固定收纳位帮助建立秩序。',
    ['安安是用什么小帮手把书包里的东西检查整齐的？', '你的水壶和铅笔盒，最喜欢住在书包的哪个小格子里？'],
    '和孩子一起绘制一张专属的“每日书包检查图卡”，放学后练习自己按图装包。', '''
吃过晚饭，客厅的大茶几上乱糟糟的。彩笔盒打开着，跳绳拖在地上，橙色小书包张着大嘴巴躺在沙发上。|After dinner, the living room coffee table was in a jumble. Markers lay open, a jump rope trailed on the floor, and the orange backpack sat wide open.|Messy living room scene: coffee table scattered with open pencil case, crayons, jump rope; open orange backpack on sofa.
以往每天晚上，都是妈妈一边念叨，一边把文具和水壶塞进书包里。安安只要背上就走。|In the past, Mom always packed the backpack every evening, checking each item while An'an simply picked it up in the morning.|Flashback domestic scene: Mom in coral cardigan kneeling by sofa packing items into bag while An'an plays with toy car on rug.
可今天，妈妈坐在沙发边，微笑着递给安安一张画满可爱小图画的硬纸卡片：“大班的小朋友，要开始有属于自己的小掌柜本领啦！”|Tonight, Mom sat by the sofa and handed An'an a colorful card with cute illustrations: “Senior class students can be the master of their own bag!”|Medium two-person shot: Mom hands an illustrated checklist card to An'an; An'an examines the drawing with curious interest.
卡片上画着五个可爱的小格子：五支削好的铅笔、一块橡皮、一个小水壶、一包小纸巾、还有一本借阅绘本。|The card showed five neat little compartments: five sharp pencils, an eraser, a water bottle, pocket tissues, and a library book.|Close view of checklist card: five illustrated compartments with icon drawings of pencil, eraser, bottle, tissue, and book.
“这是书包检查小雷达！”妈妈说，“每一个小东西，在书包里都要有一个固定的房间，不能乱串门。”|“This is your backpack checklist radar!” Mom said. “Every item needs its own permanent room inside the bag so nothing gets lost.”|Close two-person conversation: Mom points to the different compartments of the open orange backpack; An'an listens eagerly.
安安来了兴致。她先把小书包搬到地毯上，把所有口袋的拉链全都拉开，认真数了数：“大口袋、前口袋、还有左右两个网眼袋！”|An'an felt excited. She carried the bag to the rug, unzipped every pocket, and counted: “Main pocket, front pocket, and two side mesh pockets!”|Low floor shot: An'an sits cross-legged on rug examining pockets of orange backpack; neat living room carpet.
“第一间房，住重重的大块头。”安安把厚厚的大鲸鱼绘本平平整整地放进最贴着后背的大隔层里。|“Room one is for heavy things.” An'an slid the thick picture book flat against the back panel in the main compartment.|Close overhead shot: child's hands carefully slide a hardbound picture book deep into the main sleeve of the orange backpack.
“第二间房，住铅笔盒朋友。”安安打开铁皮笔盒，检查里面的铅笔：一支、两支……五支！笔尖都削得尖尖齐齐的。|“Room two is for the pencil box.” An'an opened the metal case to inspect her pencils: one, two... five! All sharpened neatly.|Tabletop view: An'an counts five sharp pencils in neat metal tin; eraser nestled snugly in its foam slot.
合上笔盒，安安把它放在绘本前面，还把红色的跳绳卷成一个圆圆的小面包圈，塞进侧面的空隙里。|Closing the box, An'an tucked it in front of the book and rolled her jump rope into a tidy donut to fit the gap.|Overhead packing view: neat arrangement inside main compartment: book at back, pencil tin in middle, coiled jump rope at side.
前拉链口袋很小，安安把印着小草莓图案的便携纸巾装了进去：“擦嘴巴的时候，一拉拉链就能拿到！”|The front zipper pocket was small. An'an placed her strawberry pocket tissue inside: “Easy to grab whenever I need to wipe my face!”|Close view of front pocket: An'an zips small tissue packet into the front pouch, sliding the zipper shut with a smooth pull.
现在轮到水壶了。安安跑到厨房，在爸爸的帮助下接了半壶温开水，稳稳拧紧盖子，再擦干外壳的水珠。|Now for the water bottle. An'an went to the kitchen; with Dad's help, she filled it with warm water and tightened the cap.|Kitchen counter scene: Dad in navy sweater helps An'an tighten lid on blue water bottle; no spilling, warm lighting.
安安把水壶塞进书包左边的松紧网袋里，还特意拉了拉卡扣：“卡紧啦，跑步的时候它就不会跳水游泳啦！”|An'an slipped the bottle into the left mesh pocket and clicked the security strap: “Locked tight! It won't leap out when I run!”|Close-up of side pocket: An'an fastens small plastic buckle over top of water bottle; bottle rests securely upright.
东西都装好了，安安拿起妈妈做的小雷达卡片，伸出右手食指，一项一项在上面打勾检查。|With everything packed, An'an took Mom's radar card and used her finger to check off each item one by one.|Medium shot: An'an sits on floor holding checklist card, pointing finger at each item: “Pencils—checked! Water bottle—checked!”
“绘本有了，铅笔有了，水壶有了，纸巾有了，跳绳也在！”安安拉上大书包的拉链，得意地拍了拍鼓鼓的书包肚子。|“Book—check! Pencils—check! Water—check! Tissues and rope—check!” An'an zipped the main pocket, patting its tidy tummy.|Bright portrait: An'an stands up, proudly patting the neatly zipped orange backpack; Mom smiles with thumbs-up from sofa.
第二天早上到学校，老师要求大家拿出跳绳做早操。别的小朋友翻箱倒柜找了半天，有的甚至忘记带了。|The next morning at school, the teacher called for jump ropes for exercise. Some kids searched in panic; some had forgotten theirs.|Classroom locker scene: other children rummaging through messy bags; An'an walks up calmly to her cubby.
安安轻轻拉开书包拉链，伸手一探，一下子就摸出了卷得整整齐齐的跳绳，第一个站到了教室门口的队伍里。|An'an pulled her zipper, reached in, and instantly pulled out her coiled rope, becoming the very first in line by the door.|Corridor line-up shot: An'an stands at head of line holding her neat red jump rope, smiling with genuine confidence.
课间小宇流鼻涕急着找纸巾，安安一秒钟就从前口袋抽出一张递过去：“给！我的小书包可神奇啦，什么都住在固定的家！”|At recess when Xiaoyu had a runny nose, An'an pulled a tissue from her front pouch in an instant: “Here! Everything in my bag has a home!”|Classroom hallway view: An'an hands tissue to Xiaoyu in forest green; Xiaoyu smiles gratefully.
放学回到家，安安把书包挂在门边的专用木挂钩上，认真地对妈妈说：“自己的书包自己管，这种感觉真神气！”|Back home, An'an hung her bag on the wooden entryway hook, declaring proudly: “Taking care of my own bag feels truly wonderful!”|Entryway ending shot: An'an hangs orange backpack on low wooden wall peg beside front door; Mom hugs her shoulders warmly.
''')

add('jin-tian-wo-shi-da-ban-zhi-ri-sheng', '今天我是大班值日生', '照顾班级植物角与分发餐具',
    '服务大家是一件神气的事；不小心洒了水没关系，擦干净依然是最棒的值日生。',
    'Helping everyone feels wonderful; spilling water is okay, and wiping it clean makes a truly responsible helper.',
    ['值日服务', '集体责任', '劳动意识'],
    '激发大班幼儿作为班级主人的责任感，体会劳动与帮助同伴带来的价值感。',
    '鼓励参与日常劳动，不以惩罚手段安排值日。在孩子出现失误时指导补救，保护劳动热情。',
    ['安安给绿萝浇水洒出来时，她是怎么做的？', '听到大家说“谢谢安安姐姐”时，安安心里感觉怎样？'],
    '在家里设置一日“家庭小小值日生”，由孩子负责餐前分发筷子或给阳台盆栽喷水。', '''
今天一进大班教室，林老师就在黑板的值日表上插上了安安和天天的小照片。|Stepping into the senior classroom today, Teacher Lin placed photo cards of An'an and Tiantian onto the duty roster.|Bright classroom morning view: wooden blackboard with duty board; Teacher Lin places An'an's photo card into the top slot.
林老师给安安的左胳膊套上印着金色小星的红袖标：“今天你是大班值日生哦！”安安把小胸脯挺得高高的，心里格外神气。|Teacher Lin pinned a red helper badge with a golden star onto An'an's arm: “Today you are our class duty helper!” An'an puffed her chest proudly.|Medium shot: Teacher Lin fits red badge onto An'an's teal hoodie sleeve; An'an stands tall with joyful beaming pride.
第一项任务是照顾走廊阳台旁的班级植物角。窗台上有几盆吊兰，还有两盆绿油油的大叶绿萝。|The first task was tending the class plant corner by the sunny veranda: hanging spider plants and lush green pothos pots.|Veranda plant corner view: sunlight streaming onto wooden shelves filled with potted green plants and blooming flowers.
安安接来一小喷壶清水，认认真真地给绿萝的叶子喷水。小水珠落在翠绿的叶面上，像一颗颗滚动的珍珠。|An'an filled a mini watering spray with clear water and sprayed the leaves. Droplets rested on green leaves like shiny pearls.|Close view: child's hands pump small green spray bottle, misting wide green leaves; sunlight making droplets sparkle.
浇到最后一盆大薄荷时，水壶有点沉，安安小手一晃，“哗啦”一声，小半壶水洒在了光洁的木地板上，积了一小摊水洼。|On the last mint pot, the watering can was heavy. An'an's hand slipped, splashing half the water onto the floor into a puddle.|Floor view: small puddle of clear water on wooden floorboards; An'an stands holding watering can, eyes startled.
“哎呀！”天天在旁边喊了一声，“安安把水弄洒啦，老师会不会收走你的小红袖标呀？”|“Uh oh!” Tiantian gasped nearby. “You spilled the water, An'an! Will the teacher take away your helper badge?”|Two-person view: Tiantian looks concerned; An'an bites lip, clutching the green spray bottle, afraid she messed up her duty.
安安低下头看胳膊上的小红袖标，心里有些发慌。但她很快想起了妈妈的话：“做事情遇到意外，先想办法补救！”|An'an looked down at her red badge, heart fluttering. But she remembered Mom's advice: “When accidents happen, fix them first!”|Close portrait: An'an pauses, taking a steadying breath; panic giving way to purposeful determination.
安安把喷壶稳稳放在花架上，快步跑到卫生角，拿来了一把小拖把和两块干抹布。|Setting the watering can safely on the plant stand, An'an trotted to the cleaning corner to fetch a mini mop and dry towels.|Classroom corner: An'an picks up small wooden mop and clean dry cleaning cloth from the neatly organized cleaning rack.
她先把抹布铺在水洼最深的地方吸干水分，再用小拖把一下一下，把湿漉漉的地面拖得干干净净、光可鉴人。|She laid the towel over the puddle to soak up the water, then used the mini mop to buff the damp boards dry and shiny.|Low action shot: An'an kneeling smoothly wipes floor with cloth, then mops evenly; floorboards gleam clean without slip hazards.
林老师走过来，看见整洁如新的植物角和干爽的地面，蹲下来摸摸安安的头：“安安，你不仅把植物照顾得好，还把意外处理得这么漂亮！”|Teacher Lin walked over. Seeing the clean plant corner and dry floor, she patted An'an's head: “You solved the mishap wonderfully!”|Two-person warm shot: Teacher Lin smiles approvingly at An'an; floorboards clean and plants glistening with fresh mist.
到了中午分饭时间，天天负责分餐盘，安安负责给每个餐桌分发不锈钢小汤勺。|At lunchtime, Tiantian distributed lunch trays while An'an was in charge of handing out clean stainless steel soup spoons.|Classroom dining scene: small dining tables set up; Tiantian lays trays while An'an carries basket of shiny spoons.
安安先用洗手液把两只手洗得干干净净，双手捧着装满勺子的小篮子，挨个走到每张桌子旁。|An'an washed her hands thoroughly with soap, held the basket of spoons in both hands, and walked carefully to each table.|Medium dining room shot: An'an carries clean wicker basket with both hands, apron tied around waist, stepping carefully.
她拿起勺子时，总是捏着勺柄中间，把圆圆的勺头干净地朝向小朋友面前，轻轻摆在托盘右侧。|Taking each spoon, she held it by the handle, placing the bowl cleanly facing forward beside each child's tray.|Close-up of dining table: An'an's hands carefully set down clean spoon beside porcelain bowl; respectful sanitary handling.
“谢谢安安姐姐！”小班刚升上来的小同伴脆生生地喊道。安安甜甜地回了一句：“不客气，请慢用哦！”|“Thank you, Sister An'an!” a younger classmate chirped cheerfully. An'an replied with a beam: “You're welcome, enjoy your lunch!”|Two-person dining moment: younger child smiles up from tray; An'an nods with warm, mature sisterly warmth.
听到大家的一声声感谢，安安心里像喝了蜜糖水一样甜滋滋的。胳膊上的小红袖标，在阳光下显得更神气了。|Hearing their thank-yous, An'an's heart felt as sweet as honey. The red helper badge on her sleeve seemed to shine brighter than ever.|Portrait: An'an wiping sweat from forehead with the back of her wrist, looking around the orderly room with deep satisfaction.
下午离园前，安安和天天一起把散落的积木整齐归类到收纳筐里，把每把小椅子推进课桌下面摆整齐。|Before leaving, An'an and Tiantian sorted stray blocks into storage bins and tucked every small wooden chair neatly under desks.|Classroom wide view: neat rows of tucked-in chairs, tidy block shelves; An'an and Tiantian dusting down reading tables together.
摘下红袖标交给老师时，林老师给安安额头上贴了一颗金色小星星：“今天的大班值日生，表现满分！”|Handing back the armband, Teacher Lin pressed a golden star sticker onto An'an's forehead: “Today's helper did a perfect job!”|Close-up moment: Teacher Lin affixes gold foil star to An'an's forehead; An'an smiles broadly, red armband resting neatly on desk.
安安蹦蹦跳跳走出教室，心里想：明天就算不当值日生，我也要主动把植物角照顾好！|An'an hopped cheerfully out of the room, thinking: Even when I'm not on duty tomorrow, I'll still look after our plants!|Exit hallway closing shot: An'an walks toward gate with bounce in her step, gold star on forehead, glowing with pride.
''')

add('fang-xue-lu-shang-man-man-shuo', '放学路上，慢慢说', '打开话匣子的小秘密',
    '快乐可以一起分享，疲惫可以一起分担；温暖的倾听，让每天都安心收尾。',
    'Joys are meant to be shared and tiredness can be carried together; gentle listening brings our day to a peaceful close.',
    ['亲子沟通', '离园过渡', '情绪倾听'],
    '建立高质量的离园亲子沟通模式，用轻松的分享引导孩子主动敞开心扉。',
    '避免在孩子刚离园、能量低谷时进行盘问考核。先满足身体需求，以家长的自我袒露带动倾听。',
    ['妈妈在长椅上先跟安安分享了什么趣事？', '今天放学路上，你最想跟爸爸妈妈聊哪一件开心的小事？'],
    '开启晚餐或睡前的“今天的三件小事”时光：轮流说出一件开心的事、一件不容易的事和一件感谢的事。', '''
四点一刻，放学铃声响彻整个校园。安安背着橙色小书包，迈着小步子走出了幼儿园的大铁门。|At four fifteen, the dismissal bell rang through the school. An'an walked out of the big gates with her orange backpack.|Sunny kindergarten gate scene: children and parents greeting each other near gates; An'an walks out with slightly weary shoulders.
一整天在大班唱歌、画画、写数字、当值日生，安安觉得小脑袋胀胀的，两条小腿像灌了铅一样没力气。|After a full day of singing, drawing, numbers, and helper duty, An'an felt worn out, her legs as heavy as lead.|Medium street view: An'an walking slowly on the sidewalk, head tilted slightly down, orange backpack bouncing softly.
校门口，妈妈接过书包连珠炮似地问：“今天在学校乖不乖？老师提问你了吗？青菜吃光了吗？”安安的小脸缩得紧紧的。|At the gate, Mom took the backpack and asked in a rush: “Were you good today? Did the teacher call on you? Did you eat your greens?” An'an drew back.|Two-person street shot: Mom carries backpack, bending down with eager quizzing eyes; An'an looks overwhelmed and tight-lipped.
安安被问得头昏脑涨，原本想说的话一下子全缩回了肚子里。她低着头，小声哼哼：“没怎么样……不知道。”|Overwhelmed by the flood of questions, An'an's words retreated. She looked down at her toes, mumbling: “Nothing... I don't know.”|Close profile: An'an looking down at pavement with closed expression, shoulders drooping in fatigue; Mom pauses.
妈妈看出了安安眉宇间的疲惫。她停下脚步，没有继续追问，而是轻轻牵住安安有些微凉的小手。|Mom noticed the fatigue in An'an's eyes. She stopped questioning at once, gently clasping An'an's cool hand in hers.|Warm two-person shot on tree-lined street: Mom stops walking, takes An'an's hand warmly without pulling or scolding.
“前面小公园的长椅上有阳光，我们去坐一会儿好不好？”妈妈温和地提议。安安默默点了点头。|“The park bench ahead has lovely sunshine. Let's sit for a while, shall we?” Mom suggested gently. An'an nodded in silence.|Street perspective: leafy sidewalk leading toward a sunlit wooden bench under golden autumn trees; mother and daughter walking softly.
两人坐在木长椅上，暖洋洋的夕阳照在身上很舒服。妈妈从帆布包里拿出一个小保鲜盒，里面是两块温热的小松饼。|They sat on the bench under the soothing golden sun. Mom brought out a small warm container with two homemade pancakes.|Sunny park bench shot: Mom opens small food container, offering a warm golden pancake to An'an; green park lawn behind.
安安咬了一口甜甜的松饼，嚼得香喷喷的，肚子里暖和起来，整个人渐渐有了力气。|An'an took a bite of the sweet warm pancake. As warmth spread through her tummy, her energy began to return.|Close shot on bench: An'an munches happily on pancake, cheeks pinkening again in afternoon sunlight; Mom watches tenderly.
妈妈没有提学校的事，而是先笑嘻嘻地讲起了自己：“安安，你知道妈妈今天在办公室干了什么傻事吗？”|Instead of asking about school, Mom smiled and shared her own day: “An'an, do you know what silly thing I did at work today?”|Two-person bench conversation: Mom gestures comically with hands; An'an turns her head with growing amusement.
“我端咖啡的时候，脚下一滑，把整杯咖啡洒在了自己的鞋面上！你看，鞋边上还有一点小咖啡斑呢！”妈妈指了指鞋。|“I slipped while carrying coffee and spilled it all over my shoe! Look, there's still a tiny coffee spot right here!” Mom pointed to her sneaker.|Medium bench view: Mom lifts shoe showing a tiny coffee mark, laughing at herself; An'an's eyes sparkle with laughter.
“噗嗤——”安安忍不住笑出声来，“妈妈，你也是个小马虎呀！”气氛一下子变得轻松自在极了。|“Pfft—” An'an burst out laughing. “Mom, you're a clumsy goose too!” The air instantly turned light and easy.|Close portrait: An'an giggles with hand over mouth, pancake in other hand, eyes creased with pure happiness.
咽下最后一口松饼，安安自己主动拉了拉妈妈的袖子：“妈妈，我今天在学校也有一件超好笑的事想告诉你！”|Finishing her pancake, An'an tugged Mom's sleeve on her own: “Mom, something super funny happened in my class today too!”|Warm two-person moment: An'an turns excitedly toward Mom, gesturing animatedly with her small hands.
话匣子一打开，像倒豆子一样停不下来：“乐乐今天做操的时候，鞋带松了踩到鞋带，摔了个大屁墩儿！”|Once open, the words tumbled out like happy beans: “Lele tripped on his shoelace during morning exercise and fell on his bottom!”|Medium bench shot: An'an talks with joyful animation, describing the scene with gestures; Mom listens with chin on hand, beaming.
“还有呢，我今天第一次当了大班值日生，给绿萝喷了水！老师还给我额头贴了一颗金色大星星呢！”安安指了指额头。|“And I was duty helper today, spraying the pothos plants! The teacher put a gold star right on my forehead!” An'an pointed to her brow.|Close view: An'an points proudly to the shiny gold star sticker on her temple, telling the story with sparkling eyes.
妈妈认真地听着，时不时点点头，发出“哇，太能干了”的赞叹。她没有打断，只是安静地陪着安安说完每一句话。|Mom listened intently, nodding and murmuring praises. She never interrupted, simply letting An'an finish every happy sentence.|Two-person medium shot: Mom gazes at An'an with complete loving attention, hair glowing in sunset backlighting.
夕阳把母女俩的影子拉得长长的。安安拉着妈妈的手，一蹦一跳地走在回家的林荫道上。今天的小故事，讲得又满又暖。|The setting sun cast their shadows long on the path. An'an skipped along holding Mom's hand; today's stories were warm and complete.|Warm closing wide shot: mother and daughter walk hand-in-hand along tree-shaded sidewalk toward home, bathed in golden dusk light.
''')

CHARACTERS = {
    "An'an": "An'an is a six-year-old Chinese GIRL, round face, ear-length straight black bob, yellow star hair clip on her left, plain teal zip-front hoodie, blue jeans, white sneakers with red trim and white laces. Preserve her female identity.",
    'Mom': 'Mom is an adult Chinese woman, shoulder-length black hair, coral cardigan and cream trousers.',
    'Dad': 'Dad is an adult Chinese man, short black hair, navy sweater and beige trousers.',
    'Lele': 'Lele is a six-year-old Chinese boy with short black hair, mustard sweatshirt and navy trousers.',
    'Xiaoyu': 'Xiaoyu is a six-year-old Chinese boy, short black hair, forest-green sweatshirt, charcoal trousers; distinct from Lele.',
    'Tiantian': 'Tiantian is a six-year-old Chinese boy, short black hair, sky-blue sweatshirt, navy trousers; distinct from Lele and Xiaoyu.',
    'Teacher Lin': 'Teacher Lin is an adult Chinese woman, hair in a neat low bun, sage-green cardigan and dark grey trousers.',
}

def image_jobs(kit):
    jobs = []
    for b in BOOKS:
        for page, (_, _, scene) in enumerate(b[-1], 1):
            cast = [description for name, description in CHARACTERS.items() if name in scene]
            prompt = '\n'.join([
                kit['globalStyle'],
                'Asset type: one individual full-bleed square picture-book illustration, one coherent scene, never a multi-panel sheet.',
                *cast,
                'Draw ONLY the people named in this page scene. Keep identities, faces, hair and clothing consistent. No additional family members or bystanders. Kindergarten Big Class classroom, wooden furniture, low shelves, green plants, bright friendly atmosphere.',
                "THIS PAGE'S SCENE: " + scene,
                'Follow current object state literally. Do not anticipate later events. Match the requested camera view, natural hands and subtle readable feelings. Distressed, frozen, angry or disappointed children must not smile.',
                'Avoid: ' + kit['negative'],
            ])
            jobs.append(dict(id=b[0], page=page, prompt=prompt))
    return jobs

def main():
    target = ROOT / 'content-drafts/richang'
    existing = [target / f'{book[0]}.json' for book in BOOKS if (target / f'{book[0]}.json').exists()]
    if existing or (target / 'batch-41-50').exists():
        raise SystemExit('Batch already exists; edit the reviewed JSON drafts instead of overwriting production work.')
    kit = json.loads((target / 'lan-ping-guo.json').read_text())['imagePromptKit'].copy()
    kit['characterConsistency'] += ' Teacher Lin: hair in neat low bun, sage-green cardigan, dark grey trousers. Tiantian: same-age Chinese boy, sky-blue sweatshirt, navy trousers. Only page-specific cast appears.'

    expected = [18, 18, 18, 18, 18, 18, 20, 18, 18, 16]
    assert len(BOOKS) == len(expected), f"Expected {len(expected)} books, got {len(BOOKS)}"
    assert sum(expected) == 180, f"Expected 180 pages, got {sum(expected)}"

    for b, count in zip(BOOKS, expected):
        assert len(b[-1]) == count, f"{b[1]} has {len(b[-1])} pages, expected {count}"
        assert len({p[0] for p in b[-1]}) == count, f"{b[1]} has duplicate page texts"

    for index, (slug, title, subtitle, moral, moral_en, tags, goal, reminder, questions, activity, pages) in enumerate(BOOKS):
        order = index + 41
        book = dict(
            id=slug, seriesId='richang', title=title, subtitle=subtitle,
            moral=dict(zh=moral, en=moral_en), ageLabel='4–8 岁', publishedAt='2026-10-22', order=order,
            comingSoon=True,
            pages=[dict(page=i, zhText=zh, enText=en, illustrationPrompt=scene, imageStatus='pending') for i, (zh, en, scene) in enumerate(pages, 1)],
            metadata=dict(
                category='family-growth', ageRange=dict(min=4, max=8), estimatedMinutes=6,
                languages=['zh', 'en'], seriesId='richang', seriesOrder=order, personalizationEnabled=False,
                tags=['日常系列', '生活智慧', '亲子共读', '幼小衔接', '大班生活', *tags], featured=False, bedtimeSuitable=True
            ),
            parentGuide=dict(
                goal=goal, reminder=reminder, questions=questions, activity=activity,
                ageTips=dict(
                    age4to5='允许孩子用指图、点头、手势等非语言方式表达；共读以倾听、感受安抚为主，不强求马上做到。',
                    age6to8='讨论大班一日生活中的真实感受与解决策略，鼓励孩子自己提出小行动，家长承担托底支持与陪伴责任。'
                )
            )
        )
        (target / f'{slug}.json').write_text(json.dumps(dict(book=book, imagePromptKit=kit), ensure_ascii=False, indent=2) + '\n')

    batch = target / 'batch-41-50'
    batch.mkdir(exist_ok=True)
    plan = [dict(id=b[0], title=b[1], pages=len(b[-1]), order=i + 41) for i, b in enumerate(BOOKS)]
    (batch / 'plan.json').write_text(json.dumps(dict(approved=True, approvedAt='2026-10-22', totalPages=180, books=plan), ensure_ascii=False, indent=2) + '\n')

    manuscript = ['# 日常系列第五批逐页文稿与分镜（大班幼小衔接篇）\n\n用户已于 2026-10-22 确认 10 本选题。插图与中文旁白按最终逐页正文制作。\n']
    for b in BOOKS:
        manuscript.append(f'## {b[1]}\n\n副标题：{b[2]}\n\n寓意：{b[3]}\n\n亲子目标：{b[6]}\n\n家长提醒：{b[7]}\n')
        for i, (zh, en, scene) in enumerate(b[-1], 1):
            manuscript.append(f'### 第 {i} 页\n\n{zh}\n\n{en}\n\n分镜：{scene}\n')
        manuscript.append('共读问题：\n' + '\n'.join(f'- {question}' for question in b[8]) + f'\n\n小活动：{b[9]}\n')
    (batch / 'manuscript.md').write_text('\n'.join(manuscript))

    (batch / 'image-prompts.json').write_text(json.dumps(image_jobs(kit), ensure_ascii=False, indent=2) + '\n')

    progress = dict(
        manuscripts="complete",
        totalPages=180,
        imagesComplete=0,
        narration="pending",
        books=[dict(id=b[0], title=b[1], pages=len(b[-1]), order=i + 41, completeImages=0, narration="pending", locallyReadable=False) for i, b in enumerate(BOOKS)],
        uploaded=False,
        deployed=False,
        status="manuscripts-ready",
        createdOn="2026-10-22"
    )
    (batch / 'progress.json').write_text(json.dumps(progress, ensure_ascii=False, indent=2) + '\n')
    print(f'Successfully built 10 books in batch-41-50 with {sum(expected)} bilingual pages!')

if __name__ == '__main__':
    main()
