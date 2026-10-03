"""Save the user-approved fourth everyday batch; never overwrite finished work."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BOOKS = []


def add(slug, title, subtitle, moral, moral_en, tags, goal, reminder, questions, activity, rows):
    pages = [tuple(part.strip() for part in row.split('|')) for row in rows.strip().splitlines() if row.strip()]
    assert all(len(page) == 3 and all(page) for page in pages), title
    BOOKS.append((slug, title, subtitle, moral, moral_en, tags, goal, reminder, questions, activity, pages))


add('ma-ma-ni-shi-zai-xiong-wo-ma', '妈妈，你是在凶我吗', '声音轻一点，我听得更清楚',
    '可以说出被大声音吓到的感受；大人也可以放低声音，重新把事情说清楚。',
    'We can say when a loud voice frightens us, and grown-ups can lower their voices and explain again.',
    ['声音与感受', '亲子沟通', '关系修复'],
    '让孩子辨认声音带来的感受，成人承担调节语气和修复沟通的责任。',
    '不要求孩子忍受吼叫来证明懂事，也不以大人着急为伤人语气开脱。紧急危险由成人先保护安全，事后仍要说明。',
    ['妈妈声音变大时，安安的身体有什么变化？', '想请别人轻一点说话，你愿意怎样告诉他？'],
    '大人用两种温和的音量说同一句普通提醒，让孩子选择听着舒服的方式，并约好一个轻声提醒的手势。', '''
周末出门前，安安正给小车找一个停车位。妈妈已经拿好了帆布包。|Before their weekend outing, An'an was finding a parking spot for her toy car. Mom already had the canvas bag.|Wide sunny home entryway: An'an crouches beside a small red toy car and oak shoe bench; Mom waits holding a plain cream canvas bag.
小车刚停好，又滑出来一点。安安蹲下来，想把它放得更稳。|The car rolled out a little. An'an crouched down to put it somewhere steadier.|Low close view: An'an gently steadies the red toy car beside the shoe bench, concentrating; only An'an visible.
妈妈看了看钟，声音一下变大了：“安安，快一点！我们要出门啦！”|Mom looked at the clock, and her voice suddenly grew loud. “An'an, hurry! It's time to go!”|Medium entryway: Mom calls with tense shoulders while holding canvas bag; An'an looks up startled beside red toy car; no angry pointing.
安安的手停在半空。肩膀缩了起来，刚才想说的话也缩了回去。|An'an's hand stopped in midair. Her shoulders drew inward, and the words she wanted to say seemed to hide too.|Close portrait: An'an's hand pauses above red toy car, shoulders drawn inward, startled watery eyes; no Mom in frame.
她低着头，坐到小凳子上。鞋就在脚边，她却迟迟没有动。|She sat on the little bench with her head down. Her shoes were beside her feet, but she did not move.|Medium low entryway view: An'an sits withdrawn on oak shoe bench, head bowed and eyes down toward floor, sad closed mouth, NO SMILE, plain white socks; unworn white red-trim sneakers beside her feet, red toy car under bench.
妈妈走近时，安安小声问：“妈妈，你是在凶我吗？”|When Mom came closer, An'an whispered, “Mom, are you being cross with me?”|Two-person intimate entryway shot: seated An'an looks up uncertainly; Mom bends closer with concerned expression, canvas bag on floor.
妈妈停住了。她蹲下来，看见安安紧紧攥着衣角。|Mom stopped. She crouched down and saw An'an gripping the edge of her hoodie.|Close two-person view at child eye level: Mom notices An'an's hands gripping teal hoodie hem, both faces readable.
“刚才我着急，声音太大，吓到你了。”妈妈轻声说，“对不起。”|“I was in a hurry, and my voice got too loud. It frightened you,” Mom said softly. “I'm sorry.”|Medium eye-level entryway: Mom crouches with relaxed open hands and apologetic face; An'an listens on bench, no forced embrace.
安安没有马上笑。她松开一点衣角：“我以为，你觉得我很烦。”|An'an did not smile right away. She loosened her grip a little. “I thought you found me annoying.”|Close An'an seated on bench, fingers gradually releasing hoodie hem, small tear and hesitant expression; Mom's listening profile visible.
“你不是很烦。”妈妈说，“我想提醒出门的时间，可是刚才没有好好说。”|“You aren't annoying,” Mom said. “I wanted to remind you about leaving, but I didn't say it kindly.”|Medium conversation: Mom listens and explains gently at An'an's height, round wall clock softly blurred behind them, no written markings.
妈妈重新说了一遍：“我们该穿鞋了。你的小车，还需要我帮哪一点？”|Mom tried again. “It's time to put our shoes on. Do you need any help with your car?”|Two-person low shot: Mom gestures gently toward white red-trim shoes and red toy car, An'an begins to respond.
“它总滑出来。”安安指了指凳子下面。原来，那里有一小块斜斜的地毯。|“It keeps rolling out,” An'an said, pointing beneath the bench. A small edge of the rug was tilted there.|Close floor view: An'an points to folded rug edge beneath red toy car; Mom's hand rests nearby, no extra people.
她们把地毯铺平，小车终于停稳了。安安这才伸手拿鞋。|They flattened the rug, and the car finally stayed put. Then An'an reached for her shoes.|Low medium entryway: Mom smooths rug while An'an picks up white red-trim sneaker; red toy car rests motionless beneath bench.
“你小声一点，我也能听见。”安安说。妈妈点点头：“我记住了。”|“I can hear you when you speak more quietly too,” An'an said. Mom nodded. “I'll remember.”|Warm medium shot: An'an seated putting on shoes speaks to crouching Mom, both relaxed but thoughtful, canvas bag beside doorway.
到了楼下，妈妈从远处叫她。安安抬起头，朝妈妈挥了挥手。|Downstairs, Mom called to her from farther away. An'an looked up and waved.|Wide safe apartment courtyard: Mom calls across a short open path; An'an stands nearby and waves, no road or cars moving.
妈妈走近，轻声说：“走这边。”安安牵住她的手，一起绕过了花坛。|Mom came closer and said softly, “This way.” An'an took her hand, and they walked around the flower bed.|Medium courtyard walking shot: Mom and An'an hold hands around low flower bed, calm expressions, cream canvas bag on Mom's shoulder.
后来，妈妈又有一次说急了。她停一下，换了轻一点的声音。|Later, Mom spoke too sharply once more. She paused and tried a gentler voice.|Home entryway another day: Mom visibly relaxes raised shoulders before speaking again; An'an looks toward her, red toy car parked under bench.
安安也慢慢学会了说：“刚才我有点怕。你可以再说一遍吗？”这一次，话没有缩回去。|An'an slowly learned to say, “That frightened me a little. Could you say it again?” This time, her words did not hide.|Warm close ending: An'an confidently speaks to attentive Mom at child eye level, soft afternoon light and oak bench behind them.
''')

add('wo-hai-mei-shuo-yan-lei-jiu-lai-le', '我还没说，眼泪就来了', '眼泪旁边，也可以有一句话',
    '难过时可以哭；被提醒的一件事，可以等心情缓下来再一起处理。',
    'It is all right to cry when upset, and one thing that needs fixing can be handled together after a pause.',
    ['委屈与眼泪', '接纳提醒', '自我感受'],
    '允许孩子流泪和停顿，把具体行为与孩子的自我价值分开。',
    '不把哭称作玻璃心、撒娇或故意逃避；不以停止哭泣为获得陪伴的条件。成人只谈具体事情，避免追问和人格评价。',
    ['妈妈提醒画笔时，安安心里听成了什么？', '眼泪来的时候，你希望身边的人怎样陪你？'],
    '用玩偶练习一次温和提醒，并尝试“我有点难过”“等我一下”或指一指；孩子愿意时再共同完成一件小事。', '''
安安画了一条蓝蓝的小河，又在岸边添上几朵花。她举起画纸，想给妈妈看。|An'an painted a blue river and added flowers along its bank. She lifted the paper to show Mom.|Wide oak art table: An'an proudly lifts painting of blue river and red flowers; Mom comes beside table; used blue-tipped brush lies on bare table.
妈妈看见桌上的画笔：“画笔用完，要先洗一洗，再放回笔筒。”|Mom noticed the brush on the table. “When we finish painting, we wash the brush before putting it away.”|Medium tabletop conversation: Mom gently indicates used blue-tipped brush and plain yellow brush cup; An'an holds river painting.
安安的嘴角慢慢往下掉。她把画纸放回桌上，低下了头。|An'an's smile slowly faded. She put the painting down and lowered her head.|Close portrait: An'an lowers gaze with trembling mouth; blue river painting lies on oak table, yellow brush cup nearby.
她还没想好怎么说，眼泪就先出来了。一滴，落在画纸空白的角上。|Before she knew what to say, the tears came first. One drop landed on a blank corner of the paper.|Close view: single tear falls onto blank corner of river painting beneath An'an's face, flowers and river remain intact.
妈妈把想继续说的话停了下来，轻轻把纸巾放在她伸手够得到的地方。|Mom stopped what she was about to say and placed a tissue within easy reach.|Medium art table: Mom quietly places tissue beside An'an, child remains tearful; yellow brush cup and river painting visible.
“眼泪来了。”妈妈说，“你可以先哭一会儿，我坐在这里。”|“The tears have come,” Mom said. “You can cry for a while. I'll sit here with you.”|Two-person seated side view: Mom sits calmly beside crying An'an without touching or demanding eye contact, warm indoor light.
安安用纸巾擦了擦脸。妈妈没有催她解释，画笔也暂时留在桌上。|An'an wiped her face. Mom did not hurry her to explain, and the brush stayed on the table for now.|Close hands: An'an holds tissue to cheek; Mom's relaxed hands rest on lap, used brush still on table beside painting.
过了一会儿，安安说：“你是不是觉得，我什么都做不好？”|After a while, An'an said, “Do you think I can't do anything right?”|Medium child-eye-level view: An'an speaks hesitantly to attentive seated Mom, tissue in hand, river painting between them.
妈妈摇摇头：“我说的是这支画笔需要洗，不是你这个人不好。”|Mom shook her head. “I meant this brush needs washing. I didn't mean there is anything wrong with you.”|Close two-person conversation: Mom gently points to used brush, not at child; An'an listens with moist eyes.
“可是，我还想让你看看小河。”安安指了指蓝色的弯弯。|“But I wanted you to look at my river too,” An'an said, pointing to its blue bends.|Overhead tabletop: An'an's finger indicates winding blue river painting, Mom's hand rests beside blank corner, no words on paper.
妈妈把画放在眼前：“这里像绕过了一块小石头。你给它安排了什么地方？”|Mom brought the painting closer. “It looks as if the river goes around a little stone here. Where is it flowing?”|Medium art table: Mom studies river painting closely with curious face; An'an points toward one bend, used brush remains aside.
安安说起了小河、花和一条没画出来的小鱼。说着说着，她的呼吸慢了下来。|An'an told her about the river, flowers, and a fish she had not painted yet. As she spoke, her breathing grew calmer.|Close An'an telling painting story, cheeks still damp but shoulders relaxed; Mom listens, no imaginary live fish in frame.
“画笔还要洗。”妈妈轻声提醒。“我知道。”安安说，“你陪我一起去吗？”|“The brush still needs washing,” Mom reminded her softly. “I know,” An'an said. “Will you come with me?”|Medium table: An'an picks up used blue-tipped brush and looks toward Mom for help; Mom nods gently.
她们走到水池边。安安把笔尖放进水里，蓝色慢慢散开了。|They went to the sink. An'an dipped the brush into the water, and the blue color slowly spread.|Close safe sink: An'an rinses blue-tipped brush in shallow basin while Mom stands beside her, low water flow, no drinking.
洗干净的画笔回到笔筒里。画纸放在窗边，空白角上的水痕也快干了。|The clean brush went back into its cup. The painting rested by the window, and the water mark on its blank corner was nearly dry.|Still life close view: clean brush in plain yellow cup beside blue-river painting by window, faint damp mark only on blank corner; no people.
第二天，爸爸提醒桌边的杯子要挪远一点。安安又觉得鼻子有点酸。|The next day, Dad reminded her to move a cup away from the edge. An'an felt the tears coming again.|Medium breakfast table: Dad gently gestures toward small unmarked cup near edge; An'an looks emotional, safe seated setting.
这一次，她说：“我有点难过，等我一下。”爸爸点点头，先把杯子放稳。|This time, she said, “I'm feeling upset. Give me a moment.” Dad nodded and made sure the cup was safe.|Two-person close view: An'an quietly expresses feelings while Dad moves cup inward, no spilled liquid, attentive expression.
眼泪有时候还会先来。安安发现，眼泪旁边，也能慢慢长出一句自己的话。|Sometimes the tears still came first. An'an discovered that her own words could slowly appear beside them.|Warm ending portrait: An'an holds dry river painting and speaks to Mom, slight watery eyes and small steady smile, yellow brush cup behind.
''')

add('na-ju-hua-ka-zai-zui-ba-li', '那句话卡在嘴巴里', '从指一指开始，也是在表达',
    '犯错后说不出来时，可以先求助，再慢慢说明和补救。',
    'When a mistake leaves us speechless, we can ask for support and slowly explain and make amends.',
    ['犯错后沉默', '求助', '承担与补救'],
    '帮助孩子在犯错后恢复表达，体验说明经过和共同补救的安全感。',
    '不把僵住、沉默或说不清认作撒谎、无所谓或故意对抗；不用连环追问逼出坦白。允许指认、点头和成人陪同表达。',
    ['积木桥倒下后，安安为什么站着不动？', '一时说不出来时，你可以怎样让别人知道需要帮助？'],
    '用积木演一个小意外，让孩子任选指一指、点头、画出来或请成人陪着说，再一起商量一个补救动作。', '''
乐乐搭了一座蓝色积木桥。桥下留着一条小路，安安想让木头小船从那里经过。|Lele built a blue block bridge with a passage beneath it. An'an wanted her little wooden boat to travel through.|Wide playroom: Lele beside intact blue block bridge on beige mat; An'an holds small plain wooden boat near bridge passage.
小船有点宽。安安伸手挪旁边的一块积木，想让它通过。|The boat was a little wide. An'an reached to move one block so it could fit through.|Close play mat: An'an's hand reaches toward one blue support block, wooden boat rests beside intact bridge; Lele watches.
哗啦一下，桥的一边倒了。蓝色积木滚到她的鞋尖前。|With a clatter, one side of the bridge fell. A blue block rolled to her shoe.|Low floor close view: one side of blue block bridge collapsed, loose blue blocks and wooden boat on beige mat beside An'an's white red-trim shoe.
乐乐看着断开的桥，愣住了：“我刚搭好……”|Lele stared at the broken bridge. “I'd just finished it...”|Medium Lele disappointed beside partly collapsed blue bridge, hands paused on knees; An'an stands at edge of frame.
安安想说“是我碰倒的”，嘴巴却像被什么堵住。她站在那里，手垂着。|An'an wanted to say, “I knocked it down,” but her mouth felt blocked. She stood there with her hands hanging still.|Close portrait: An'an stands frozen with tense mouth and lowered hands, blue blocks visible near shoes; only An'an visible.
妈妈走来，看见地上的积木，也看见两个孩子都没有动。|Mom came over. She saw the blocks on the floor and the two children standing still.|Wide playroom: Mom approaches An'an and seated Lele beside partly collapsed blue bridge on beige mat, wooden boat nearby.
她先把走路的地方空出来，再蹲到安安旁边：“你想让我陪着吗？”|She cleared a safe place to walk, then crouched beside An'an. “Would you like me to stay with you?”|Medium child-eye-level shot: Mom crouches beside frozen An'an after moving loose blocks off walkway; Lele stays beside bridge.
安安点了一下头。妈妈没有接着问，只把手轻轻放在自己的膝盖上。|An'an nodded once. Mom did not ask another question. She simply rested her hands on her own knees.|Close two-person view: An'an gives tiny nod; crouching Mom waits with hands on own knees, no gripping child.
“如果现在说不出，可以指给我看。”妈妈说。安安指了指那块蓝色积木。|“If words won't come yet, you can point,” Mom said. An'an pointed at the blue block.|Close floor-level shot: An'an points to displaced blue support block beside partly collapsed bridge; Mom follows her gesture.
妈妈问：“你刚才动了这块？”安安又点点头。卡住的话，松开了一点。|Mom asked, “Did you move this one?” An'an nodded again. The stuck words loosened a little.|Medium quiet conversation: Mom gently asks An'an while indicating support block; child nods, Lele visible calmly nearby.
“我想让小船过去。”安安终于说，“然后，桥就倒了。”|“I wanted the boat to go through,” An'an finally said. “Then the bridge fell.”|Close An'an speaking hesitantly while holding plain wooden boat; Mom listens, collapsed bridge softly visible behind.
妈妈转向乐乐：“安安想把经过告诉你。我们一起听完，好吗？”|Mom turned to Lele. “An'an wants to tell you what happened. Shall we hear her out together?”|Three-person medium playroom: Mom gently addresses seated Lele; An'an stands beside her holding wooden boat, scattered blue blocks on mat.
安安看着乐乐：“我没有先问你，就挪了积木。对不起。”|An'an looked at Lele. “I moved a block without asking you first. I'm sorry.”|Two-child close conversation: An'an apologizes sincerely to disappointed Lele, Mom quietly behind at a respectful distance.
乐乐说：“我还很难过。我想先坐一会儿。”安安把小船放下，没有催他。|Lele said, “I'm still upset. I want to sit for a while.” An'an put down the boat and did not hurry him.|Medium play mat: Lele sits with upset expression; An'an places wooden boat aside and gives him space, no forced handshake.
过了一会儿，乐乐指着桥墩：“你可以帮我找这些蓝色的。”|After a while, Lele pointed at the supports. “You can help me find these blue ones.”|Close Lele points toward blue support blocks on beige mat; An'an looks attentive, partly collapsed bridge remains.
安安一块一块找出来。她先问：“这块放这里，对吗？”|An'an found the blocks one by one. Before placing one, she asked, “Does this one go here?”|Overhead play mat: An'an offers blue block to Lele before placing it, reconstruction in progress, wooden boat parked aside.
桥慢慢站起来了。这一次，他们一起给小船留了一条宽一点的路。|The bridge slowly stood again. This time, they left a wider passage for the boat together.|Medium two-child view: Lele and An'an rebuild stable blue block bridge with visibly wider opening, wooden boat beside opening.
妈妈说：“愿意说出发生的事，让我们知道可以从哪里帮忙。”|Mom said, “Telling us what happened helps us see where we can help.”|Warm three-person medium shot: Mom talks beside children and rebuilt blue bridge, both children listen, no triumphant poses.
安安摸了摸小船：“下次卡住的时候，我可以先说，陪我一下。”|An'an touched the boat. “Next time my words get stuck, I can start with, 'Stay with me for a moment.'”|Close An'an holding wooden boat thoughtfully beside rebuilt blue bridge, Lele nearby with relaxed face.
小船终于过了桥。安安知道，有些话可以慢一点；该做的补救，也能一步一步来。|The boat finally passed beneath the bridge. An'an knew words could take time, and making things right could happen one step at a time.|Low warm ending: An'an guides wooden boat beneath wide blue bridge while Lele watches, Mom sits nearby, beige play mat.
''')

add('wo-zhi-xiang-chi-zhe-yi-zhong', '我只想吃这一种', '喜欢的味道，也可以慢慢选',
    '可以有喜欢的口味，也可以在清楚的安排里选择和收尾。',
    'We can have favorite flavors and make choices within clear, caring plans.',
    ['零食选择', '口味偏好', '生活约定'],
    '尊重口味偏好，帮助孩子参与零食安排并应对最喜欢的食物暂时吃完。',
    '不把挑口味说成贪心或不懂珍惜；不强迫尝新，不以正餐或零食惩罚、奖励行为。根据孩子需要灵活安排，成人确认食物安全。',
    ['安安最想要的是哪一种味道？', '喜欢的零食今天吃完了，你希望怎样商量下一次？'],
    '让孩子参与一次点心安排，选择喜欢的食物和合适的份量；新口味可自愿少量尝试，也可以暂时不选。', '''
下午点心时间，妈妈摆出两种小饼干：紫薯的，和原味的。安安先看见了紫色那一盘。|At snack time, Mom put out sweet-potato crackers and plain ones. An'an noticed the purple plate first.|Wide kitchen oak table: Mom sets purple sweet-potato crackers on small white plate and beige plain crackers on another; An'an sits nearby.
“我只想吃这一种！”她把小碗推到紫薯饼干旁边。|“I only want these!” she said, pushing her bowl beside the sweet-potato crackers.|Close tabletop: An'an slides plain teal bowl beside plate of purple crackers, beige crackers remain on separate white plate.
妈妈问：“是喜欢它的味道，还是喜欢脆脆的声音？”|Mom asked, “Do you like their taste, or the crunchy sound?”|Medium conversation: Mom leans beside seated An'an, child looks at purple crackers and teal bowl, both calm.
“都有。”安安咬了一小口，“还甜甜的。”|“Both,” An'an said, taking a small bite. “And they're sweet.”|Close An'an seated safely taking small bite of purple cracker, teal bowl on table, no running or full mouth.
妈妈点点头：“可以选你喜欢的。我们先盛一小碗，看看吃得怎样。”|Mom nodded. “You can choose what you like. Let's start with a small bowl and see how you feel.”|Overhead table: Mom and An'an put small serving of purple crackers into teal bowl, remaining crackers on white plate, no exact number.
安安吃着吃着，碗空了。盘子里的紫薯饼干，也没有了。|An'an ate until the bowl was empty. The sweet-potato plate was empty too.|Close tabletop: empty teal bowl and empty white purple-cracker plate; beige plain crackers still on separate plate, An'an's hands nearby.
“再打开一包吧。”安安说。妈妈看看柜子：“这一种今天没有了。”|“Let's open another packet,” An'an said. Mom checked the cupboard. “There aren't any more of this kind today.”|Medium kitchen: Mom checks pale green cupboard with no purple crackers remaining; An'an looks toward empty teal bowl, no branded packages.
安安把原味饼干推远：“可是，我不想吃这个。”她的眉毛皱成了小结。|An'an pushed the plain crackers away. “But I don't want these.” Her eyebrows tied themselves into a little knot.|Close child at table: An'an gently pushes plate of beige crackers away, disappointed brow, empty teal bowl beside plate.
妈妈把盘子留在桌上：“你可以不选它。喜欢的吃完了，确实会失望。”|Mom left the plate on the table. “You don't have to choose those. It's disappointing when your favorites run out.”|Two-person eye-level shot: Mom calmly acknowledges disappointed An'an, beige crackers remain at respectful distance on table.
她们坐了一会儿。妈妈问：“你的肚子还饿吗？我们还有面包和香蕉。”|They sat for a while. Mom asked, “Is your tummy still hungry? We have bread and a banana too.”|Medium table: Mom shows small bread plate and whole peeled-ready banana beside her, An'an considers, no pressure to eat.
安安摸摸肚子：“还有一点饿。我想吃半根香蕉。”|An'an touched her tummy. “A little. I'd like half a banana.”|Close An'an gestures lightly toward tummy then banana, Mom attentive, empty teal bowl still visible.
妈妈帮她分好。安安慢慢吃，还是觉得紫薯饼干最好吃。|Mom helped portion it. An'an ate slowly and still thought the sweet-potato crackers tasted best.|Medium seated snack: An'an eats small banana piece from teal bowl, Mom sets remaining banana aside, no knife in child hands.
“下次可以买这一种吗？”她问。“我们把想买的画下来，再一起看安排。”妈妈说。|“Can we get that kind next time?” she asked. “Let's draw what we'd like and look at our plans together,” Mom said.|Two-person table: An'an draws small purple cracker shape on plain shopping paper; Mom watches, no letters or product brands.
纸上多了一个紫色的小圆片。安安还画了一根香蕉，放在它旁边。|A little purple circle appeared on the paper. An'an drew a banana beside it too.|Overhead drawing close-up: child's purple cracker circle and yellow banana picture on plain paper, colored pencils nearby, no text.
几天后，她们一起准备点心。安安选了喜欢的那一份，把剩下的收好。|A few days later, they prepared snacks together. An'an chose a portion she liked and helped put the rest away.|Medium kitchen: Mom and An'an serve purple crackers into small teal bowl, close plain food container with remaining crackers, no brands.
“我还是最喜欢这个。”她说。妈妈笑着点头。喜欢可以说清楚，点心也有了舒服的安排。|“These are still my favorite,” she said. Mom smiled and nodded. Her preference was heard, and snack time had a comfortable plan.|Warm ending: seated An'an enjoys small purple cracker while talking to Mom at oak table, closed container on shelf, relaxed mood.
''')

add('ni-yi-chi-wo-ye-xiang-chi', '你一吃，我也想吃', '我想要的，究竟是什么',
    '看见别人吃时，可以听听自己的感受，再决定怎样参与。',
    'When someone else is eating, we can notice what we feel before deciding how to join in.',
    ['跟着想吃', '身体感受', '同伴相处'],
    '帮助孩子区分饥饿、好奇口味与想参与同伴活动，尊重自己的选择。',
    '不把馋或好奇说成坏习惯，不规定只有饿了才能尝味道；不强迫分享、吃完或拒绝。成人确认过敏、卫生和适龄进食安全。',
    ['看到乐乐打开点心袋，安安为什么也想吃？', '想和朋友待在一起，除了吃同一种东西还可以做什么？'],
    '在轻松点心时间各说一种感受：饿了、想尝味道、想一起坐着；允许选少量、稍后吃或暂时不吃。', '''
安安吃过下午点心，和妈妈来到公园。她想找乐乐一起看小蚂蚁。|After her afternoon snack, An'an went to the park with Mom. She wanted to watch ants with Lele.|Wide park path: An'an and Mom approach Lele beside safe low flower bed, no food in hands yet, warm daylight.
乐乐坐在长椅上，打开了一小袋米饼。轻轻一响，安安就转过了头。|Lele sat on a bench and opened a small bag of rice crackers. At the rustling sound, An'an turned her head.|Medium park bench: Lele opens plain beige rice-cracker bag; An'an turns toward sound, Mom nearby.
“我也想吃！”她说。妈妈问：“刚才吃完点心，你的肚子是什么感觉？”|“I want some too!” she said. Mom asked, “How does your tummy feel after your snack?”|Two-person close conversation: An'an eagerly points toward Lele's plain cracker bag; Mom asks gently, Lele in background on bench.
安安摸了摸肚子：“满满的。可是他一吃，我就想吃。”|An'an touched her tummy. “It's full. But when he eats, I want to eat too.”|Close An'an with hand resting lightly on tummy, thoughtful face, seated Lele and bag softly blurred behind.
妈妈没有马上替她决定：“也许你想尝尝，也许你想和他一起坐。我们可以看看。”|Mom did not decide for her. “Maybe you're curious about the taste, or maybe you want to sit with him. Let's find out.”|Medium Mom at An'an's eye level beside park bench, open gentle gesture, child considers, no food pressure.
安安坐到长椅旁，问乐乐：“这个是什么味道？”|An'an sat beside Lele and asked, “What do those taste like?”|Two-child medium bench shot: An'an sits beside Lele at comfortable distance, looks curiously at plain bag.
“淡淡的，脆脆的。”乐乐说。他把袋子收在腿上，想先吃自己的。|“Mild and crunchy,” Lele said. He kept the bag on his lap because he wanted to eat his own snack first.|Close Lele seated with plain bag on own lap and one rice cracker in hand, An'an listens without reaching.
安安有点失望。妈妈轻声说：“点心是他的，分享要等他愿意。”|An'an felt a little disappointed. Mom said softly, “It's his snack. Sharing is his choice.”|Medium bench: Mom gently explains to disappointed An'an; Lele holds his own bag, no grabbing or forced sharing.
妈妈从包里拿出安安的小点心盒：“你想留到肚子舒服的时候，还是现在尝一点？”|Mom took An'an's snack box from her bag. “Would you like to keep it for later, or taste a little now?”|Close Mom presents small plain teal snack box to seated An'an; Lele remains on bench, no branded packages.
安安想了想：“先留着。我想坐在这里，听乐乐讲蚂蚁。”|An'an thought for a moment. “I'll save it. I want to stay here and hear Lele talk about the ants.”|Medium two children on bench: An'an closes teal snack box and listens to Lele pointing toward flower bed, Mom nearby.
乐乐说，蚂蚁刚才绕过了一块小石头。安安凑过去看，差点忘了那声脆响。|Lele said the ants had walked around a little stone. An'an leaned closer to look and almost forgot the crunching sound.|Low park flower-bed shot: An'an and Lele observe tiny ants near small stone from safe distance, food put away, Mom nearby.
过了一会儿，乐乐问：“你想尝一小块吗？”妈妈先确认了里面有什么。|After a while, Lele asked, “Would you like a small piece?” Mom first checked what was in the crackers.|Medium bench: Lele voluntarily offers small rice-cracker piece; Mom checks plain packaging privately, An'an waits, no readable labeling.
她们洗净手，再坐下来。安安尝了一小块：“原来是这个味道。”|They cleaned their hands and sat down again. An'an tasted a small piece. “So that's what they taste like.”|Close seated An'an tasting small rice-cracker piece after cleaned hands, Mom with plain napkin beside her, Lele on bench.
乐乐又问要不要。安安摇摇头：“尝到了。我现在不想再吃了。”|Lele offered another. An'an shook her head. “I've tasted it. I don't want any more just now.”|Two-child close view: An'an gently declines Lele's additional cracker with small open hand, both relaxed, no rejection hurt.
回家路上，安安说：“刚才我想吃，也想和乐乐一起。”妈妈说：“你慢慢听清了自己。”|On the way home, An'an said, “I wanted a taste, and I wanted to be with Lele.” Mom said, “You listened to what you were feeling.”|Medium safe park path: Mom and An'an walk holding hands, teal snack box in cream bag, thoughtful conversation.
小点心盒还在包里。安安知道，它可以等一等；和朋友在一起，也有好多种办法。|Her little snack box was still in the bag. An'an knew it could wait, and there were many ways to spend time with a friend.|Warm ending home table: An'an sets closed teal snack box beside simple ant-and-stone drawing, Mom nearby, no eating shown.
''')

add('na-liang-xiao-che-wo-jin-tian-jiu-xiang-yao', '那辆小车，我今天就想要', '喜欢很大，今天的安排也要说清楚',
    '可以强烈地喜欢一件东西，也可以在陪伴里慢慢面对暂时得不到。',
    'We can want something very much and have support while facing the disappointment of not getting it yet.',
    ['想买玩具', '强烈愿望', '购买约定'],
    '接纳孩子强烈的购买愿望，成人清楚说明安排并陪伴失望，练习表达和延迟讨论。',
    '不以哭闹羞辱孩子，不用停止哭泣换购买，也不以买礼物代替陪伴；记录愿望不等于承诺购买，借玩必须取得主人同意。',
    ['安安说今天就要时，最难受的是什么？', '暂时不能买喜欢的东西，你希望别人怎样陪你？'],
    '一起画一件想要的东西，听孩子说明喜欢的地方；由成人给出明确的再次讨论时间，也诚实说明届时仍可能不购买。', '''
公园里，乐乐带来一辆黄色遥控小车。按一下，小车就绕着树影跑。|At the park, Lele brought a yellow remote-control car. With one press, it drove around the tree's shadow.|Wide safe park paved play area: Lele operates small yellow remote-control car with black controller; An'an and Mom watch, no traffic.
安安蹲下来，眼睛跟着它转：“它还会倒着走！”|An'an crouched down, following it with her eyes. “It can go backward too!”|Low close view: yellow remote-control car reverses on safe paving near fascinated crouching An'an; Lele holds black controller nearby.
她问：“我能试一下吗？”乐乐点点头，先告诉她怎样慢慢开。|She asked, “Can I try?” Lele nodded and showed her how to drive slowly.|Two-child medium shot: Lele voluntarily hands black controller to An'an beside stationary yellow car, Mom supervises at edge.
小车轻轻转了一个弯。安安觉得，自己好像有了一位会听话的小司机。|The car made a gentle turn. An'an felt as if she had a little driver who followed her directions.|Low dynamic park shot: An'an carefully operates black controller while yellow car turns around a leaf, Lele watches, no fantasy driver.
轮到乐乐继续玩时，安安把遥控器还给他，却舍不得移开眼睛。|When it was Lele's turn again, An'an returned the controller but could hardly look away.|Medium two children: An'an hands black controller back to Lele, longing face, yellow car parked between them.
回家路上，她拉住妈妈：“我们现在去买一辆吧。我今天就想要。”|On the way home, she tugged Mom's hand. “Let's buy one now. I want it today.”|Two-person safe park path: An'an eagerly tugs Mom's hand while speaking; neither yellow car nor controller present.
妈妈停下来：“你很喜欢它。今天我们没有买玩具的安排。”|Mom stopped. “You really like it. We haven't planned to buy a toy today.”|Medium path conversation at child eye level: Mom crouches calmly before An'an, cream bag on shoulder, no toy shop visible.
安安的眼泪涌上来：“可是我就是想要！现在就要！”|An'an's tears rose. “But I want it! I want it now!”|Close An'an tearful with clenched small hands, cheeks flushed in disappointment; Mom's calm profile beside her.
她坐到长椅上，哭得一抽一抽。妈妈坐在旁边，把纸巾递过来。|She sat on a bench and cried in little sobs. Mom sat beside her and offered a tissue.|Wide quiet park bench: An'an cries seated beside calm Mom offering tissue, no audience or extra people.
“等着很难受。”妈妈说，“今天不买，我也会在这里陪你。”|“Waiting feels hard,” Mom said. “We aren't buying it today, and I'll stay here with you.”|Close two-person bench: Mom acknowledges tearful An'an gently, open relaxed posture, child not yet smiling.
安安没有立刻平静。妈妈等了一会儿，又问：“你最喜欢它哪一点？”|An'an did not calm down immediately. Mom waited, then asked, “What do you like most about it?”|Medium side bench view: An'an holds tissue and remains upset while Mom quietly listens without touching or bargaining.
“倒着走，转弯，还有黄色的车壳。”安安用手比出一个弯。|“Going backward, turning, and its yellow body,” An'an said, tracing a curve with her hand.|Close An'an describing car with curved hand gesture, tissue on lap, Mom attentive; no actual yellow car in scene.
回家后，妈妈拿来一本愿望本。安安画了一辆黄色小车，旁边画上黑色遥控器。|At home, Mom brought a wish notebook. An'an drew a yellow car and a black controller beside it.|Overhead oak table: An'an draws yellow car and black controller in plain notebook; Mom sits beside her, no words or numbers.
“画下来，就一定会买吗？”安安问。妈妈摇摇头：“是把喜欢记住，再认真商量。”|“Does drawing it mean we'll buy it?” An'an asked. Mom shook her head. “It means we remember your wish and discuss it carefully.”|Two-person close table conversation: open notebook shows yellow car drawing, Mom explains honestly, An'an listens thoughtfully.
她们约好星期天再聊，看看价格、家里的安排，还有安安想怎样玩。|They agreed to talk again on Sunday, considering the price, their plans, and how An'an wanted to play.|Medium oak table: Mom and An'an look together at car wish drawing, plain calendar with only simple colored shapes blurred behind, no text.
那天晚上，安安仍然想起黄色小车。她把愿望本放在自己的小车旁边。|That evening, An'an still thought about the yellow car. She placed the notebook beside her own toy car.|Close shelf evening: open notebook with yellow remote car drawing lies beside existing small red manual toy car; An'an's hand places notebook.
过了几天，她问乐乐：“下次还能一起玩吗？”乐乐说：“周末我带来。”|A few days later, she asked Lele, “Could we play together again?” Lele said, “I'll bring it at the weekend.”|Two-child medium park meeting: An'an asks Lele about another playtime, both empty-handed, no yellow car or controller yet.
星期天，妈妈按约定坐下来。安安说，她想试试小车能不能绕过三个纸盒。|On Sunday, Mom sat down as promised. An'an said she wanted to see whether the car could drive around some paper boxes.|Home table medium view: Mom listens to An'an showing notebook drawing of yellow car and simple box course, no actual new toy.
她们商量后，暂时没有买。安安还失望，不过这次，她知道自己的喜欢被认真听见了。|After discussing it, they did not buy it yet. An'an was still disappointed, but this time she knew her wish had been heard.|Close home conversation: An'an slightly disappointed beside open yellow-car wish notebook, Mom stays attentive, no purchased toy or rewards.
后来一起玩时，安安又接过遥控器。黄色小车绕过纸盒，她的愿望也有了可以慢慢说的地方。|When they played together later, An'an took the controller again. The yellow car went around the boxes, and her wish had a place to be talked about over time.|Warm safe park ending: Lele lends black controller to An'an operating his yellow car around plain cardboard boxes; Mom supervises.
''')

add('sheng-qi-de-xiao-shou-fang-na-li', '生气的小手放哪里', '生气可以说，手先停一下',
    '生气可以被理解，伤人的动作需要停下，再找表达和修复的办法。',
    'Anger deserves understanding, while hurtful actions need to stop so we can find words and ways to repair.',
    ['生气与动作', '安全界限', '表达需要'],
    '在成人支持下停止伤人动作，辨认身体信号并表达生气与具体需要。',
    '成人先保护所有孩子安全，不羞辱、威胁或强迫拥抱。阻止动作使用必要且最少的保护，不做惩罚性束缚；平静和修复都可以需要时间。',
    ['安安生气时，小手和身体发生了什么变化？', '别人碰倒作品时，你想怎样告诉他，又需要谁帮忙？'],
    '在平静时用玩偶练习“停一下，我很生气”“请先问我”，一起选一个安全的退开位置或求助手势；不用制造真实冲突来练习。', '''
安安用积木搭了一间小房子。屋顶是红色的，门口有一块圆圆的地垫。|An'an built a little block house with a red roof and a round mat by its door.|Wide playroom: An'an builds wooden block house with red roof on beige floor mat, tiny round blue felt mat at house entrance.
小宇过来找滚走的球，手肘碰到了屋顶。房子歪了一下，倒了。|Xiaoyu came looking for his rolling ball. His elbow touched the roof, and the house tilted and fell.|Medium playroom moment: Xiaoyu's elbow accidentally knocks red roof, small plain green ball nearby; An'an watches house collapse.
安安觉得脸热了，胸口也热了。她的手一下攥成了拳头。|An'an's face grew hot, and so did her chest. Her hands suddenly tightened into fists.|Close portrait An'an flushed angry face and clenched hands beside fallen red roof and wooden blocks, no striking action.
“你把我的房子弄坏了！”她朝小宇伸出手，想把他推开。|“You broke my house!” she shouted, reaching toward Xiaoyu to push him away.|Medium two children: An'an reaches forward with angry open palms toward startled Xiaoyu, clear space remains between them, no contact.
妈妈站到他们中间，轻轻挡住安安的手：“我不会让你推人。我们先退开一点。”|Mom stepped between them and gently blocked An'an's hands. “I won't let you push anyone. Let's move apart first.”|Medium safety moment: Mom stands between children using open forearm to gently intercept An'an's reaching hands, no gripping or restraining, Xiaoyu steps back.
小宇退到另一边。安安还在生气，眼睛紧盯着地上的屋顶。|Xiaoyu moved to the other side. An'an was still angry, staring at the roof on the floor.|Wide playroom: children safely separated with Mom beside An'an, Xiaoyu near green ball, fallen red roof between them on mat.
“那是你搭了很久的房子。”妈妈说，“你现在很生气，我看见了。”|“You spent a long time building that house,” Mom said. “I can see how angry you are.”|Close Mom crouches beside angry An'an and acknowledges fallen house, child clenched hands still at own sides.
妈妈问：“你想站在这里，还是到软垫边坐一下？我都可以陪你。”|Mom asked, “Would you like to stand here or sit beside the cushion? I can stay with you either way.”|Medium playroom: Mom offers choice with open gesture toward plain soft floor cushion; An'an considers, no isolated punishment corner.
安安坐到软垫上，手紧紧按在自己的膝盖上。她还不想说话。|An'an sat on the cushion, pressing her hands against her own knees. She did not want to talk yet.|Close An'an seated on soft cushion with palms on own knees and tense face; Mom sits nearby quietly.
妈妈安静等着。过了一会儿，安安的手指慢慢松开了。|Mom waited quietly. After a while, An'an's fingers slowly loosened.|Close hands and faces: An'an fingers gradually relax on knees, calm waiting Mom beside her, warm light.
“我不喜欢他碰我的房子。”安安说，“我还想搭完。”|“I don't like him touching my house,” An'an said. “I still wanted to finish it.”|Two-person seated conversation: An'an explains upset to Mom, fallen red-roof house visible across room, no Xiaoyu close by.
“这句话可以告诉他。”妈妈说，“手先停住，话就有地方出来了。”|“You can tell him that,” Mom said. “When your hands stop, there is room for your words.”|Medium quiet view: Mom listens beside seated An'an, child's hands now relaxed and open on knees.
等安安愿意了，妈妈陪她走过去：“我很生气。下次碰我的作品，请先问我。”|When An'an was ready, Mom went with her. “I'm angry. Please ask me before touching my work next time,” An'an said.|Three-person medium shot: An'an speaks firmly from safe distance to Xiaoyu, Mom beside her, fallen house on mat between children.
小宇说：“我刚才找球，没看见屋顶。对不起。我可以帮你找积木吗？”|Xiaoyu said, “I was looking for my ball and didn't see the roof. I'm sorry. Can I help find the blocks?”|Close Xiaoyu apologizes with open hands, plain green ball set aside, An'an listens, Mom nearby.
安安想了想：“你先把红色的放这里。我想自己搭门。”|An'an thought for a moment. “Put the red pieces here first. I want to build the door myself.”|Overhead play mat: An'an indicates place for red roof pieces; Xiaoyu sorts red blocks without touching unfinished doorway.
妈妈也帮着把走路的地方清出来。房子周围，多了一点安全的空地。|Mom helped clear the walking space. The house now had a little more room around it.|Wide playroom: Mom moves green ball to basket away from building area; children rebuild with clear walkway and beige mat.
安安把屋顶放回去，还是有一点不开心。小宇没有催她笑。|An'an put the roof back. She was still a little upset, and Xiaoyu did not ask her to smile.|Medium children rebuilding: An'an places red roof on house with serious face; Xiaoyu waits respectfully, tiny round blue mat by doorway.
后来，安安和妈妈在平静的时候练了一句：“停一下，我很生气。”|Later, when they were calm, An'an and Mom practiced saying, “Stop a moment. I'm angry.”|Home sofa medium shot: calm An'an and Mom use two simple wooden dolls to rehearse speaking, no conflict or violence.
她们还选了一个求助手势：把手掌举起来，让妈妈看见。|They chose a signal for asking for help too: holding up a palm where Mom could see it.|Close calm practice: An'an holds one open palm upward to signal help, Mom acknowledges, wooden dolls on sofa cushion.
生气有时还会来。安安的小手慢慢记住了：先停一下，再找一句能说出来的话。|Anger would still visit sometimes. An'an's little hands slowly learned to pause first and find words she could say.|Warm ending playroom: An'an holds open palm and calmly speaks beside intact red-roof block house, Mom attentive, Xiaoyu at respectful distance.
''')

add('zhe-yi-ji-wo-hai-xiang-kan', '这一集，我还想看', '结束之后，我们一起去做下一件事',
    '停下屏幕需要清楚的安排和陪伴，大人也一起遵守自己的约定。',
    'Stopping screen time takes clear plans and support, and grown-ups can keep their own agreements too.',
    ['屏幕与过渡', '家庭约定', '成人示范'],
    '认识自动连播与难以收尾的情境，用预告、具体结束点和共同活动帮助过渡。',
    '不把停不下说成意志差，不用羞辱、突然夺走或额外奖励来结束；安排要适龄且可落实。成人负责设置设备，不能把全部自控责任交给孩子。',
    ['下一集自己开始时，安安为什么更难停下？', '结束屏幕之后，你希望和家人接着做什么？'],
    '成人关闭自动连播，与孩子提前约好一个容易辨认的结束点和下一件小活动；成人也为自己的手机安排结束提醒。', '''
星期六下午，安安坐在沙发上看动画。屏幕里的彩色小圆点，正滚过一座小桥。|On Saturday afternoon, An'an watched an animation on the sofa. Colorful little dots rolled over a tiny bridge on the screen.|Wide living room: seated An'an watches gray-cased tablet showing abstract colored circles and simple bridge, Mom sits nearby with phone, no text.
她和妈妈约好，看完这一集，就一起做纸盒停车场。|She and Mom had agreed to make a cardboard parking lot together after this episode.|Medium sofa: Mom and An'an beside gray tablet, plain cardboard boxes and small red toy car ready on low oak table.
片尾音乐响起来了。安安坐直了一点，准备叫妈妈。|The ending music began. An'an sat up a little, ready to call Mom.|Close An'an beside tablet displaying simple ending animation of colored circles, Mom holding phone softly blurred behind.
可是屏幕闪了一下，下一集自己开始了。新的小圆点又跑出来。|But the screen flickered, and the next episode started by itself. New colorful dots appeared.|Close tablet in gray case: fresh abstract circle animation begins, An'an's face reflects renewed attention, no titles or playback text.
“我想把这个也看完。”安安说。妈妈抬起头：“我们刚才约好结束了。”|“I want to finish this one too,” An'an said. Mom looked up. “We agreed to stop after the last one.”|Medium sofa conversation: An'an still gazes at tablet, Mom looks up from phone, cardboard project on table untouched.
安安抱紧平板：“可它已经开始了。”她觉得，好像有一根线把眼睛拉住。|An'an held the tablet tightly. “But it's already started.” It felt as if a little string were pulling her eyes toward it.|Close An'an holding gray tablet with reluctant expression, abstract colorful display; no literal string or fantasy imagery.
妈妈先停住播放：“下一集自己开始，确实更难收尾。我来把这个设置关掉。”|Mom paused playback. “When the next episode starts by itself, stopping is harder. I'll turn that setting off.”|Close Mom uses tablet carefully while An'an watches; screen dim with simple unlabeled controls, no visible writing.
妈妈把平板放在桌上，坐回安安旁边。安安的眉毛还皱着。|Mom put the tablet on the table and sat beside An'an again. An'an was still frowning.|Medium sofa: gray tablet lies paused on oak table beside cardboard boxes; Mom stays beside disappointed An'an.
“我还想知道后面发生什么。”安安说。妈妈点头：“我们记住，下次从这里开始。”|“I still want to know what happens next,” An'an said. Mom nodded. “We'll remember where to start next time.”|Two-person close conversation: Mom acknowledges An'an's curiosity, child points toward paused tablet, no bargain or new treat.
她们画了一个小桥的图案，夹在纸盒旁边。喜欢的故事，有了等下次的地方。|They drew a tiny bridge and placed the picture beside the boxes. The story she liked had a place to wait for next time.|Overhead low table: plain paper with simple bridge drawing beside gray tablet and cardboard boxes, child's pencil and Mom's hand, no text.
妈妈拿起纸盒，安安没有马上跟过去：“等我坐一会儿。”|Mom picked up a box. An'an did not join in immediately. “Let me sit for a little while.”|Wide living room: Mom sits on rug with plain cardboard box; An'an remains on sofa taking a pause, tablet dark on table.
过了一会儿，她滑下沙发：“停车场的门，要开在哪里？”|After a while, she slid down from the sofa. “Where should the parking-lot entrance go?”|Medium low view: An'an joins Mom beside cardboard boxes and points at possible entrance, adult handles any cutting out of frame.
妈妈刚要回答，手机响了。她看了一眼，又放到柜子上：“这会儿是我们的纸盒时间。”|Just as Mom was about to answer, her phone chimed. She glanced at it, then put it on the cupboard. “This is our cardboard time.”|Medium living room: Mom places phone high on pale green cabinet, An'an waits beside cardboard boxes, tablet remains dark.
安安扶住纸盒，妈妈帮忙开好了门。小红车慢慢开进了停车场。|An'an steadied the box, and Mom helped make the entrance. The little red car slowly drove into its parking lot.|Close cardboard project: completed safe opening in plain box, An'an guides small red toy car through it, Mom supports box, no blades visible.
下一次看动画前，她们先选好结束的位置，还把下一件事摆在旁边。|Before the next viewing, they chose a clear stopping point and set out the next activity nearby.|Medium living room another day: Mom and An'an prepare gray tablet beside simple red-sand hourglass and cardboard project, no numbers or readable interface.
片尾音乐响了，安安还是想再看。妈妈轻声提醒，陪她把平板收好。|When the ending music played, An'an still wanted more. Mom gently reminded her and helped put the tablet away.|Two-person medium shot: Mom helps willing-but-disappointed An'an place gray tablet into plain storage basket, no grabbing.
安安说：“我还想看，不过明天可以接着。”她摸摸纸盒里的小车，先把它开出来。|An'an said, “I still want to watch, but I can continue tomorrow.” She touched the car in the box and drove it out.|Close An'an rolls small red toy car out of cardboard parking lot, tablet stored on shelf, thoughtful rather than forced cheerful expression.
屏幕停下了，喜欢还在。接下来的时间，安安和妈妈一起慢慢走进去。|The screen had stopped, and her interest remained. An'an and Mom moved into the next part of their day together.|Warm ending wide living room: Mom and An'an play with cardboard parking lot on rug, phone on cabinet and tablet stored away, no screens lit.
''')

add('zhe-ci-zhen-de-bu-shi-wo', '这次真的不是我', '请先听我把经过说完',
    '被误会时可以求助和说明；大人也需要核对事实，为误会道歉。',
    'When misunderstood, we can ask for help and explain, and grown-ups can check facts and apologize too.',
    ['被误会', '解释与倾听', '事实与道歉'],
    '给被误会的孩子表达空间，成人示范停止猜测、听取经过与承担误会的责任。',
    '不要求孩子靠声音大、立即说清或拿出证据才值得被信任；不以过去犯错推定这次也是他。需要澄清时由成人协助，不让孩子独自对抗。',
    ['妈妈一开始知道了什么，又猜了什么？', '被误会时，你希望大人先做哪一件事？'],
    '用玩偶演一次物品倒下的小意外，分别练习“请先听我说”“我还不知道，先问问经过”；成人也练习具体道歉。', '''
安安和小宇一起画画。桌上放着一小杯橙色颜料，妈妈在旁边整理画纸。|An'an and Xiaoyu painted together. A small cup of orange paint sat on the table while Mom arranged paper nearby.|Wide oak art table: An'an and Xiaoyu paint with small plain orange-paint cup between them; Mom arranges blank paper beside table.
安安举起自己的画，转过身，想放到窗边晾干。|An'an lifted her painting and turned toward the window to let it dry.|Medium art corner: An'an carries painting with both hands away from table toward window; Xiaoyu remains seated beside orange paint cup.
小宇去拿蓝色画笔，袖子碰到了杯子。橙色颜料沿桌面流出来。|Xiaoyu reached for a blue brush, and his sleeve caught the cup. Orange paint spread across the table.|Close tabletop event: Xiaoyu's green sleeve tips plain orange paint cup while reaching for blue brush, An'an visible turned away holding painting.
妈妈听见声音，回头看见安安站在桌旁：“安安，你怎么把颜料碰倒了？”|Mom heard the sound and turned. Seeing An'an beside the table, she said, “An'an, how did you knock the paint over?”|Medium three-person art table: Mom turns and mistakenly addresses startled An'an holding painting, Xiaoyu sits beside tipped cup and orange spill.
“不是……”安安的脸一下红了。她急着解释，话却挤在一起。|“I didn't...” An'an's face flushed. She hurried to explain, but her words crowded together.|Close An'an flushed and distressed holding dry painting with both hands, mouth hesitates, orange spill blurred behind.
“我都转过去了，小宇的……”她越急，越说不清，眼泪也涌了上来。|“I'd already turned around, and Xiaoyu's...” The more she hurried, the harder it was to speak. Tears rose too.|Close An'an with watery eyes and tense shoulders, painting held safely, Mom's concerned profile nearby.
妈妈停了一下。她把颜料杯放稳，铺上抹布，再蹲到安安面前。|Mom paused. She steadied the cup, laid a cloth over the spill, and crouched in front of An'an.|Medium art corner: Mom has set paint cup upright and cloth over orange spill, crouches before upset An'an; Xiaoyu seated nearby.
“我刚才还没问经过，就先说是你。”妈妈说，“我们慢一点，你愿意说时，我听着。”|“I said it was you before asking what happened,” Mom said. “Let's slow down. I'll listen when you're ready.”|Intimate two-person eye-level shot: Mom apologetically listens to An'an with open hands, no demands for eye contact.
安安把画放到旁边，擦擦眼睛：“这次真的不是我。”|An'an set her painting aside and wiped her eyes. “It really wasn't me this time.”|Medium child at window ledge: An'an lays painting flat and wipes cheek with tissue, Mom listens beside her.
“我拿着画，已经转过去了。”她用手指了指自己刚才站的地方。|“I was holding my painting and had already turned around.” She pointed to where she had stood.|Wide art room: An'an points from window toward her earlier spot by table, Mom follows gesture, tipped-paint area covered by cloth.
小宇低头看着袖口：“是我的袖子碰到的。我刚才也吓了一跳。”|Xiaoyu looked at his cuff. “My sleeve caught it. I was startled too.”|Close Xiaoyu looks at small orange stain on green sleeve cuff and speaks honestly; upright orange paint cup nearby, no shaming.
妈妈认真听完：“谢谢你们说明。安安，我误会你了，对不起。”|Mom heard them out. “Thank you for explaining. An'an, I misunderstood you. I'm sorry.”|Three-person medium shot: Mom sincerely apologizes to An'an; Xiaoyu nearby with stained cuff, cloth covers spill.
安安说：“你刚才一说，我就觉得怎么解释都没用了。”妈妈轻轻点头。|An'an said, “When you said it was me, I felt as if explaining wouldn't help.” Mom nodded gently.|Close two-person conversation: An'an shares hurt with still-damp eyes, Mom listens thoughtfully without defending herself.
“以后我先问发生了什么。”妈妈说，“你也可以提醒我，先听你讲完。”|“Next time, I'll ask what happened first,” Mom said. “You can remind me to hear you out too.”|Medium art corner: Mom and An'an talk beside drying painting, relaxed attentive posture, no pointing accusation.
小宇和妈妈一起擦桌子。安安先坐了一会儿，再决定把自己的画纸收好。|Xiaoyu and Mom wiped the table. An'an sat for a while, then chose to put away her own paper.|Wide art room: Mom and Xiaoyu wipe orange spill with cloth; An'an separately sits beside dry papers, not forced to clean others' mistake.
过了几天，地上的积木倒了。妈妈先问：“刚才这里发生了什么？”|A few days later, blocks fell on the floor. Mom first asked, “What happened here?”|Medium playroom: scattered wooden blocks on mat, Mom calmly asks An'an and Xiaoyu from equal eye level, no accusing gestures.
安安说：“是我拿盒子时碰到的。我来收。”她发现，妈妈真的在等她把话说完。|An'an said, “I knocked them over while taking the box. I'll tidy them.” She saw that Mom really waited for her to finish.|Close An'an honestly explains beside plain storage box and fallen blocks; Mom waits attentively, Xiaoyu nearby.
那句“请先听我说”留在安安心里。说出经过，可以让事情更清楚，也让委屈有地方被听见。|“Please hear me out” stayed with An'an. Explaining could make things clearer and give her hurt feelings a place to be heard.|Warm ending: An'an speaks calmly to attentive Mom beside neatly stored blocks, relaxed hands and thoughtful expression, no text.
''')

add('na-sheng-ni-hao-cang-zai-bei-hou', '那声你好，藏在背后', '慢一点，也可以找到自己的招呼',
    '和不熟悉的人打招呼，可以慢慢来，选择让自己舒服的方式。',
    'Greeting someone less familiar can take time, and we can choose a way that feels comfortable.',
    ['见人害羞', '社交节奏', '自己的表达'],
    '尊重孩子面对不熟悉的人时的节奏，在可靠成人陪伴下尝试自己的问候方式。',
    '不以没礼貌、胆小评价孩子，不强迫说话、身体接触或接受陌生人的礼物；问候不代表同意跟随，安全边界仍由成人负责。',
    ['安安躲到爸爸身后时，心里可能有什么感觉？', '除了说你好，还可以怎样向熟悉的人打招呼？'],
    '和孩子选择点头、挥手或一句问候，在家自愿用玩偶练习；外出由孩子决定是否尝试，不把打招呼变成表演考核。', '''
爸爸牵着安安下楼，遇见了他熟悉的邻居阿姨。阿姨正在给花浇水。|Dad took An'an downstairs and met a neighbor he knew. She was watering her flowers.|Wide safe apartment courtyard: Dad holds An'an's hand near familiar neighbor Aunt watering potted flowers with small plain can.
“早上好呀。”阿姨笑着说。安安一下躲到爸爸身后，只露出半只鞋。|“Good morning,” the neighbor said with a smile. An'an slipped behind Dad, leaving only part of one shoe showing.|Medium courtyard: friendly Aunt greets from respectful distance; An'an hides behind Dad with one white red-trim sneaker visible.
那声“你好”已经到了嘴边，却又缩了回去。她把爸爸的手攥得更紧。|“Hello” was almost at An'an's lips, then retreated. She held Dad's hand more tightly.|Close An'an partly hidden behind Dad's navy sweater, hand gripping his gently, shy uncertain eyes, no extra people.
爸爸没有把她拉出来。他说：“安安想先在我旁边待一会儿。”|Dad did not pull her forward. “An'an would like to stay beside me for a little while,” he said.|Medium Dad calmly speaks to Aunt while An'an stays behind his leg, no pulling or pushing child forward.
阿姨点点头，继续浇花。水落在叶子上，亮晶晶的。|The neighbor nodded and went on watering. Drops sparkled on the leaves.|Close Aunt gently waters green potted leaves, sparkling water droplets, Dad and An'an at a respectful distance softly blurred.
回家路上，爸爸问：“刚才你是有点紧张，还是还不想说话？”|On the way home, Dad asked, “Were you feeling nervous, or did you simply not want to speak yet?”|Two-person medium apartment path: Dad and An'an walk holding hands, Dad asks gently, no Aunt in frame.
安安说：“她看着我，我就忘了怎么说。”爸爸点头：“原来是这样。”|An'an said, “When she looked at me, I forgot what to say.” Dad nodded. “I see.”|Close An'an quietly explains to Dad while walking, Dad listens without teasing, safe indoor hallway.
“你可以先点头，或者挥挥手。”爸爸说，“也可以今天先不试。”|“You could start with a nod or a wave,” Dad said. “And you can choose not to try today.”|Home sofa medium conversation: Dad demonstrates small gentle wave; An'an considers, no forced practice.
安安举起手，试着晃了一下：“这样，也算打招呼吗？”|An'an lifted her hand and gave a tiny wave. “Does this count as saying hello too?”|Close calm home scene: An'an gives tentative small wave, Dad smiles attentively, natural fingers.
“当然。”爸爸说。他们没有安排比赛，也没有要求声音一定要大。|“Of course,” Dad said. They made no contest of it and did not require a loud voice.|Medium home sofa: Dad and An'an relax after tiny wave practice, no chart, prizes or audience.
几天后，他们又遇见阿姨。这一次，安安站在爸爸旁边，轻轻挥了挥手。|A few days later, they met the neighbor again. This time, An'an stood beside Dad and gave a little wave.|Wide courtyard: An'an stands beside Dad and gives small wave to familiar Aunt near potted flowers, comfortable distance.
阿姨也挥挥手：“我看见啦。”说完，她又去照顾窗边的小花。|The neighbor waved back. “I saw that.” Then she returned to the flowers by her window.|Medium Aunt returns small wave without approaching or touching child; An'an and Dad remain beside courtyard path.
后来的一天，安安看见花盆里开了一朵小黄花。她停下来，多看了一会儿。|One day later, An'an noticed a little yellow flower in the pot. She stopped to look at it a while longer.|Close An'an observes small yellow flower in green potted plant, Dad beside her, Aunt farther away tending leaves.
“这是什么花？”她小声问。阿姨听见了，蹲下来，隔着花盆告诉她。|“What flower is that?” she asked softly. The neighbor heard and crouched on the other side of the pot to answer.|Medium courtyard: Aunt crouches across flower pot at respectful distance and answers softly; An'an beside Dad asks about yellow bloom.
走的时候，安安轻轻说：“阿姨，再见。”声音不大，却是她自己想说的。|When they left, An'an said softly, “Goodbye.” Her voice was quiet, and the words were her own choice.|Three-person courtyard farewell: An'an gives voluntary soft goodbye and wave beside Dad; Aunt smiles from flower pots.
那声你好有时还会藏在背后。有爸爸陪着，安安可以慢慢找到自己的方式。|Sometimes hello would still hide behind her. With Dad beside her, An'an could find her own way in her own time.|Warm ending safe courtyard: An'an walks beside Dad with relaxed hand in his, looks back with small wave, Aunt distant near flowers.
''')


CHARACTERS = {
    "An'an": "An'an is a six-year-old Chinese GIRL, round face, ear-length straight black bob, yellow star hair clip on her left, plain teal zip-front hoodie, blue jeans, white sneakers with red trim and white laces. Preserve her female identity.",
    'Mom': 'Mom is an adult Chinese woman, shoulder-length black hair, coral cardigan and cream trousers.',
    'Dad': 'Dad is an adult Chinese man, short black hair, navy sweater and beige trousers.',
    'Lele': 'Lele is a six-year-old Chinese boy with short black hair, mustard sweatshirt and navy trousers.',
    'Xiaoyu': 'Xiaoyu is a six-year-old Chinese boy, short black hair, forest-green sweatshirt, charcoal trousers; distinct from Lele.',
    'Aunt': 'Aunt is a familiar middle-aged Chinese female neighbor, short chestnut-brown hair, sky-blue cardigan, charcoal trousers; distinct from Mom and Grandma.',
}


def image_jobs(kit):
    jobs = []
    for b in BOOKS:
        for page, (_, _, scene) in enumerate(b[-1], 1):
            cast = [description for name, description in CHARACTERS.items() if name in scene]
            if b[0] == 'ma-ma-ni-shi-zai-xiong-wo-ma' and page <= 12:
                cast = [description.replace('white sneakers with red trim and white laces', 'plain WHITE SOCKS on both feet, NO shoes worn') for description in cast]
                scene += ' Before shoes are put on: An\'an wears plain white socks on BOTH feet; white red-trim sneakers remain UNWORN beside the oak shoe bench. This is the home entryway, not a dining room. The red toy car has a compact round body and circular headlights.'
            prompt = '\n'.join([
                kit['globalStyle'],
                'Asset type: one individual full-bleed square picture-book illustration, one coherent scene, never a multi-panel sheet.',
                *cast,
                'Draw ONLY the people named in this page scene. Keep identities, faces, hair and clothing consistent. No additional family members or bystanders. Oak furniture, pale green cabinets, warm contemporary Chinese home details indoors.',
                "THIS PAGE'S SCENE: " + scene,
                'Follow current object state literally. Do not anticipate later events. Match the requested camera view, natural hands and subtle readable feelings. Distressed, frozen, angry or disappointed children must not smile. Empty cups and bowls stay empty; drawings remain drawings. Scene-specific socks and shoe actions override default footwear.',
                'Avoid: ' + kit['negative'],
            ])
            jobs.append(dict(id=b[0], page=page, prompt=prompt))
    return jobs


def main():
    target = ROOT / 'content-drafts/richang'
    kit = json.loads((target / 'lan-ping-guo.json').read_text())['imagePromptKit'].copy()
    kit['characterConsistency'] += ' Xiaoyu: same-age Chinese boy, forest-green sweatshirt, charcoal trousers. Familiar neighbor Aunt: short chestnut hair, sky-blue cardigan, charcoal trousers. Only page-specific cast appears.'
    expected = [18, 18, 20, 16, 16, 20, 20, 18, 18, 16]
    assert len(BOOKS) == len(expected)
    assert sum(expected) == 180
    for b, count in zip(BOOKS, expected):
        assert len(b[-1]) == count, (b[1], len(b[-1]), count)
        assert len({p[0] for p in b[-1]}) == count, b[1]
        assert not (target / f'{b[0]}.json').exists(), f'Refusing to overwrite {b[0]}'
    for index, (slug, title, subtitle, moral, moral_en, tags, goal, reminder, questions, activity, pages) in enumerate(BOOKS):
        order = index + 31
        book = dict(id=slug, seriesId='richang', title=title, subtitle=subtitle,
            moral=dict(zh=moral, en=moral_en), ageLabel='4–8 岁', publishedAt='2026-10-03', order=order,
            comingSoon=True, pages=[dict(page=i, zhText=zh, enText=en, illustrationPrompt=scene, imageStatus='pending') for i, (zh, en, scene) in enumerate(pages, 1)],
            metadata=dict(category='family-growth', ageRange=dict(min=4, max=8), estimatedMinutes=6,
                languages=['zh', 'en'], seriesId='richang', seriesOrder=order, personalizationEnabled=False,
                tags=['日常系列', '生活智慧', '亲子共读', *tags], featured=False, bedtimeSuitable=True),
            parentGuide=dict(goal=goal, reminder=reminder, questions=questions, activity=activity,
                ageTips=dict(age4to5='允许孩子用指画面、点头、挥手或简单词语表达；共读可以暂停，不要求当场完成故事里的练习。',
                    age6to8='讨论感受、事实和可选择的小行动，允许不同意见；由成人承担支持、约定和安全的责任。')))
        (target / f'{slug}.json').write_text(json.dumps(dict(book=book, imagePromptKit=kit), ensure_ascii=False, indent=2) + '\n')
    batch = target / 'batch-31-40'
    batch.mkdir(exist_ok=True)
    plan = [dict(id=b[0], title=b[1], pages=len(b[-1]), order=i + 31) for i, b in enumerate(BOOKS)]
    (batch / 'plan.json').write_text(json.dumps(dict(approved=True, approvedAt='2026-10-03', totalPages=180, books=plan), ensure_ascii=False, indent=2) + '\n')
    manuscript = ['# 日常系列第四批逐页文稿与分镜\n\n用户已于 2026-10-03 确认 10 本选题。插图与中文旁白按最终逐页正文制作。\n']
    for b in BOOKS:
        manuscript.append(f'## {b[1]}\n\n副标题：{b[2]}\n\n寓意：{b[3]}\n\n亲子目标：{b[6]}\n\n家长提醒：{b[7]}\n')
        for i, (zh, en, scene) in enumerate(b[-1], 1):
            manuscript.append(f'### 第 {i} 页\n\n{zh}\n\n{en}\n\n分镜：{scene}\n')
        manuscript.append('共读问题：\n' + '\n'.join(f'- {question}' for question in b[8]) + f'\n\n小活动：{b[9]}\n')
    (batch / 'manuscript.md').write_text('\n'.join(manuscript))
    (batch / 'image-prompts.json').write_text(json.dumps(image_jobs(kit), ensure_ascii=False, indent=2) + '\n')
    print('Saved 10 approved books and 180 bilingual pages; illustrations and audio remain pending.')


if __name__ == '__main__':
    main()
