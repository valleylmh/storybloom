"""Save the ten approved third-batch everyday stories without replacing earlier books."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BOOKS = []


def add(slug, title, subtitle, moral, moral_en, tags, goal, reminder, questions, activity, rows):
    pages = [line.split('|') for line in rows.strip().splitlines()]
    assert all(len(row) == 3 and all(part.strip() for part in row) for row in pages), title
    BOOKS.append((slug, title, subtitle, moral, moral_en, tags, goal, reminder, questions, activity, pages))


add('wo-xiang-zi-ji-shi-yi-shi', '我想自己试一试', '这根鞋带，让我来',
    '自己的事情可以慢慢尝试，需要帮助时也可以说出来。',
    'You can take time to try things yourself and ask for help when you need it.',
    ['自主尝试', '适当支持'], '让孩子参与决定尝试的方式、时间和需要的帮助。',
    '不把独立当作必须马上完成的考验；赶时间时说明原因，约好再试，穿鞋出门前由成人检查鞋带。',
    ['安安希望爸爸帮哪一部分，哪一部分想自己来？', '什么事情你想试试？希望身边的人怎样帮助你？'],
    '选一件安全的小事，先问孩子想自己做什么、需要怎样的协助，再留出不赶时间的尝试机会。', '''
出门前，安安坐在门边的小凳上。左脚的鞋带已经系好，右脚的两根白鞋带还松松地躺着。|Before going out, An'an sat on the little bench by the door. Her left shoe was tied, but two white laces lay loose on her right shoe.|Wide home entry: An'an sits on oak bench studying loose right white sneaker laces; Dad stands beside her with canvas outing bag; left sneaker tied.
爸爸蹲下来，手指轻轻一绕，就要替她系好。安安把手伸过来：“这一次，我想自己试试。”|Dad crouched down and began looping the laces for her. An'an reached out. “This time, I'd like to try myself.”|Entry medium shot: Dad pauses with hands near untied right shoe; An'an reaches toward her own laces, eager expression.
“好呀。”爸爸松开手。安安拿起两根鞋带，一根往左，一根往右，又一起缠到了手指上。|“Sure,” Dad said, letting go. An'an picked up both laces. One went left, one went right, and both wound around her fingers.|Close-up of An'an's hands awkwardly holding two white laces above right sneaker; Dad's hands withdrawn, no finished knot.
她拉了拉，鞋带没有变成蝴蝶结，反倒越挤越紧。“它们怎么不听我的话？”安安皱起了眉。|She tugged, but the laces did not become a bow. They only bunched up. “Why won't they do what I want?” An'an frowned.|Child face and shoe close-up: An'an frowns at loose tangled laces, no elaborate knot; Dad calmly beside her.
爸爸的手又动了一下。安安急忙说：“你先别全帮我做完。我还想再看看。”|Dad's hand moved again. An'an quickly said, “Please don't do the whole thing yet. I still want to work it out.”|Two-person entry medium shot: An'an holds up an open hand to pause Dad; right shoe remains untied, Dad listens.
爸爸把手放在膝盖上：“你希望我怎么帮？”安安想了想：“先帮我把这团松开。”|Dad rested his hands on his knees. “How would you like me to help?” An'an thought. “First, help me loosen this tangle.”|Entry close conversation: Dad and An'an at eye level, her two lace ends visible; gentle open questioning posture.
他们一起把鞋带理直。爸爸只演示交叉的第一步，又把两根鞋带交回安安手里。|Together, they straightened the laces. Dad showed only the first crossing, then put both ends back in An'an's hands.|Hands detail: Dad demonstrates two straight white laces crossed once above right shoe; An'an's hands ready to take them, no bow.
安安照着试了一次。两根鞋带终于交叉在一起，她的肩膀也慢慢放松了。|An'an tried it once. At last, the two laces crossed, and her shoulders slowly relaxed.|Medium entry shot: An'an looks pleased at a simple first lace crossing on right sneaker; Dad waits without touching.
可到了绕圈的时候，小圈又跑散了。安安抬头：“你能帮我扶住鞋子吗？别帮我绕。”|But when she tried making a loop, it slipped apart. An'an looked up. “Could you hold the shoe still? Please let me make the loop.”|Close practical scene: Dad steadies right shoe at heel while An'an forms one small loop with white lace, other lace loose.
爸爸扶着鞋后跟。安安的手空出来一点，终于做出一个小小的圈，像一只软软的兔耳朵。|Dad held the heel. With a little more room for her hands, An'an made a small loop like a soft bunny ear.|Detailed child's hands: one white lace loop held above right sneaker, Dad supports only heel, no second completed loop.
小圈还是松了。安安把鞋放下：“我的手有点累。”爸爸点点头：“可以停一会儿。”|The loop still came loose. An'an put her foot down. “My hands feel tired.” Dad nodded. “We can take a break.”|Entry medium shot: An'an rests hands on lap, untied right shoe on mat, Dad nods gently beside bench.
他们今天要赶上公园的活动。爸爸说清楚时间，又问：“这一只，现在要我帮忙系好吗？”|They needed to reach an activity at the park on time. Dad explained, then asked, “Would you like me to tie this one for now?”|Entry conversation: Dad holds outing bag beside seated An'an and gestures gently toward untied right shoe; no clock or text.
安安点点头：“今天先帮我。周末，我还想慢慢试。”爸爸系好鞋带，又检查了一下两只鞋。|An'an nodded. “Help me today. I'd like another slow try this weekend.” Dad tied the lace and checked both shoes.|Low entry view: Dad checks securely tied bows on both white red-edged sneakers while An'an sits ready to leave.
周末的早晨，他们没有急着出门。安安坐回小凳，爸爸坐在旁边，等她先伸出手。|On the weekend morning, they were in no rush. An'an returned to the little bench. Dad sat beside her and waited for her to begin.|Wide quiet entry weekend: An'an and Dad seated side by side; her right sneaker laces untied for practice, left tied; no outing bag.
这次，她记得先交叉，再拉紧。到了小圈，她说：“这一步，你再做慢一点给我看。”|This time, she remembered to cross and pull first. At the loop, she said, “Please show me that part again, more slowly.”|Close side view: An'an holds crossed laces, Dad slowly demonstrates a loop with loose separate practice lace in hands, no extra shoes.
爸爸做一小步，安安跟一小步。一个歪歪的蝴蝶结终于留在鞋面上，安安盯着它笑了。|Dad showed a small step, and An'an tried a small step. At last, a crooked bow stayed on the shoe. An'an smiled at it.|Child face and sneaker detail: An'an smiles at one slightly uneven but secure white bow on right shoe; Dad's hands away.
“我自己做了好多，还有一点是你帮的。”安安说。爸爸回答：“对，我们照着你需要的办法来。”|“I did lots of it myself, and you helped with a little,” An'an said. Dad replied, “Yes. We found the kind of help you needed.”|Warm entry two-person conversation: An'an points at tied right shoe, Dad smiles; both shoes tied, no magical glow.
出门前，爸爸再检查一遍。安安站起来，踩了踩鞋：“下次这根鞋带，也先让我试试。”|Dad checked again before they went out. An'an stood and tapped her shoes. “Next time, please let me try this lace first too.”|Wide doorway ending: An'an stands confidently in safely tied sneakers beside Dad, morning courtyard visible beyond open door.
''')

add('ming-tian-yao-dai-de-na-pian-ye-zi', '明天要带的那片叶子', '给明天的自己留个提醒',
    '忘记了可以一起补救，也可以找到适合自己的提醒办法。',
    'When you forget, you can make a repair together and find reminders that work for you.',
    ['准备习惯', '记事方法'], '把忘记一件事和孩子的品格分开，用具体方法支持记忆与准备。',
    '不把忘记称作懒惰或不负责；提醒工具由孩子参与选择，低龄孩子仍需要成人协助。采集只选安全场所的落叶。',
    ['安安为什么前一天记得，早上却忘了？', '什么提醒能让你更容易看见要做的事情？'],
    '一起画两三个简单的物品图案，放在孩子容易看到的位置，睡前共同看一遍明天的准备。', '''
老师说，明天可以带一片落叶来，看看叶子的纹路。安安马上想到公园里那片像小手掌的叶子。|The teacher said they could bring a fallen leaf tomorrow to study its patterns. An'an immediately thought of a leaf in the park shaped like a little hand.|School classroom medium shot: An'an listens to female Chinese teacher with tied black hair and sage cardigan holding a single dry maple leaf; no other children.
放学路上，她对妈妈说：“我记住啦，明天带叶子！”一片小叶子在她脑子里摇啊摇。|On the way home, she told Mom, “I remember! A leaf for tomorrow!” A little leaf seemed to wave in her mind.|City sidewalk wide shot: An'an enthusiastically gestures a leaf shape to Mom while walking home, no imaginary floating leaves.
回到家，小车的桥还没搭完。安安放下书包，先给桥加了两根长长的横梁。|At home, the bridge for her toy car was unfinished. An'an put down her bag and added two long beams to it first.|Living room floor: An'an adds two wooden beams to block bridge with red toy car; schoolbag rests beside sofa, Mom absent.
晚饭、洗澡、听故事，一件事接着一件事。那片叶子还没有装进书包，安安就睡着了。|Dinner, a bath, and a story came one after another. Before a leaf reached her schoolbag, An'an had fallen asleep.|Quiet bedroom wide shot: An'an asleep under cream quilt with yellow star clip on bedside dish; closed teal schoolbag by door, no leaf.
第二天早晨，她拉好书包拉链，忽然停住：“叶子！我没有准备叶子！”|The next morning, she zipped her bag, then stopped. “The leaf! I haven't got a leaf!”|Home entry medium shot: An'an freezes while closing teal schoolbag, surprised face; Mom nearby ready to leave, no leaf.
安安伸手翻口袋，里面只有一张纸巾。“明明昨天还记得，怎么就忘了呢？”|An'an searched a pocket and found only a tissue. “I remembered yesterday. How did I forget?”|Bag close-up: An'an's hands lift a plain white tissue from empty side pocket; worried face visible, no text or leaf.
妈妈没有催着责怪她。她蹲下来：“先看看时间，我们一起想想现在能做什么。”|Mom did not rush to blame her. She crouched down. “Let's check the time and think about what we can do now.”|Entry two-person conversation: Mom at An'an's eye level, calm expression; open bag and plain tissue nearby, no written clock.
家门口没有合适的落叶，绕去公园又会迟到。安安想了想：“我能先画一片带去吗？”|There was no suitable fallen leaf near home, and a park detour would make them late. An'an thought. “Could I draw one to take?”|Entry medium shot: An'an holds a blank small paper and pencil while discussing a possible leaf drawing with Mom.
她画了小手掌一样的叶子，又画出几条细细的纹路。妈妈陪着看，没有替她画完。|She drew a leaf like a little hand and added fine lines. Mom watched beside her without finishing it for her.|Overhead oak table: An'an draws one simple maple leaf outline with veins on plain paper; Mom's hands remain away from drawing, no words.
到了学校，安安告诉老师：“我忘了准备，这是我画的。今天这样可以吗？”|At school, An'an told her teacher, “I forgot to get a leaf. I drew this one. Would this be okay for today?”|Classroom doorway medium shot: An'an presents single paper leaf drawing to same sage-cardigan teacher; teal schoolbag on back.
老师说：“今天可以先用这张，也看看我们准备的叶子。”安安松了口气，坐下来认真摸了摸叶脉。|The teacher said, “You can use it today and look at the leaves we have.” Relieved, An'an sat down and gently felt a leaf's veins.|Classroom table close shot: An'an touches veins of one real dry maple leaf beside her paper drawing; teacher beside her, no labels.
放学后，妈妈问：“有什么办法，能让明天的你看见今天记住的事？”安安望向书包。|After school, Mom asked, “What could help tomorrow's you see what you remember today?” An'an looked at her bag.|Home oak table conversation: An'an and Mom look toward teal schoolbag beside chair, thoughtful faces.
她画了水杯、纸巾和一片叶子，把小纸贴在书包旁。全是图画，一眼就能认出来。|She drew a water bottle, a tissue, and a leaf, then put the paper beside her bag. They were pictures she could recognize at a glance.|Overhead desk: An'an draws three simple icons of bottle, tissue and leaf on one plain paper; teal bag beside it; no letters, numbers or checkboxes.
妈妈提议：“睡前我们一起看一遍？”安安点头，又给准备好的东西找了一个小篮子。|Mom suggested, “Shall we look at it together before bed?” An'an nodded and chose a small basket for things that were ready.|Home entry medium shot: An'an places empty shallow woven basket beside teal bag and picture reminder; Mom watches gently.
傍晚，他们在公园捡到一片干净的落叶。安安轻轻夹进纸夹，回家放进小篮子里。|That evening, they found a clean fallen leaf in the park. An'an put it gently in a paper folder, then in the basket at home.|Park path close scene: An'an picks one dry maple leaf from clean dry ground beside Mom; plain paper folder in Mom's hand.
睡前，安安看看图画，再看看篮子：“叶子在，水杯也在。”她和妈妈一起完成了准备。|Before bed, An'an looked at the pictures and the basket. “The leaf is here, and so is the bottle.” She and Mom checked everything together.|Evening entry medium shot: An'an and Mom check basket with closed paper folder and water bottle next to teal schoolbag and three-icon reminder.
第二天出门时，安安又想去看小车。门边的图画让她停了一下，先把小篮子里的东西装好。|The next morning, An'an wanted to look at her toy car again. The pictures by the door made her pause and pack the basket's things first.|Morning entry scene: An'an packs closed paper folder and water bottle into teal bag while looking at simple picture reminder; Mom waits.
“昨天的我，给今天的我留了封小信。”安安笑着背起书包。那片叶子，这一次也出发了。|“Yesterday's me left today's me a little message,” An'an said, smiling as she put on her bag. This time, the leaf came along too.|Wide doorway ending: An'an with teal schoolbag and Mom leave home happily; picture reminder and now-empty shallow basket remain by doorway.
''')
add('le-le-you-le-xin-peng-you', '乐乐有了新朋友', '朋友的位置，会变小吗',
    '朋友可以认识更多朋友，自己的失落也值得被听见。',
    'Friends can make more friends, and your feelings of sadness still deserve to be heard.',
    ['友谊变化', '安全感'], '接纳友谊中的失落与嫉妒，练习表达需要而不控制朋友。',
    '不以占有欲羞辱孩子，也不强迫加入新群体；持续排斥或欺负需要成人帮助，不用交新朋友掩盖伤害。',
    ['安安看见乐乐和小宇一起玩时，担心的是什么？', '朋友和别人玩时，你希望怎样告诉他自己的感受？'],
    '用玩偶演一段约玩的对话，练习说“我也想和你玩，我们可以约什么时候”，允许对方有不同安排。', '''
放学后，安安抱着小车来到院子。乐乐正在和一个新朋友踢球，两个人的笑声跑得很远。|After school, An'an brought her toy car to the courtyard. Lele was kicking a ball with a new friend, and their laughter carried far.|Wide courtyard: An'an arrives holding red toy car; Lele and Xiaoyu, same-age Chinese boy with short dark hair, forest-green sweatshirt and charcoal trousers, kick orange ball.
乐乐挥挥手：“安安，这是小宇！”安安也挥了一下，却把准备好的小车藏到了身后。|Lele waved. “An'an, this is Xiaoyu!” An'an waved too, but hid the car she had brought behind her back.|Three-child medium shot: Lele introduces smiling Xiaoyu in green; An'an stands apart hiding red car behind back.
她原本想和乐乐搭一座桥。现在，球来来回回，小车好像没有停靠的位置。|She had planned to build a bridge with Lele. Now the ball went back and forth, and her car seemed to have nowhere to stop.|Close An'an thoughtful face with red car held low; Lele and Xiaoyu softly visible playing ball in courtyard background.
“你要来踢吗？”小宇问。安安摇摇头：“我不太会。”其实，她心里还有一点说不出的酸。|“Would you like to kick?” Xiaoyu asked. An'an shook her head. “I'm not very good at it.” Inside, she also felt an ache she could not quite explain.|Courtyard medium shot: Xiaoyu gently offers orange ball toward An'an; she holds red car and looks uncertain; Lele nearby.
乐乐说：“那我们踢完再找你。”安安坐到长椅上，推着小车，只听见自己很轻的车轮声。|Lele said, “We'll find you when we're done.” An'an sat on the bench and pushed her car, hearing its wheels roll very softly.|Courtyard bench medium shot: An'an alone pushes red car on bench; distant Lele and Xiaoyu continue ball game safely apart.
他们又笑了起来。安安心里冒出一个念头：“乐乐是不是已经不需要我这个朋友了？”|They laughed again. A thought came to An'an. “Does Lele not need me as a friend anymore?”|Close view of An'an worried on bench holding red car, distant two boys blurred, no imagined symbols or thought bubbles.
回家路上，她没有像平时那样讲话。妈妈问：“今天的小车，好像也很安静？”|On the way home, she was quieter than usual. Mom asked, “Your little car seems quiet today too. What happened?”|City sidewalk dusk: Mom walks beside quiet An'an holding red toy car, attentive expression.
安安低头说：“乐乐有新朋友了。他和小宇玩得那么开心，我怕以后都轮不到我。”|An'an looked down. “Lele has a new friend. He had such fun with Xiaoyu. I'm afraid there won't be any turns left for me.”|Park bench conversation: An'an tells Mom her worry while gripping red car; Mom listens at eye level.
妈妈听完，轻轻说：“你很珍惜乐乐，也有点怕失去他。这份难过，可以说出来。”|Mom listened, then said softly, “Lele matters to you, and you're afraid of losing him. You can talk about that sadness.”|Close warm conversation between Mom and An'an seated side by side, no forced smile or hug.
“可我又不想让他只能和我玩。”安安说。妈妈点点头：“你可以说想念，也给他自己的选择。”|“But I don't want him to play only with me,” An'an said. Mom nodded. “You can say you miss him and still leave him a choice.”|Medium park bench: An'an looks up thoughtfully at Mom; red car on child's lap, calm late sunlight.
第二天，安安找到乐乐：“昨天我有点难过。我带了小车，其实很想和你搭桥。”|The next day, An'an found Lele. “I felt a little sad yesterday. I brought my car because I really wanted to build a bridge with you.”|School courtyard two-child conversation: An'an speaks openly to Lele holding red toy car; Xiaoyu absent.
乐乐睁大眼睛：“我没看见小车。我以为你不想踢球，就想先自己玩。”|Lele's eyes widened. “I didn't see the car. I thought you didn't want to play ball and wanted some time alone first.”|Two-child close shot: Lele looks surprised and listens; An'an holds car openly between them.
“不想踢球，和不想跟你玩，不是一回事。”安安说完，胸口那团紧紧的感觉小了一点。|“Not wanting to kick a ball isn't the same as not wanting to play with you,” An'an said. The tight feeling in her chest eased a little.|Courtyard medium shot: An'an explains gently with open hand, Lele attentive, red car on nearby bench.
乐乐想了想：“今天放学，我们先搭桥，好吗？明天我约了小宇踢球。”安安点点头。|Lele thought. “Shall we build the bridge after school today? Tomorrow, I promised Xiaoyu a ball game.” An'an nodded.|School courtyard plan conversation: Lele and An'an smile softly beside bench, no written calendar or clock.
到了约好的时间，乐乐真的来了。他带了两根长积木：“昨天你想搭的，是哪一种桥？”|At the time they had agreed, Lele really came. He brought two long blocks. “What kind of bridge did you want to build yesterday?”|An'an home living room: Lele arrives with two long wooden blocks; An'an beside red car and loose blocks on rug.
他们搭了一座能让小车通过的桥。安安看着车轮滚过去，觉得昨天没说完的话，也有了地方。|They built a bridge the car could cross. Watching its wheels roll over, An'an felt there was room for the things she had left unsaid yesterday too.|Ground-level living room shot: An'an pushes red car across completed simple block bridge; Lele supports side, two children only.
过了一会儿，小宇来找乐乐。乐乐问安安：“你愿意一起搭吗？也可以先把这辆车开完。”|A little later, Xiaoyu came to find Lele. Lele asked An'an, “Would you like us all to build? You can finish driving this car first too.”|Living room doorway scene: Xiaoyu in green arrives, Lele asks An'an beside completed bridge; An'an holds red car, three children.
安安想了一会儿：“一起搭吧。小宇，你愿意修一条去公园的路吗？”小宇蹲了下来。|An'an thought for a moment. “Let's build together. Xiaoyu, would you like to make a road to the park?” Xiaoyu crouched down.|Wide living room floor: An'an and Lele by bridge, Xiaoyu begins a row of plain wooden blocks as road, red car on bridge.
后来，有时他们三个人玩，有时两个人玩。不是每一次都能凑到一起，他们就再约一个时间。|Later, sometimes all three played, and sometimes two did. They could not meet every time, so they made another plan when they needed to.|Courtyard wide single scene: An'an and Lele build outdoor block road while Xiaoyu nearby with orange ball waiting comfortably, three children.
安安把小车开进新修的路。乐乐有了新朋友，而他们那座熟悉的小桥，也还在这里。|An'an drove her car onto the new road. Lele had a new friend, and the familiar little bridge they shared was still here too.|Warm living room ending: three children around bridge and road, An'an drives red car across familiar bridge, comfortable shared play.
''')

add('wo-ye-xiang-ba-hua-shuo-wan', '我也想把话说完', '餐桌边，留一个听的位置',
    '每个人的话都值得被听见，也需要给别人说完的时间。',
    'Everyone deserves to be heard, and everyone needs time to finish speaking.',
    ['表达', '倾听'], '让孩子知道可以提出被听见的需要，成人示范轮流说话和修复打断。',
    '不要求孩子靠足够响亮或足够有趣换取倾听；紧急求助可以立即打断，注意力困难时缩短谈话并提供支持。',
    ['安安被打断时，身体和心情有什么变化？', '别人说话时，你可以怎样让他知道自己在听？'],
    '选一个短短的共聊时间，每人讲一件小事，听的人回应一个听见的细节，不把活动变成表达比赛。', '''
晚饭时，安安想讲学校里的一件事：“今天，我们发现了一片像小手掌的叶子……”|At dinner, An'an wanted to tell a story from school. “Today, we found a leaf shaped like a little hand...”|Warm oak dinner table wide shot: An'an begins telling story to Mom and Dad over simple meal, pale green kitchen cabinets.
爸爸刚想到明天的安排，转头对妈妈说：“早上出门的时间，要不要改一下？”安安的话停住了。|Dad remembered tomorrow's plans and turned to Mom. “Should we change the time we leave in the morning?” An'an's words stopped.|Dinner medium shot: Dad turns toward Mom mid-conversation; An'an sits with mouth just closing and hand raised slightly.
妈妈接着说起要带的东西。安安等了等，又开口：“那片叶子的背面……”|Mom started talking about what they needed to bring. An'an waited, then tried again. “On the back of that leaf...”|Dinner medium shot: Mom talking to Dad, An'an leans forward trying to continue; no leaf or paper props on table.
爸爸没听见，继续说了下去。安安低头拨了拨餐巾，刚才那件有趣的事，好像越来越小。|Dad did not hear and kept talking. An'an looked down and fiddled with her napkin. The interesting thing she had wanted to tell felt smaller and smaller.|Close An'an at table looking down at cream napkin, parents softly out of focus talking behind.
她吸了一口气：“我还没有讲完。我也想把话说完。”这一次，爸爸妈妈都停了下来。|She took a breath. “I haven't finished yet. I would like to finish my story too.” This time, both Mom and Dad stopped.|Dinner three-person medium shot: An'an speaks earnestly, both parents turn attentively toward her with still hands.
妈妈把筷子放稳：“对不起，我刚才接着说自己的事了。你讲到叶子的背面，对吗？”|Mom put down her chopsticks. “I'm sorry. I went on with my own thoughts. You were telling us about the back of the leaf, right?”|Close Mom listening kindly across oak table, chopsticks resting on ceramic holder; An'an looks up.
安安点头：“背面的纹路凸起来，摸着像小路。正面颜色深，背面却浅一点。”|An'an nodded. “Its veins stood out on the back, like little roads. The front was darker, and the back was a little lighter.”|Dinner medium shot: An'an gestures a leaf shape and fine paths with hands, parents watch, no imaginary diagrams or text.
爸爸问：“你用手指摸过了吗？”安安笑了：“摸过，很轻很轻地摸。”那件事又变得亮亮的。|Dad asked, “Did you feel it with your fingers?” An'an smiled. “I did, very, very gently.” The story felt bright again.|Warm close conversation: Dad asks An'an with interested face, child lightly taps her fingertips together, Mom listens.
妈妈说：“我们刚才一忙，就忘了你也在说话。”爸爸点头：“明天的安排，可以等你讲完再说。”|Mom said, “We got busy and forgot you were speaking too.” Dad nodded. “Our plans can wait until you finish.”|Three-person dinner table medium shot: parents acknowledge mistake calmly to relaxed child, simple meal unchanged.
他们商量，谁正在讲，别人就先听一小会儿。想接话时，可以让对方知道，不急着抢过去。|They agreed to give the person speaking a little time. If someone wanted to add something, they could let that person know without rushing in.|Wide dinner table: An'an Mom Dad discuss with relaxed open hands, no written rules, no token object.
轮到爸爸讲时，安安又想起叶子上的一只小虫。话跑到嘴边，她先把手轻轻抬了一下。|When Dad began his story, An'an remembered a tiny insect on the leaf. The words reached her lips, but she gently raised a hand first.|Dinner medium shot: Dad speaking, An'an raises one hand slightly with eager expression, Mom watches both attentively.
爸爸看见了：“我把这一小段讲完，就听你说。”安安点点头，先听见爸爸今天走错了一条路。|Dad noticed. “I'll finish this little part, then listen to you.” An'an nodded and heard how Dad had taken a wrong turn that day.|Two-person close shot: Dad talks gently to An'an, her raised hand lowers, child attentive; no imagined street scene.
“后来呢？”安安问。爸爸笑着告诉她，他问了路，又绕回熟悉的街口。听着听着，她也想知道结尾。|“What happened next?” An'an asked. Dad smiled and explained how he asked for directions and returned to a familiar corner. She wanted to hear the ending too.|Dinner medium shot: An'an leans in interested, Dad smiles as he tells story, Mom quietly listening.
爸爸讲完，转向她：“你刚才想补充什么？”安安这才说起那只停在叶子边上的小虫。|Dad finished and turned to her. “What did you want to add?” Only then did An'an tell them about the little insect at the edge of the leaf.|Dinner close An'an animatedly describing tiny insect with fingers, Dad and Mom looking at her; no actual insect at food table.
第二天，妈妈说到一半，安安忽然插进了自己的话。妈妈提醒：“我也还没有说完。”|The next day, An'an suddenly jumped in while Mom was talking. Mom reminded her, “I haven't finished my story either.”|Next evening same table: Mom speaking kindly with one open palm, An'an pauses mid-sentence, Dad listens.
安安停住：“好，你先讲。我怕忘记，等会儿你提醒我好吗？”妈妈答应，把话讲得短一点。|An'an stopped. “Okay, you go first. I'm afraid I'll forget. Could you remind me afterward?” Mom agreed and kept her story a little shorter.|Two-person dinner conversation: An'an asks for help remembering, Mom nods warmly; relaxed meal, no written notes.
有时他们还是会忘记，话撞到一起。有人提醒，就停一下、让一下，再把没说完的部分接回来。|Sometimes they still forgot, and their words collided. When someone reminded them, they paused, made room, and returned to the unfinished part.|Dinner three-person scene: all share gentle amused expressions after accidental overlap, An'an gestures to let Dad continue.
安安发现，餐桌边不只要留坐下的位置，也要留一个好好听的位置。她的小故事，终于能讲到结尾了。|An'an found that a table needed more than room to sit. It needed room to listen too. Her little stories could finally reach their endings.|Wide cozy dinner ending: An'an finishes a story smiling, Mom and Dad listen with full attention, warm kitchen light.
''')

add('xiao-che-zen-me-dao-le-ni-jia', '小车怎么到了你家', '先问一问，再找一找',
    '看起来很像，不一定就是同一件事；先了解，再判断。',
    'Things that look alike are not always the same. Find out more before deciding.',
    ['了解事实', '判断'], '帮助孩子区分看见的事实、心里的猜测和需要核对的信息。',
    '不把弄错当作撒谎，也不让孩子独自调查可能的危险；认真回应物品丢失的担心，成人协助了解情况。',
    ['安安一开始看见了什么，又猜了什么？', '如果发现自己的东西不见了，你可以先问谁、找哪里？'],
    '选两件相似的小物品，一起找相同和不同的地方，练习说“我看见……”和“我还需要问问……”。', '''
安安去乐乐家玩，一进门就看见一辆红色小车。圆圆的车灯，黑黑的车轮，和她那辆几乎一样。|An'an went to play at Lele's home. Just inside, she saw a red toy car with round lights and black wheels, almost exactly like hers.|Lele home wide entry: An'an sees one red toy car with round headlights and black wheels on low gray shelf; Lele beside her.
她停住了。今天早上，她正好没找到自己的小车。“我的车怎么到了这里？”这个念头一下跳了出来。|She stopped. That very morning, she had not found her own car. “How did my car get here?” The thought sprang into her mind.|Close An'an surprised face looking toward red car on gray shelf in Lele home, no second car.
乐乐拿起小车：“我们让它走新修的路吧！”安安没有伸手，心里像打了一个紧紧的结。|Lele picked up the car. “Let's drive it on the new road!” An'an did not reach for it. Her feelings seemed tied in a tight knot.|Lele home medium shot: Lele holds red toy car inviting play, An'an tense with hands still at sides.
她问：“这是从哪里来的？”声音比平时硬了一点。乐乐愣了愣：“爷爷昨天送给我的。”|She asked, “Where did this come from?” Her voice sounded sharper than usual. Lele paused. “Grandpa gave it to me yesterday.”|Two-child conversation in Lele living room: An'an asks seriously, Lele surprised holding one red car; no Grandpa depicted.
“可是它跟我的一样，我的又不见了。”安安说。乐乐抱着小车：“这辆是我的呀。”|“But it looks like mine, and mine is missing,” An'an said. Lele held the car. “This one is mine.”|Medium view: Lele holds red car close calmly but worried; An'an explains with open hand; Mom enters doorway behind her.
妈妈听见了，先问安安：“你很担心自己的车，对吗？”安安点头，眼睛还盯着红色车顶。|Mom heard and first asked An'an, “You're worried about your own car, aren't you?” An'an nodded, still watching the red roof.|Lele living room three-person shot: Mom crouches beside An'an, Lele with car opposite, gray shelf background.
妈妈说：“现在我们知道，这里有辆很像的小车。它是不是你的，还需要再了解一点。”|Mom said, “We know there's a car here that looks like yours. We still need to find out whether it's the same one.”|Close Mom and An'an calm conversation while Lele holds red car nearby, no accusing gestures.
安安想起，自己的车底贴过一个蓝色小圆点。她问乐乐：“可以看看车底吗？我们一起看。”|An'an remembered a little blue dot on the bottom of hers. She asked Lele, “May we look underneath? We can look together.”|Two-child medium shot: An'an asks permission pointing gently toward underside of Lele's car; Lele listens, Mom nearby.
乐乐把小车翻过来。车底没有蓝圆点，只有他昨天贴的一枚绿色小三角。|Lele turned his car over. There was no blue dot underneath, only a little green triangle he had added yesterday.|Close-up of single upside-down red toy car in Lele's hands showing exactly one solid green triangle underneath, no blue dot or text.
安安摸摸自己的口袋。原来，颜色一样、车轮一样，也可能是两辆不同的小车。|An'an touched her pocket. The same color and the same wheels could still belong to two different cars.|Lele home medium shot: An'an thoughtful beside Lele holding red car upright, Mom listens, no second car yet.
她对乐乐说：“我刚才太着急，差点认定你拿了我的。这样问，让你不舒服了吧？”|She told Lele, “I was so worried that I almost decided you'd taken mine. Did the way I asked make you uncomfortable?”|Two-child close conversation: An'an speaks earnestly at respectful distance, Lele listens holding car; Mom stays quietly in background.
乐乐点点头：“我想给你看看新车，不想被当成拿东西的人。”安安轻声说：“对不起。”|Lele nodded. “I wanted to show you my new car. I didn't want you to think I'd taken yours.” An'an softly said, “I'm sorry.”|Lele living room medium shot: Lele explains feelings calmly, An'an listens and apologizes gently, car between them.
他们先把乐乐的小车放回架子。妈妈陪安安回家，找一找她最后玩过小车的地方。|They put Lele's car back on its shelf. Mom went home with An'an to look where she had last played with hers.|Lele entry scene: Lele returns his red car to low gray shelf; Mom and An'an prepare to leave together, no second car.
沙发前有一座旧积木桥。安安蹲下来，往桥后看，又趴低一点，看看沙发下面。|An old block bridge stood before the sofa. An'an crouched to look behind it, then lowered herself to see under the sofa.|An'an home living room low wide shot: An'an peers under sofa near old wooden block bridge, Mom kneels beside her, car not yet visible.
一只黑车轮露了出来。妈妈帮她把小车够出来，安安翻到车底：蓝色小圆点，好好地贴在那里。|A black wheel appeared. Mom helped reach the car, and An'an turned it over. The little blue dot was still there underneath.|Close An'an hands holding upside-down recovered red car with exactly one solid blue circle underneath; Mom nearby, sofa behind, no green triangle.
“它根本没有去乐乐家。”安安说，“是我先把看见的，和猜到的，放在一起了。”|“It never went to Lele's home,” An'an said. “I put what I saw and what I guessed together too quickly.”|Home living room conversation: An'an holds recovered red car and talks thoughtfully to Mom, block bridge and sofa nearby.
下午，她带着自己的小车再去找乐乐。两辆红车并排停着，一辆有蓝圆点，一辆有绿三角。|That afternoon, she brought her car back to Lele. The two red cars parked side by side, one with a blue dot and one with a green triangle.|Lele home overhead scene: two otherwise identical red cars held upside down side by side, one blue circle and one green triangle, children's hands.
安安笑了：“这次，我们真的有两辆车了。”小车一前一后过桥，她也记住了，着急时先问一问。|An'an smiled. “This time, we really do have two cars.” They crossed the bridge one after the other, and she remembered to ask before deciding when worried.|Warm Lele living room ending: An'an and Lele drive two identical red cars in single file over plain block bridge, happy calm play.
''')
add('zhao-bu-dao-de-xiao-xiong', '找不到的小熊', '想念，也有一个位置',
    '心爱的东西丢了，难过可以被陪伴，想念也可以慢慢安放。',
    'When something you love is lost, you deserve company in your sadness and room for your memories.',
    ['物品丢失', '情绪陪伴'], '承认依恋物品丢失带来的难过，提供实际寻找和持续陪伴。',
    '不保证一定找回，也不急着用新玩具替代；成人负责联络可靠的工作人员和照看孩子，允许反复想念。',
    ['小熊不见时，安安最想念它的什么？', '难过的时候，你希望别人陪你做什么，或者先不做什么？'],
    '为一件有感情的物品画一页小故事；孩子不愿意画时，可以只说说、抱一抱，或安静待在一起。', '''
安安的小熊有软软的棕色耳朵，脖子上系着蓝丝带。去公园时，她把它放进自己的小布袋。|An'an's teddy had soft brown ears and a blue ribbon around its neck. She put it in her little cloth bag for a trip to the park.|Home entry medium shot: An'an gently puts one small tan teddy bear with blue neck ribbon into plain cream cloth bag; Mom beside her.
他们在长椅上吃点心，安安让小熊坐在身边。风吹动蓝丝带，她还帮小熊理了理。|They had a snack on a bench, and An'an sat her teddy beside her. The wind stirred its blue ribbon, and she straightened it.|Park bench wide shot: An'an and Mom seated having small snack; tan teddy with blue ribbon sits directly beside An'an, cream cloth bag open.
回到家，安安伸手摸布袋，里面却空空的。她又摸了一遍：“小熊呢？”|At home, An'an reached into the cloth bag, but it was empty. She felt inside again. “Where's Teddy?”|Home entry close shot: An'an opens empty cream cloth bag with startled expression; Mom nearby, absolutely no teddy visible.
她翻过书包，又看过鞋柜。小熊没有躲在任何一个熟悉的角落，安安的眼睛慢慢红了。|She checked her schoolbag and the shoe cabinet. Teddy was not in any familiar corner, and her eyes slowly grew red.|Entry wide shot: An'an checks open low shoe cabinet beside teal schoolbag and empty cream bag; Mom watches, no teddy.
“可能还在公园。”妈妈说，“我们一起回去找。我陪着你。”安安抓紧了她的手。|“It may still be in the park,” Mom said. “Let's go back together. I'll stay with you.” An'an held her hand tightly.|Home doorway medium shot: Mom holds worried An'an's hand ready to retrace route; empty cream bag in Mom's other hand, no teddy.
长椅上没有小熊，树旁也没有。安安看了很久，仿佛多看一会儿，蓝丝带就会露出来。|Teddy was not on the bench or beside the tree. An'an looked for a long time, as though another look might reveal its blue ribbon.|Park bench wide shot: An'an and Mom search around clearly empty bench and nearby tree, soft afternoon light, no teddy or blue ribbon.
妈妈向公园工作人员说明小熊的样子，留下联系方式。安安站在她身边，等着听有没有消息。|Mom described Teddy to a park attendant and left contact details. An'an stood beside her, waiting to hear whether there was news.|Park service desk medium shot: Mom talks to middle-aged Chinese woman attendant in plain blue polo; An'an beside Mom, no readable signs or teddy.
他们沿着来时的小路再找了一遍，还是没有。妈妈轻声说：“今天暂时没找到，我们先回家休息。”|They searched the path once more, but found nothing. Mom softly said, “We haven't found him today. Let's go home and rest for now.”|Park path dusk wide shot: Mom and sad An'an walk hand in hand, empty cream bag, tired gentle posture, no teddy.
安安摇头：“我不想回去。小熊晚上会不会也找不到家？”她的眼泪终于掉了下来。|An'an shook her head. “I don't want to go. What if Teddy can't find home tonight either?” At last, her tears fell.|Close park path scene: An'an crying while holding Mom's hand, Mom bends to listen, no imagined lost living bear.
妈妈抱住她：“你很想它。没找到很难受，我知道。我们会继续问消息，但现在还不能保证找回来。”|Mom hugged her. “You miss him. Not finding him hurts, I know. We'll keep asking, but we can't promise we'll find him yet.”|Medium tender park embrace: Mom comforts crying An'an at eye level, cream bag hanging from Mom's arm, no teddy.
回家后，安安没有马上想玩别的。妈妈坐在旁边，陪她安静了一会儿，没有催她快点高兴。|At home, An'an did not want another game right away. Mom sat beside her quietly without urging her to cheer up.|Living room sofa medium shot: sad An'an and Mom sit quietly close together, empty bag nearby, no new toy or teddy.
睡前，小熊常躺的位置空了。安安摸摸那一小块枕头：“我记得它的耳朵，有一点卷。”|At bedtime, Teddy's usual place was empty. An'an touched that little part of the pillow. “I remember one of his ears curled a bit.”|Bedtime bedroom close shot: An'an in pale-yellow pajamas touches an empty spot on cream pillow; Mom beside bed, no teddy, hairclip on bedside dish.
妈妈拿来纸和笔：“想把记得的样子画下来吗？”安安点头，画了一对圆耳朵和一条蓝丝带。|Mom brought paper and pencils. “Would you like to draw what you remember?” An'an nodded and drew round ears and a blue ribbon.|Bedroom desk overhead: An'an in pale-yellow pajamas draws simple tan teddy with blue ribbon on paper, Mom nearby; drawn teddy only, no real teddy.
她又画了小熊坐过的长椅。纸上有一段他们一起去公园的下午，也有她现在的想念。|She also drew the bench Teddy had sat on. The paper held part of their afternoon in the park and the missing she felt now.|Close paper drawing scene: child's illustration of tan teddy with blue ribbon on bench, An'an's pencil adding tree; no real teddy or words.
第二天，妈妈继续问消息。小熊还没找到，安安把小画夹放在床边，想看时就打开一下。|The next day, Mom asked for news again. Teddy was still missing. An'an kept the drawing folder by her bed and opened it when she wanted.|Daytime bedroom medium shot: An'an in teal jacket opens plain folder showing teddy drawing beside bed; Mom nearby, no real teddy.
有时候，她玩着积木又想起小熊，就停下来告诉爸爸。爸爸听完，坐在她身边陪了一会儿。|Sometimes she remembered Teddy while playing with blocks. She paused and told Dad, who listened and sat beside her for a while.|Living room floor: An'an pauses by wooden blocks to speak to Dad in navy sweater seated beside her; no teddy or replacement toy.
后来，安安又能和乐乐玩一会儿，也还是会想念小熊。两种感觉，一起留在她的小日子里。|Later, An'an could enjoy playing with Lele again and still miss Teddy. Both feelings had a place in her days.|Courtyard gentle scene: An'an and Lele roll red toy car along bench with faint warm smiles, no teddy, comfortable shared play.
夜里，妈妈抱了抱安安。枕边的小画夹还在，小熊的位置也留着。没找到的难过，有人陪她慢慢走。|That night, Mom hugged An'an. The drawing folder stayed by the pillow, and Teddy's place remained. She had someone beside her through the sadness of not finding him.|Warm bedtime ending: An'an in pale-yellow pajamas hugs Mom, plain closed drawing folder beside cream pillow with clearly empty space, no teddy.
''')

add('ni-zen-me-mei-dai-wo-de-mao-zi', '你怎么没戴我的帽子', '礼物里的小小期待',
    '送出心意，也给对方选择怎样喜欢和使用礼物的空间。',
    'Give your kindness, and leave the other person room to enjoy and use the gift in their own way.',
    ['送礼心意', '期待与选择'], '帮助孩子表达送礼后的期待，也理解收礼者有自己的意愿。',
    '不要求收礼者必须喜欢、收下或按赠送者的方式使用；允许送礼者失落，避免把礼物变成关系交换条件。',
    ['安安除了送帽子，还悄悄期待了什么？', '如果朋友使用礼物的方式和你想的不一样，你会想说什么？'],
    '用玩偶练习送礼前询问喜欢什么，以及收礼时真诚表达感谢和自己的想法，允许拒绝。', '''
安安用一张蓝色纸做了小帽子。她画上黄星星，想送给乐乐：“他戴着，一定很好看。”|An'an made a little hat from blue paper and drew yellow stars on it. She wanted to give it to Lele. “It would look lovely on him.”|Overhead craft table: An'an makes one blue paper cone hat decorated with simple yellow star shapes, scissors safely put aside, no text.
帽边有点歪，她又压了压。忙了一个下午，安安把帽子托在手里，心里藏着亮亮的期待。|The edge was a little crooked, so she pressed it again. After a whole afternoon, she held the hat with a bright little hope inside.|Close An'an proudly holding completed blue paper cone hat with yellow stars at oak table, no Lele yet.
“送给你！”她把帽子交给乐乐。乐乐接过来，认真看了看：“谢谢，你画了好多小星星。”|“For you!” She handed the hat to Lele. He looked at it carefully. “Thank you. You drew so many little stars.”|Courtyard two-child medium shot: An'an hands single blue yellow-star paper hat to Lele, who accepts appreciatively.
乐乐试戴了一下，安安开心地拍手。她想，下次见面，朋友一定还会戴着自己的帽子。|Lele tried it on, and An'an clapped happily. She imagined her friend would still be wearing her hat the next time they met.|Courtyard medium shot: Lele briefly wears blue paper star hat, An'an claps happily; simple cone proportion fits child head.
第二天，乐乐来玩，头上没有帽子。安安看了又看：“你怎么没戴我送的帽子？”|The next day, Lele came to play without the hat. An'an looked twice. “Why aren't you wearing the hat I gave you?”|An'an home doorway scene: Lele arrives bareheaded, An'an looks at his head with disappointed surprise; no hat visible.
乐乐说：“我给我的小熊戴上了。它坐在窗边，像个小小的国王。”安安却没有笑。|Lele said, “I put it on my teddy. He sits by the window like a little king.” But An'an did not smile.|Two-child living room conversation: Lele explains with cheerful gesture, An'an subdued; no actual teddy or hat in this scene.
“那是我做给你的，又不是给小熊的。”安安低着头，“你是不是不喜欢？”|“I made it for you, not your teddy,” An'an said, looking down. “Don't you like it?”|Close An'an disappointed face beside Lele, plain living room rug and blocks, no hat visible.
乐乐想了想：“我喜欢星星，也喜欢你想到我。可是，我不想一直把纸帽戴在头上。”|Lele thought. “I like the stars, and I like that you thought of me. But I don't want to wear a paper hat all the time.”|Two-child medium shot: Lele speaks gently with open hands, An'an listens, no forced hat wearing.
安安没有马上接话。她花了好多时间，原来还盼着，乐乐每天都让她看见这份喜欢。|An'an did not answer right away. She had spent so much time on it and had hoped Lele would show her every day how much he liked it.|Close thoughtful An'an sitting on rug with hands in lap, Lele beside her at respectful distance.
乐乐问：“你要不要去看看？我给小熊搭了王座。”安安犹豫一下，还是跟他去了。|Lele asked, “Would you like to see? I built Teddy a throne.” An'an hesitated, then went with him.|Courtyard wide walking scene: An'an and Lele walk together toward his home, calm conversation, no hat yet.
窗边，小熊坐在积木椅子上。蓝帽子的黄星星正对着阳光，安安轻轻摸了摸帽边。|By the window, Teddy sat on a block chair. The blue hat's yellow stars faced the sunlight. An'an gently touched its edge.|Lele home window scene: plain tan toy teddy with red neck ribbon sits on simple block chair wearing blue paper cone hat with yellow stars; An'an and Lele inspect.
帽子没有被丢开，它有了安安没想到的用法。可是她的那一点失落，也没有马上消失。|The hat had not been thrown aside. It had found a use An'an had not imagined. Still, her little sadness did not disappear at once.|Close An'an thoughtfully touches star hat edge on toy teddy; Lele beside her, soft sunlight, no forced big smile.
回家后，她告诉妈妈：“我送帽子的时候，好像还送了一个要求：你要一直戴给我看。”|At home, she told Mom, “When I gave the hat, I think I gave a little demand too: you must keep wearing it for me to see.”|Home oak table medium conversation: An'an talks thoughtfully to Mom with empty hands, no hat or teddy present.
妈妈说：“有期待很正常，可以说出来。礼物送给他以后，也要听听他自己的想法。”|Mom said, “It's natural to have hopes. You can talk about them. And after giving a gift, you need to hear his ideas too.”|Close Mom listening warmly at table, An'an thoughtful, pale green cabinets behind, no scolding gestures.
第二天，安安对乐乐说：“我昨天有点失落。现在我知道，你喜欢帽子，也可以用自己的办法。”|The next day, An'an told Lele, “I felt a little sad yesterday. Now I know you can like the hat and use it in your own way.”|Courtyard two-child conversation: An'an speaks openly to bareheaded Lele, calm warm faces, no hat prop.
乐乐笑了：“你做的星星，让我的小熊有了一座夜空王国。”安安听见这句话，心里暖了一点。|Lele smiled. “Your stars gave my teddy a kingdom of night skies.” Hearing that, An'an felt a little warmer inside.|Lele home medium shot: Lele shows An'an toy teddy on block chair wearing blue yellow-star hat by window, both smile softly.
他们又用纸做了小旗子。安安先问：“你想放在哪里？”乐乐说：“放在王座两边，好吗？”|They made little paper flags together. An'an asked first, “Where would you like them?” Lele said, “Beside the throne, shall we?”|Overhead Lele craft table: An'an and Lele make two small plain yellow paper flags on short craft sticks beside teddy throne and blue star hat; no lettering.
安安把小旗递过去。这一次，她送出自己的心意，也给朋友留了一点选择的地方。|An'an handed him the flags. This time, she gave her kindness and left her friend a little room to choose too.|Warm window ending: Lele places two yellow paper flags beside block throne with teddy wearing blue star hat; An'an watches comfortably, two children.
''')
def image_jobs():
    kit = json.loads((ROOT / 'content-drafts/richang/lan-ping-guo.json').read_text())['imagePromptKit']
    characters = {
        "An'an": "An'an is a six-year-old Chinese girl, round face, ear-length straight black bob, yellow star hair clip on her left, plain teal zip-front hoodie, blue jeans, white sneakers with red trim and white laces.",
        'Mom': 'Mom is a Chinese adult with shoulder-length black hair, coral cardigan and cream trousers.',
        'Dad': 'Dad is a Chinese adult with short black hair, navy sweater and beige trousers.',
        'Lele': 'Lele is a six-year-old Chinese boy with short black hair, mustard sweatshirt and navy trousers.',
        'Xiaoyu': 'Xiaoyu is a same-age Chinese boy with short dark hair, forest-green sweatshirt and charcoal trousers; distinct from Lele.',
        'teacher': 'Teacher is a Chinese adult woman with tied-back black hair and sage-green cardigan.',
        'attendant': 'Park attendant is a middle-aged Chinese woman in a plain blue polo shirt.',
    }
    jobs = []
    for b in BOOKS:
        for page, (_, _, scene) in enumerate(b[-1], 1):
            visible = scene
            for name in characters:
                visible = visible.replace(f'{name} absent', '')
            names = {name for name in characters if name in visible}
            if 'child' in visible.lower():
                names.add("An'an")
            if 'parents' in visible.lower():
                names.update(['Mom', 'Dad'])
            if 'children' in visible.lower() and b[0] in ['tong-yi-duo-yun-liang-zhong-yang-zi', 'xiao-che-zen-me-dao-le-ni-jia']:
                names.update(["An'an", 'Lele'])
            cast = [description for name, description in characters.items() if name in names]
            if "An'an" in names and (b[0] == 'jin-wan-de-xiao-deng-ke-yi-liang-zhe-ma' or any(word in scene for word in ['asleep', 'pajama', 'Bedtime', 'bedtime'])):
                cast[0] = "An'an is a six-year-old Chinese girl, round face and ear-length straight black bob, wearing plain pale-yellow pajamas. Her yellow star hair clip is on a bedside dish."
            prompt = '\n'.join([
                kit['globalStyle'],
                'Asset type: one individual full-bleed square picture-book illustration; never a multi-panel sheet.',
                *cast,
                'Draw ONLY the people explicitly present in the scene below. Keep their faces, ages, hair, clothing and proportions consistent. Do not add the rest of the family. Maintain oak furniture, pale green cabinets and warm contemporary Chinese home details where appropriate.',
                "THIS PAGE'S SCENE: " + scene,
                'Show the exact current state of the objects described, without anticipating a later page. Alternate the requested wide, medium and close camera views. Natural hands and readable expressions.',
                'Avoid: ' + kit['negative'],
            ])
            jobs.append(dict(id=b[0], page=page, prompt=prompt))
    return jobs
add('ma-ma-shuo-ke-yi-ba-ba-shuo-bu-xing', '妈妈说可以，爸爸说不行', '不用夹在两句话中间',
    '大人的不同意见，由大人一起商量；孩子可以得到清楚的说明。',
    'Adults can work out their different opinions together and give children a clear explanation.',
    ['家庭沟通', '成人责任'], '减少孩子在照料者不同意见之间的困惑，示范由成人协调并说明安排。',
    '不让孩子选边、替成人传话或承担争执责任；分歧需要尊重地讨论，安全要求由成人负责确认。',
    ['听到两个不同回答时，安安心里发生了什么？', '大人说法不一样时，你希望他们怎样向你说明？'],
    '照料者先私下商量一件日常安排，再一起用孩子听得懂的话说明；给孩子留一个提出困惑的机会。', '''
周末早晨，安安看见窗外的阳光，抱起自己的小头盔：“今天可以去骑车吗？”|On the weekend morning, An'an saw sunshine outside and picked up her little helmet. “Can we go cycling today?”|Home living room wide shot: An'an holds plain red child bicycle helmet looking toward sunny window, Mom beside oak table.
妈妈说：“吃完早饭，应该可以呀。”安安高兴地跑到门边，把两只鞋摆得整整齐齐。|Mom said, “After breakfast, we should be able to.” Happily, An'an went to the door and lined up her shoes neatly.|Home entry medium shot: An'an places white red-edged sneakers neatly on mat beside red helmet; Mom nearby smiling.
爸爸从阳台走过来：“今天先不行，小车还没检查好。”安安的手停在了头盔上。|Dad came from the balcony. “Not yet today. The bike hasn't been checked.” An'an's hand stopped on the helmet.|Entry three-person shot: Dad in navy sweater explains, An'an pauses holding red helmet, Mom turns toward him.
“可是妈妈说可以。”她小声说。爸爸回答：“那你再去跟妈妈说一下。”安安没有动。|“But Mom said we could,” she said softly. Dad replied, “Then go tell Mom.” An'an did not move.|Medium entry conversation: Dad gestures toward Mom across room, An'an stays still with uncertain face and helmet held low.
一会儿说可以，一会儿说不行。安安站在门边，不知道把鞋穿上，还是放回去。|One answer was yes, and the other was no. By the door, An'an did not know whether to put on her shoes or put them away.|Close An'an standing between aligned shoes and held helmet, indecisive expression, parents in soft background.
她担心听了一个人，另一个人会不高兴。原本很想去骑车的早晨，忽然变得有点紧张。|She worried that listening to one parent might upset the other. A morning she had looked forward to suddenly felt tense.|Wide entry: An'an quietly on low bench with helmet in lap and unworn sneakers on mat; Mom and Dad nearby apart.
妈妈看见她没有说话，走近问：“你是不是听糊涂了？”安安点头：“我到底该听谁的？”|Mom noticed her silence and came closer. “Did our answers confuse you?” An'an nodded. “Which one of you should I listen to?”|Entry close conversation: Mom crouches before An'an on bench, child asks anxiously holding helmet, Dad listens nearby.
妈妈招呼爸爸一起坐下：“这件事，我们应该先商量清楚，不用让安安在中间传话。”|Mom invited Dad to sit with them. “We should work this out together. An'an doesn't need to carry messages between us.”|Three-person entry medium shot: Mom and Dad sit at child's eye level around An'an, calm open postures, helmet in child's lap.
爸爸想了想：“刚才我说得太快了。不是你做错了，是我还没检查刹车，不能现在就出门骑。”|Dad thought. “I answered too quickly. You haven't done anything wrong. I haven't checked the brakes, so we can't ride right now.”|Close Dad explains calmly to An'an, plain child bicycle safely stationary visible on balcony behind, no riding.
妈妈也说：“我以为车已经准备好了，没有先问爸爸。两个回答不一样，让你为难了。”|Mom added, “I thought the bike was ready and didn't check with Dad. Our different answers made things hard for you.”|Close Mom acknowledges misunderstanding to An'an, Dad quietly beside them, red helmet still in child's lap.
他们一起看了今天的安排。爸爸负责检查车，妈妈看看天气，再选一条适合慢慢骑的小路。|They reviewed their plans together. Dad would check the bike, and Mom would check the weather and choose a suitable quiet path.|Home living room family medium shot: parents discuss cycling plan with An'an listening, stationary child bike and helmet nearby, no written schedule.
爸爸妈妈重新告诉安安：“车检查好、天气合适，下午我们陪你去。现在先吃早饭。”|Mom and Dad explained again. “If the bike is ready and the weather is suitable, we'll go with you this afternoon. First, breakfast.”|Oak breakfast table wide shot: An'an Mom Dad sit together with simple breakfast; red helmet set safely on side shelf.
安安问：“如果下雨呢？”妈妈说：“我们就一起换个安排，也会早点告诉你。”|An'an asked, “What if it rains?” Mom said, “Then we'll make another plan together and tell you in good time.”|Breakfast table close conversation: An'an asks Mom curiously, Dad listening, sunny window behind, no rain yet.
她的肩膀松了下来。现在，她知道要等什么，也知道不用自己去分辨谁赢了这场讨论。|Her shoulders relaxed. Now she knew what they were waiting for and did not have to decide who had won the discussion.|Close relaxed An'an at breakfast with gentle small smile, parents calmly conversing beside her.
午后，爸爸检查好了车。天气也适合出门，妈妈走过来：“准备好啦，你还想去吗？”|That afternoon, Dad finished checking the bike. The weather was suitable too. Mom came over. “We're ready. Would you still like to go?”|Home balcony afternoon medium shot: Dad beside checked stationary child bike, Mom asks An'an holding red helmet, sunny dry weather.
“想！”安安戴好头盔，妈妈帮她检查扣带。爸爸推着车，三个人一起走向小路。|“Yes!” An'an put on her helmet, and Mom checked the strap. Dad wheeled the bike, and all three headed for the path.|Courtyard entry wide shot: An'an wears properly fastened red bicycle helmet, Mom checks strap, Dad pushes plain child bike; child not riding yet.
安安慢慢骑，爸爸妈妈陪在旁边。早晨那两句打架的话，已经变成一个大家都明白的安排。|An'an rode slowly with Mom and Dad close by. The two clashing answers from the morning had become a plan everyone understood.|Safe quiet park path wide scene: An'an cycles slowly with fastened red helmet, Mom and Dad walk nearby, no vehicles or pedestrians close ahead.
下次遇到不一样的回答，安安说：“请你们先商量，再一起告诉我。”爸爸妈妈认真点了点头。|The next time she heard different answers, An'an said, “Please talk together first, then tell me.” Mom and Dad nodded thoughtfully.|Warm home ending: An'an talks confidently with Mom and Dad at oak table, red helmet safely on side shelf, gentle attentive faces.
''')

add('jin-wan-de-xiao-deng-ke-yi-liang-zhe-ma', '今晚的小灯可以亮着吗', '害怕的时候，也能安心',
    '害怕可以说出来，也可以借助陪伴和合适的办法获得安心。',
    'You can talk about fear and find comfort through company and practical help.',
    ['害怕', '睡前安心'], '接纳孩子对黑暗和影子的害怕，共同选择舒适的睡前支持。',
    '不嘲笑害怕，也不以独自关灯入睡证明勇敢；夜灯安全放置，成人说明在哪里、如何求助并及时回应。',
    ['安安为什么一开始不敢说自己害怕？', '什么能让你睡前更安心？你想怎样告诉家人？'],
    '在成人陪伴下，用手或普通玩具做柔和的影子游戏，孩子随时可以停，再一起选择舒服的睡前安排。', '''
睡前，安安穿好软软的睡衣，听爸爸讲完故事。房间里的灯一暗，窗帘边就出现了一团长长的影子。|At bedtime, An'an put on her soft pajamas and listened to Dad's story. When the light dimmed, a long shadow appeared beside the curtain.|Bedroom wide bedtime shot: An'an in pale-yellow pajamas in bed, Dad beside bedside lamp; soft coat shadow near curtain, no monster, hairclip on dish.
她盯着影子，越看越像一只伸出手的大东西。安安把被子拉高，只露出两只眼睛。|She stared at the shadow. The longer she looked, the more it seemed like something large reaching out. She pulled up her quilt, leaving only her eyes showing.|Close bedtime An'an under cream quilt watching a vague harmless coat shadow by curtain; gentle dim room, no actual creature.
“我要关大灯了。”爸爸说。安安想开口，又把话咽回去：“说害怕，会不会被笑？”|“I'm going to turn off the main light,” Dad said. An'an wanted to speak but swallowed the words. “Would he laugh if I said I was scared?”|Bedroom medium shot: Dad near wall light switch, An'an in pale-yellow pajamas hesitant under quilt; only mild shadow, no text.
灯还没关，她就轻轻叫了一声：“爸爸。”爸爸转过身：“怎么了？”|Before the light went off, she softly called, “Dad.” He turned. “What is it?”|Bedroom medium conversation: Dad turns from switch toward An'an sitting slightly up in bed, soft light still on.
“今晚的小灯，可以亮着吗？”安安问，“窗边有个影子，我看着有点害怕。”|“Could the little light stay on tonight?” An'an asked. “There's a shadow by the window, and it scares me a little.”|Close An'an in pale-yellow pajamas asks Dad with vulnerable expression and points toward curtain, bedside dish with star clip.
爸爸没有笑。他坐回床边：“谢谢你告诉我。我们一起看看它从哪里来，好吗？”|Dad did not laugh. He sat by the bed again. “Thank you for telling me. Shall we look together and see where it comes from?”|Tender bedside medium shot: Dad sits at An'an's eye level, child comforted but still cautious, cream bedding and safe lamp.
大灯亮了一点，安安才看见，椅背上搭着爸爸的外套，一只袖子垂到了窗帘旁。|With the light a little brighter, An'an saw Dad's coat over a chair. One sleeve hung down beside the curtain.|Bedroom object-focused medium shot: plain navy coat draped on oak chair near cream curtain, sleeve casting soft ordinary shadow; Dad and pajama-clad An'an inspect.
爸爸拿起外套，那团长影子也跟着动了。原来，伸出来的那只“手”，是一条空空的袖子。|Dad lifted the coat, and the long shadow moved too. The reaching “hand” was an empty sleeve.|Bedroom wide shot: Dad lifts plain navy coat off chair, soft sleeve shadow shifts on curtain; An'an in pale-yellow pajamas watches from bed, no creature.
安安呼了口气，又说：“我知道是外套了，可灯一暗，心里还是有一点怕。”|An'an breathed out, then said, “I know it's a coat now. But when it gets dark, I still feel a little scared inside.”|Close An'an in pale-yellow pajamas talks honestly to Dad holding coat, gentle expression, room moderately lit.
爸爸点头：“知道原因，和马上不害怕，不一定一起发生。我们可以再找一个舒服的办法。”|Dad nodded. “Knowing the reason doesn't always make the fear disappear right away. We can find another way to feel comfortable.”|Bedside two-person close conversation: Dad listens calmly to pajama-clad An'an, coat now folded on chair away from curtain.
他们把外套收好，挪开椅子。安安躺回去试了试，窗边没有那只长袖子了。|They put the coat away and moved the chair. An'an lay down to try again. The long sleeve was no longer beside the window.|Bedroom wide shot: Dad moves bare oak chair away from curtain, An'an in pale-yellow pajamas lies in bed looking toward now-clear curtain, no coat shadow.
床边有一盏暖暖的小夜灯。爸爸把它放稳，远离被子和窗帘，房间留下一小片柔和的光。|There was a warm little night-light. Dad placed it securely away from bedding and curtains, leaving a soft pool of light in the room.|Bedroom object close shot: Dad places small enclosed warm amber night-light on stable shelf well away from curtain and cream bedding, no exposed wiring.
安安问：“我还想你再坐一会儿。”爸爸说：“好，我们一起听听窗外的声音。”|An'an asked, “Could you stay a little longer too?” Dad said, “Yes. Let's listen to the sounds outside together.”|Bedside medium shot: Dad sits quietly beside An'an in pale-yellow pajamas under quilt, warm night-light on distant safe shelf.
远处有车轻轻开过，风碰了碰树叶。安安握着被角，呼吸一点一点慢下来。|A car passed softly in the distance, and wind rustled the leaves. Holding her quilt, An'an's breathing slowly settled.|Close calm An'an in pale-yellow pajamas tucked under cream quilt, Dad's reassuring presence beside bed, soft night window tree shapes.
爸爸告诉她：“我在隔壁，需要我就叫一声，我会来。”安安点头，知道门外有人可以找到。|Dad told her, “I'll be in the next room. Call me if you need me, and I'll come.” An'an nodded, knowing someone was nearby.|Bedroom doorway medium shot: Dad points gently toward adjoining hallway, An'an in pale-yellow pajamas listens from bed, door remains slightly open, warm night-light.
过了一会儿，她还是叫了爸爸。爸爸走回来，听她说完，又陪她坐了一小会儿。|A little later, she still called Dad. He came back, listened to what she needed, and sat beside her a little longer.|Tender bedside scene: Dad returns to sit by An'an in pale-yellow pajamas, she speaks quietly, safe amber night-light remains on.
第二个晚上，安安还想留着小灯。爸爸和她一起安排好，没有催她立刻变得勇敢。|The next evening, An'an still wanted the little light. Dad helped arrange things again without rushing her to become brave at once.|Next bedtime wide bedroom: An'an in pale-yellow pajamas and Dad calmly prepare bed, coat and chair clear of curtain, safe warm night-light on shelf.
小灯亮着，安安闭上眼睛。今天的害怕已经说出来，安心也一点一点，走到了枕边。|The little light glowed as An'an closed her eyes. She had spoken about her fear, and comfort had slowly found its way to her pillow.|Peaceful bedtime ending: An'an in pale-yellow pajamas sleeping under cream quilt, empty pillow space and safe warm night-light on shelf, door slightly open, Dad absent.
''')

add('tong-yi-duo-yun-liang-zhong-yang-zi', '同一朵云，两种样子', '我的鲸鱼，你的鞋子',
    '有些事情可以有不同的想法，听见别人，也不必丢掉自己的发现。',
    'Some things leave room for different ideas. You can hear others without losing your own discoveries.',
    ['不同看法', '想象力'], '在具体的想象活动中体验观点差异，并区分个人想法与可核对的事实。',
    '不把所有问题都说成各有道理；涉及事实和安全时一起查证。孩子可以保留想法，也可以改变想法。',
    ['安安和乐乐为什么会从同一朵云里看见不同的东西？', '听到不同的想法时，你可以问什么来了解对方？'],
    '一起看一朵云或一块不规则石头，分别画出想到的形状，再讲讲哪一部分让自己这样想。', '''
午后，安安和乐乐坐在公园的长椅上。天空里，一朵白云慢慢飘过，圆鼓鼓的，拖着一条细尾巴。|One afternoon, An'an and Lele sat on a park bench. A white cloud drifted across the sky, round and full, with a thin trailing end.|Wide park bench and sky: An'an and Lele look at one soft rounded white cloud with trailing wisp, Mom seated farther along bench, natural cloud not literal animal.
“像一条鲸鱼！”安安指着云，“这里是肚子，后面是尾巴。”她几乎听见了海水的声音。|“It looks like a whale!” An'an pointed. “Here's the belly, and that's the tail.” She could almost hear the sea.|Medium An'an points toward rounded natural cloud with tapered trailing wisp; Lele follows her gaze, no actual whale or ocean.
乐乐却说：“我看像一只鞋。前面圆圆的，后面翘一点。”安安转头：“怎么会是鞋？”|But Lele said, “I see a shoe, round at the front and a little raised at the back.” An'an turned. “How could it be a shoe?”|Two-child bench conversation under natural white cloud: Lele gestures shoe shape with hands, An'an surprised, no floating shoe.
“明明是鲸鱼。”她说。“明明是鞋子。”乐乐回答。云还在飘，他们的声音却越来越急。|“It's clearly a whale,” she said. “It's clearly a shoe,” Lele replied. The cloud kept drifting while their voices grew impatient.|Bench medium shot: An'an and Lele disagree with earnest faces pointing upward in different gestures; Mom nearby notices, no aggression.
妈妈听见了，问：“你们看的是同一朵云吗？”两个人一起点头，都指向树梢上方。|Mom heard and asked, “Are you looking at the same cloud?” Both nodded and pointed above the treetop.|Wide park bench: Mom asks An'an and Lele; both children point toward same soft natural white cloud above one green tree.
“那可以先说说，哪一部分让你想到鲸鱼，哪一部分让你想到鞋子。”妈妈说。|“Then you could tell each other which part reminds you of a whale and which part reminds you of a shoe,” Mom suggested.|Bench three-person medium shot: Mom gently invites explanation with open hands, children listening, sky beyond.
安安慢慢指给乐乐看：“我觉得这一大团像鲸鱼肚子。”乐乐凑近一点，顺着她的手指望过去。|An'an pointed slowly. “This big round part looks like a whale's belly to me.” Lele leaned closer and followed her finger with his eyes.|Over-shoulder bench view: An'an points to rounded main part of one natural white cloud, Lele watches attentively, no diagram lines.
乐乐也说：“我想到的是鞋头，后面那一小片像鞋跟。”安安第一次看见了他眼里的那只鞋。|Lele said, “It reminds me of a toe, and that little part looks like a heel.” For the first time, An'an could see the shoe he meant.|Medium bench view: Lele points at same cloud's rounded front and raised thin rear wisp; An'an listens curiously, no actual shoe.
风吹过来，细尾巴变得更长，又散开一点。云没有停下来，等他们选出一个名字。|A breeze stretched the thin trailing end and spread it out a little. The cloud did not stop to wait for them to choose one name.|Sky-focused square view: single natural rounded white cloud with trailing wisps stretching in light wind above green treetops, no people or symbolic figures.
妈妈递来小画本：“可以把自己的发现画下来。”安安画鲸鱼，乐乐画鞋子，谁也不用先擦掉。|Mom offered little sketchbooks. “You could draw your own discoveries.” An'an drew a whale, and Lele drew a shoe. Neither had to erase first.|Overhead park bench drawing scene: An'an draws simple blue whale outline, Lele draws simple green shoe outline in separate plain sketchbooks; Mom nearby, no words.
两张画并排放着。乐乐问：“你的鲸鱼为什么有这么小的尾巴？”安安指着天空，笑着解释。|They placed the drawings side by side. Lele asked, “Why does your whale have such a tiny tail?” An'an pointed to the sky and explained with a smile.|Close two sketchbooks on bench showing simple whale and shoe drawings; An'an and Lele compare, natural sky visible beyond, no text.
安安也问起乐乐画的鞋跟。他们开始想知道对方看见了什么，忘了催对方改答案。|An'an asked about the heel Lele had drawn too. They became curious about each other's discoveries and stopped urging each other to change answers.|Two-child medium conversation: An'an asks Lele about simple shoe drawing, both attentive and smiling, sketchbooks open in hands.
“云像什么，是我们的想象。”妈妈说，“如果想知道云是什么做的，就要一起查一查。”|“What a cloud looks like belongs to our imagination,” Mom said. “If we want to know what clouds are made of, we'll need to find out together.”|Three-person park bench conversation: Mom explains gently while children hold whale and shoe drawings, natural clouds above, no science labels.
乐乐说：“那它还像一条小船呢。”安安看了看：“我好像也能看见，不过我最喜欢鲸鱼。”|Lele said, “It could look like a little boat too.” An'an looked. “I think I can see that, but the whale is still my favorite.”|Bench medium shot: Lele and An'an look up thoughtfully at softly changed cloud, separate sketchbooks on laps, no actual boat.
回家前，他们把两张画放在一起。鲸鱼旁边有一只鞋，都是这个下午留下的小发现。|Before going home, they placed the drawings together. A shoe sat beside a whale, both little discoveries from the same afternoon.|Overhead close shot: two plain paper drawings side by side on bench, blue whale and green shoe; children's hands align sheets, no lettering.
安安和乐乐并肩走着。天空里还是同一朵云，他们的话里，却多出了好多可以听听的样子。|An'an and Lele walked side by side. It was still the same cloud above them, but their conversation held many more ways to see it.|Warm park path ending: An'an and Lele walk beside Mom carrying plain sketchbooks, one soft white cloud over trees, relaxed shared conversation.
''')


def main():
    target = ROOT / 'content-drafts/richang'
    kit = json.loads((target / 'lan-ping-guo.json').read_text())['imagePromptKit'].copy()
    kit['characterConsistency'] += ' Xiaoyu: same-age Chinese boy, short dark hair, forest-green sweatshirt, charcoal trousers. Teacher: adult Chinese woman, tied-back black hair, sage cardigan. Park attendant: middle-aged Chinese woman, plain blue polo. Bedtime An’an wears plain pale-yellow pajamas, with her star hair clip on a bedside dish.'
    expected = [18, 18, 20, 18, 18, 18, 18, 18, 18, 16]
    assert len(BOOKS) == len(expected)
    assert sum(expected) == 180
    for b, count in zip(BOOKS, expected):
        assert len(b[-1]) == count, (b[1], len(b[-1]), count)
        assert not (target / f'{b[0]}.json').exists(), f'Refusing to overwrite {b[0]}'
    for index, (slug, title, subtitle, moral, moral_en, tags, goal, reminder, questions, activity, pages) in enumerate(BOOKS):
        order = index + 21
        book = dict(id=slug, seriesId='richang', title=title, subtitle=subtitle,
            moral=dict(zh=moral, en=moral_en), ageLabel='4–8 岁', publishedAt='2026-10-02', order=order,
            comingSoon=True, pages=[dict(page=i, zhText=zh, enText=en, illustrationPrompt=scene, imageStatus='pending') for i, (zh, en, scene) in enumerate(pages, 1)],
            metadata=dict(category='family-growth', ageRange=dict(min=4, max=8), estimatedMinutes=6,
                languages=['zh', 'en'], seriesId='richang', seriesOrder=order, personalizationEnabled=False,
                tags=['日常系列', '生活智慧', '亲子共读', *tags], featured=False, bedtimeSuitable=True),
            parentGuide=dict(goal=goal, reminder=reminder, questions=questions, activity=activity,
                ageTips=dict(age4to5='先看表情和动作，允许孩子用指画面、点头或简单词语表达感受。',
                    age6to8='讨论不同角色的想法和可选择的办法，不把一种选择当成唯一正确答案。')))
        (target / f'{slug}.json').write_text(json.dumps(dict(book=book, imagePromptKit=kit), ensure_ascii=False, indent=2) + '\n')
    batch = target / 'batch-21-30'
    batch.mkdir(exist_ok=True)
    plan = [dict(id=b[0], title=b[1], pages=len(b[-1]), order=i + 21) for i, b in enumerate(BOOKS)]
    (batch / 'plan.json').write_text(json.dumps(dict(approved=True, approvedAt='2026-10-02', totalPages=180, books=plan), ensure_ascii=False, indent=2) + '\n')
    manuscript = ['# 日常系列第三批逐页文稿与分镜\n']
    for b in BOOKS:
        manuscript.append(f'## {b[1]}\n\n副标题：{b[2]}\n\n寓意：{b[3]}\n\n亲子目标：{b[6]}\n\n家长提醒：{b[7]}\n')
        for i, (zh, en, scene) in enumerate(b[-1], 1):
            manuscript.append(f'### 第 {i} 页\n\n{zh}\n\n{en}\n\n分镜：{scene}\n')
        manuscript.append('共读问题：\n' + '\n'.join(f'- {question}' for question in b[8]) + f'\n\n小活动：{b[9]}\n')
    (batch / 'manuscript.md').write_text('\n'.join(manuscript))
    (batch / 'image-prompts.json').write_text(json.dumps(image_jobs(), ensure_ascii=False, indent=2) + '\n')
    print('Saved 10 approved books and 180 bilingual pages; illustrations and audio remain pending.')


if __name__ == '__main__':
    main()
