"""Write approved second-batch manuscripts without changing the completed first batch."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BOOKS = []

def add(slug, title, subtitle, moral, moral_en, tags, goal, reminder, questions, activity, rows):
    pages = [line.split('|') for line in rows.strip().splitlines()]
    assert all(len(row) == 3 for row in pages), title
    BOOKS.append((slug, title, subtitle, moral, moral_en, tags, goal, reminder, questions, activity, pages))

add('da-jia-dou-you-de-xiao-shou-biao', '大家都有的小手表', '我喜欢，还是大家喜欢',
    '别人的喜欢，可以参考；自己的需要，也值得认真听。',
    'Other people can inspire us, but our own needs deserve a careful listen too.',
    ['选择', '需要与愿望'], '帮助孩子辨认喜欢、需要和想融入朋友的感受。',
    '不把想买东西说成虚荣，也不以买或不买奖励孩子；允许孩子保留愿望。',
    ['安安想要手表时，心里有哪些不同的想法？', '你有没有喜欢过别人拥有的东西？喜欢它的什么？'],
    '挑一件想要的物品，分别画出它吸引你的地方和你会怎样使用它，过几天再聊聊。', '''
课间，乐乐把手腕举起来：“看，我的新手表！”蓝色表带在阳光下亮亮的。安安凑近了一点。|At break time, Lele held up his wrist. “Look, my new watch!” Its blue strap shone in the sun. An'an leaned closer.|Sunny school courtyard medium shot: Lele raises his blue-strapped plain round watch; An'an admires it, only these two children.
另一个朋友也有手表。大家低头比颜色，安安把空空的手腕藏进袖子里。|Another friend had a watch too. As they compared colors, An'an tucked her bare wrist inside her sleeve.|School courtyard close shot: An'an hides her bare wrist in teal sleeve; Lele and one girl in pink sweater compare blue and pink plain watches.
放学路上，安安拉住妈妈：“我也想要一块。好像大家都有，只有我没有。”|On the way home, An'an tugged Mom's hand. “I want one too. It feels like everyone has one except me.”|Tree-lined city sidewalk wide shot: An'an looks at her bare wrist while speaking to Mom, walking home together.
妈妈没有马上说买，也没有说不买。她问：“你最喜欢它的哪一点？”安安张了张嘴，又停住了。|Mom did not say yes or no right away. “What do you like most about it?” she asked. An'an opened her mouth, then paused.|Sidewalk bench medium conversation: Mom at child's eye level listens; An'an pauses thoughtfully, bare wrist.
“蓝色很好看。还有……我们就能一起玩了。”安安轻轻碰着自己的手腕。|“The blue is pretty. And... then we could play together.” An'an lightly touched her wrist.|Close view of An'an touching bare wrist, thoughtful eyes; Mom listening at park bench.
妈妈问：“今天没戴手表，你们一起玩了吗？”安安想起，他们还一起追过影子呢。|“Did you play together today without a watch?” Mom asked. An'an remembered chasing shadows with them.|Single courtyard recollection scene: An'an and Lele joyfully chase their own shadows, watch small on his wrist, no Mom.
回家后，妈妈拿来一个小闹钟：“手表可以帮人看时间。你现在最想用它做什么？”|At home, Mom brought over a small clock. “A watch can help us tell time. What would you most like to use it for?”|Oak table medium shot: Mom sets a simple unnumbered clock before An'an; pale green kitchen cabinets, no watches.
安安盯着钟面：“我还不太会看。”妈妈笑了：“可以慢慢学。不会看，也能先说说喜欢的原因。”|An'an studied the clock. “I'm not very good at reading it yet.” Mom smiled. “You can learn. You can still tell me what you like about it.”|Clock and child's face close-up: An'an studies simple clock hands, Mom smiles gently, no visible numbers.
第二天，安安问乐乐：“你为什么喜欢手表？”乐乐说：“爷爷教我看长针短针，我想试试自己看。”|The next day, An'an asked Lele why he liked his watch. “Grandpa taught me about the hands. I want to try reading it myself,” he said.|School courtyard two-child conversation: Lele points at blue watch's two plain hands, An'an listens.
那个朋友说：“我喜欢粉色表带。不过跑步时，我觉得戴着有点碍事。”同样的东西，喜欢的理由也不一样。|Their friend said, “I like my pink strap, though it gets in the way when I run.” Even with the same thing, people liked different parts.|School courtyard medium shot: girl in pink sweater adjusts pink strap; An'an and Lele listen, three children only.
安安试着说：“我觉得蓝色漂亮，也有点怕自己不一样。”说完，她的心里好像松了一点。|An'an tried saying, “I like the blue, and I'm a little afraid of being different.” Saying it made her feel a little lighter.|After-school kitchen conversation: An'an speaks openly to Mom at oak table, relaxed shoulders, no watches on child.
妈妈点点头：“想和朋友亲近，很正常。我们也可以一起想，除了买一样的东西，还有什么办法。”|Mom nodded. “It's natural to want to feel close to friends. We can think of ways besides buying the same things.”|Warm kitchen medium shot: Mom listens warmly to An'an, hands open, no scolding.
周末，安安用蓝色纸条做了一条手环。没有钟面，只有她画的小星星。她喜欢的蓝色，已经戴在手上了。|On the weekend, An'an made a bracelet from blue paper and drew a little star. It had no clock face, but the blue she liked was on her wrist.|Overhead craft table: An'an wraps a blue paper bracelet with one drawn star around wrist; Mom nearby, no text, no watch dial.
她把手环给乐乐看。乐乐说：“像一条小小的天空！”他们又去搭积木，并没有先检查谁戴了手表。|She showed Lele the bracelet. “It's like a tiny sky!” he said. Then they built with blocks without checking anyone's watch.|Living room floor wide shot: An'an with blue paper star bracelet and Lele with blue watch build blocks together, no other people.
晚上，妈妈问：“你还想要手表吗？”安安说：“还想。不过我想先学看时间，也想知道戴着舒不舒服。”|That evening, Mom asked if she still wanted a watch. “I do. But first I'd like to learn to tell time and see whether it feels comfortable,” An'an said.|Kitchen evening conversation: An'an holds small unnumbered clock, blue paper bracelet visible; Mom listens.
他们约好先看看不同的手表，试戴后再商量，选适合自己的，也看看家里的预算。安安的愿望没有被丢掉。|They agreed to look at different watches, try them on, and discuss what suited her and their budget. Her wish had not been thrown away.|Shop counter medium shot: Mom and An'an examine plain round watches on padded tray, no brands, signs or readable text.
安安试戴了一块表，发现表带太硬。她摘下来：“漂亮是一件事，舒服又是另一件事。”|An'an tried one on and found the strap too stiff. She took it off. “Looking pretty and feeling comfortable are two different things.”|Close shop counter: An'an carefully removes a stiff blue watch, Mom observes; plain tray and no labels.
回家路上，安安摇摇蓝色手环：“今天不急着买。我想要什么，可以慢慢想清楚。”妈妈牵着她，一起走进晚霞里。|On the way home, An'an waved her blue bracelet. “We don't have to buy one today. I can take time to figure out what I want.” Mom held her hand as they walked into the sunset.|Wide sunset city sidewalk: An'an and Mom hand in hand, blue paper star bracelet visible, peaceful hopeful ending.
''')

add('wo-zhi-shi-kai-ge-wan-xiao', '我只是开个玩笑', '笑声里，也要听见你',
    '好玩的玩笑，需要彼此都觉得好玩；伤到了别人，就要停下来。',
    'A joke is fun when everyone enjoys it. If it hurts someone, stop.',
    ['尊重', '同伴关系'], '辨认同伴的反应，练习停止伤人的叫法并修复关系。',
    '不要求受伤的孩子笑着接受道歉，也不把外号重复给孩子听来示范。',
    ['乐乐没有笑的时候，安安可以怎样做？', '道歉以后，还能用什么行动让朋友安心？'],
    '轮流说喜欢别人怎样称呼自己，练习一句“我不喜欢这个叫法，请叫我的名字”。', '''
午后，大家在院子里玩接球。乐乐没接稳，球轻轻滚到了花盆旁。安安忍不住笑了一声。|One afternoon, the children played catch in the courtyard. Lele missed, and the ball rolled gently beside a flowerpot. An'an gave a little laugh.|Courtyard wide shot: An'an and Lele playing with orange ball rolling beside planter, one girl in pink nearby.
安安给乐乐起了个和动作有关的外号。旁边的朋友笑起来，她以为大家都觉得有趣。|An'an made up a nickname about how Lele moved. A friend laughed, so she thought everyone found it funny.|Three-child courtyard medium shot: An'an joking with smiling pink-sweater friend; Lele uneasy, orange ball by feet, no words or bubbles.
乐乐弯腰捡起球，没有笑。他小声说：“还是叫我乐乐吧。”声音比院子里的风还轻。|Lele picked up the ball without smiling. “Please call me Lele,” he said softly, almost quieter than the breeze.|Close view: Lele holds orange ball, troubled face; An'an just behind listening distractedly.
安安没有听清。第二次传球时，她又喊了那个外号。乐乐抱住球，眼睛看着地面。|An'an did not catch what he said. The next time she passed the ball, she used the nickname again. Lele held the ball and looked down.|Medium courtyard shot: An'an calls to Lele; boy hugs orange ball, gaze down, pink-sweater friend off to side.
傍晚，乐乐说要回家。安安觉得奇怪：“以前他总想再玩一会儿，今天怎么这么早？”|At dusk, Lele said he was going home. An'an wondered why. He usually wanted to play a little longer.|Wide courtyard exit: Lele walks away holding orange ball, An'an watches puzzled, no other people.
第二天，安安招手叫他一起玩。乐乐摇摇头，坐在长椅上，把小车推来推去。|The next day, An'an waved for him to join the game. Lele shook his head and rolled a toy car along a bench.|Courtyard bench scene: Lele alone on bench with small red toy car, An'an stands nearby inviting him.
“你是不是生气了？”安安问。乐乐停下小车：“我不喜欢你那样叫我。”|“Are you upset?” An'an asked. Lele stopped the car. “I don't like it when you call me that.”|Two-child bench conversation: Lele stops red toy car with one hand and speaks seriously; An'an listens.
“我只是开个玩笑呀。”安安脱口而出。乐乐把手放在车上：“可是我没有觉得好玩。”|“I was only joking,” An'an blurted out. Lele rested his hand on the car. “But it wasn't fun for me.”|Close conversation: An'an defensive and surprised, Lele quietly serious, red car between them.
回家时，安安把这件事告诉妈妈：“我没有想让他难过。”妈妈先听她说完。|On the way home, An'an told Mom what happened. “I didn't mean to make him sad.” Mom listened until she finished.|City sidewalk medium shot: An'an talks to Mom, Mom listening attentively, no friends.
妈妈说：“你没有想伤害他，和他确实难过了，这两件事可以同时发生。现在你已经知道他的感受了。”|Mom said, “You didn't mean to hurt him, and he did feel hurt. Both can be true. Now you know how he feels.”|Park bench gentle conversation: Mom at An'an's eye level, thoughtful child, no scolding gesture.
安安想起乐乐低着头的样子。原来大家的笑声很响，也会把一个人的不愿意盖住。|An'an remembered Lele looking down. Everyone's laughter had been loud enough to cover one person's discomfort.|Single recollection courtyard scene: Lele stands downcast holding orange ball; blurred An'an and pink-sweater friend smiling behind, no Mom.
第二天，她走到乐乐面前：“我听见你说不喜欢了。我会停下来，以后叫你的名字。”|The next day, she went to Lele. “I heard that you don't like it. I'll stop and use your name.”|Courtyard morning medium shot: An'an speaks earnestly to Lele by bench, red toy car beside him.
“昨天我说只是玩笑，好像你的难过不算数。对不起。”安安没有伸手拉他，等着他说话。|“When I said it was just a joke, it sounded like your feelings didn't matter. I'm sorry.” An'an waited without pulling him closer.|Two-child close view: An'an apologizes with respectful distance and open hands; Lele listens, no forced hug.
乐乐说：“我现在还不想玩球。”安安点点头：“好。你想自己待一会儿也可以。”|“I don't want to play ball yet,” Lele said. An'an nodded. “Okay. You can have some time to yourself.”|Bench medium scene: Lele seated, An'an gives space and calmly nods, orange ball resting away from him.
过了一会儿，另一个朋友又喊出那个外号。安安马上说：“他不喜欢这样叫。我们叫他乐乐吧。”|A little later, their friend used the nickname again. An'an said at once, “He doesn't like that. Let's call him Lele.”|Courtyard three-child scene: An'an gently addresses pink-sweater friend; Lele nearby with toy car, no speech bubbles.
朋友愣了一下，改口喊：“乐乐，你的小车能过这座桥吗？”安安心里还有点紧张，却松了一口气。|Their friend paused, then asked, “Lele, can your car cross this bridge?” An'an still felt nervous, but also relieved.|Ground-level scene: girl in pink points to block bridge; Lele holds red car; An'an relieved, three children.
乐乐把小车推过积木桥，嘴角慢慢翘起来。安安没有催他原谅，也没有再拿那件事逗他。|Lele rolled his car over the block bridge, and slowly smiled. An'an did not hurry him to forgive her or tease him about it again.|Close toy bridge scene: Lele rolls red car across wood blocks, faint smile; An'an watches quietly.
几天后，他们又玩接球。安安先问：“我能说你像一阵快快的风吗？”乐乐笑了：“这个我喜欢！”|A few days later, they played catch again. An'an asked, “Can I say you're as fast as the wind?” Lele smiled. “I like that one!”|Sunny courtyard action shot: Lele running to catch orange ball, An'an joyful, only two children.
球又滚偏了一次，两人一起追过去。这回，乐乐和安安都笑了，笑声一样轻快。|The ball rolled off course again, and both ran after it. This time, Lele and An'an were both laughing freely.|Wide action shot: An'an and Lele run together after orange ball, both visibly happy, courtyard plants.
晚上，安安告诉妈妈：“我以后不只听谁笑得大声，还会看看，有没有人没有笑。”|That evening, An'an told Mom, “Next time, I won't only listen to the loudest laughter. I'll notice if someone isn't smiling.”|Warm evening kitchen conversation: An'an thoughtful but content beside Mom, oak table, pale green cabinets.
''')

add('na-zhang-bu-gan-hua-de-bai-zhi', '那张不敢画的白纸', '先让一条线出发',
    '不必先做得完美，才允许自己开始。',
    'You do not have to be perfect before you are allowed to begin.',
    ['尝试', '完美压力'], '允许试画和修改，帮助孩子把开始变成一件小事。',
    '不把乱画变成必须画出优秀作品的另一种要求；孩子可以画、停下或保留空白。',
    ['安安迟迟不敢下笔，是在担心什么？', '如果只先做一个小动作，你愿意从哪里开始？'],
    '每人随手画一条线，轮流说它让自己想起什么，没有标准答案。', '''
周六，安安铺开一张白纸。她想画一幅最好看的画，放进自己的小画夹里。|On Saturday, An'an laid out a sheet of white paper. She wanted to make her very best picture for her little art folder.|Sunlit home desk wide shot: An'an lays blank white paper beside turquoise folder and colored pencils, alone.
红色铅笔拿起来，又放下。她想画房子，可是屋顶要是画歪了怎么办？|She picked up a red pencil, then put it down. She wanted to draw a house, but what if the roof came out crooked?|Close desk shot: An'an hesitates with red pencil above untouched blank paper, worried eyes.
她轻轻画了一小段线，觉得太斜，立刻用橡皮擦掉。白纸上只留下淡淡的印子。|She drew a short line, thought it too slanted, and erased it right away. A faint mark was all that remained.|Overhead desk view: An'an erases one small slanted pencil line, pale eraser dust, mostly blank paper.
窗边，乐乐的画已经有了树和小车。安安看一眼，又看一眼，握铅笔的手更紧了。|By the window, Lele's picture already had a tree and a car. An'an kept glancing at it and gripping her pencil tighter.|Two-child desk scene: Lele draws simple tree and red car; An'an tense over nearly blank page, no writing.
“你怎么还没有画？”乐乐问。安安把纸往自己这边拉了拉：“我在想。”|“Why haven't you started?” Lele asked. An'an pulled her paper closer. “I'm thinking.”|Desk medium conversation: Lele curious without mocking; An'an protects mostly blank page, turquoise folder beside her.
爸爸走过来，没有拿起安安的铅笔。他问：“这张纸让你有点为难吗？”|Dad came over without picking up her pencil. “Is this paper making things a little difficult?” he asked.|Home desk medium shot: Dad gently kneels beside An'an, hands away from drawing tools; Lele absent.
安安点头：“我怕画不好，就连第一条线都不敢画。”爸爸坐下来，陪她看了一会儿白纸。|An'an nodded. “I'm afraid it won't be good. I can't even draw the first line.” Dad sat with her and looked at the paper for a while.|Quiet two-person desk scene: An'an confides, Dad sits beside her facing blank sheet, warm patient mood.
爸爸拿出自己的草图。那是一把歪歪的椅子，一条腿还比别的长。安安忍不住凑近看。|Dad took out one of his sketches. It showed a crooked chair with one leg longer than the others. An'an leaned closer.|Close desk view: Dad shows separate pencil sketch of awkward uneven chair, An'an curious, no labels.
“这是我试着画的第一遍。”爸爸说，“我可以再改，也可以先放着。它不必一开始就像真的。”|“This was my first try,” Dad said. “I can change it or leave it for now. It doesn't have to look real from the start.”|Two-person conversation at desk: Dad holds imperfect chair sketch, An'an loosens grip on red pencil.
爸爸把另一张纸推到自己面前：“要不要各画一条线，看看它会带我们去哪儿？”|Dad put another sheet in front of himself. “Shall we each draw a line and see where it takes us?”|Overhead desk: two separate blank sheets, Dad and An'an each hold a pencil above own paper, turquoise folder at side.
安安画了一条弯弯的线。它不像屋顶，却像一条绕过小山的路。她先没有擦掉。|An'an drew a curvy line. It did not look like a roof, but it could be a road around a hill. She left it on the page.|Close overhead drawing: one winding line on An'an's sheet, red pencil held lightly, eraser untouched.
路旁，她添了一间胖胖的小屋。屋顶还是歪的，安安这次给它画了一扇圆窗。|Beside the road, she added a plump little house. The roof was still crooked, so this time she gave it a round window.|Drawing close-up: child's curving road and plump crooked-roof house with round window, An'an drawing, no text.
“这间屋子里住谁？”爸爸问。安安想了想：“住一个喜欢看雨的人，圆窗正好看雨点。”|“Who lives there?” Dad asked. An'an thought. “Someone who likes watching rain. The round window is perfect for raindrops.”|Desk medium shot: An'an explains drawing with growing delight, Dad listens, rainy-window drawing visible on sheet.
她又画了一座很窄的桥、一棵弯腰的树。原来不一样的线，也能找到自己的地方。|She added a narrow bridge and a leaning tree. Different lines could each find a place in her picture.|Overhead evolving picture: crooked house, winding road, narrow bridge, leaning green tree, child's hand adding detail.
乐乐来看：“这条街真奇怪！我的小车能开过去吗？”安安笑着在路旁加了一个停车的空地。|Lele came to look. “What a funny street! Can my car drive through it?” An'an smiled and added a little parking space.|Two children at desk: Lele points curiously to child's imaginary street, An'an adds parking patch, Dad absent.
她画累了，把铅笔放下。白纸上还有一大片空着，她说：“这里，下次再想也可以。”|When she grew tired, she put down her pencil. A large part of the paper was still empty. “I can think about this part another time,” she said.|An'an relaxes at desk, red pencil set down, drawing half-filled and half-blank, calm satisfied expression.
安安把这张画放进小画夹。它不是她想象中最完美的画，却是一张她愿意留下的画。|An'an put the picture in her art folder. It was not the perfect picture she had imagined, but it was one she wanted to keep.|Close shot: An'an gently slides crooked little street drawing into turquoise art folder, happy face.
第二天，她又铺开一张白纸。这次，铅笔没有等很久。一条小小的线，已经出发了。|The next day, she laid out a new sheet. This time, the pencil did not wait long. A little line was already on its way.|Sunlit desk ending: An'an confidently draws first fresh line on new blank sheet, turquoise folder beside her, alone.
''')

add('ma-ma-jin-tian-you-dian-lei', '妈妈今天有点累', '休息一会儿，爱还在',
    '家人也需要休息；暂时没有回应，不代表爱变少了。',
    'Family members need rest too. A quiet moment does not mean there is less love.',
    ['家人情绪', '安心'], '区分大人的疲惫和孩子的责任，学习清楚地表达休息与陪伴安排。',
    '不让孩子承担照顾大人情绪的任务。疲惫时由大人说明、安排可靠照料并履行约定。',
    ['妈妈累了，是安安做错了什么吗？', '想陪伴又需要休息时，可以怎样把安排说清楚？'],
    '一起选一个休息信号和一个重新见面的具体安排，由大人负责回来回应孩子。', '''
放学回家，安安举起一只纸做的小船：“妈妈，我们让它出海吧！”往常妈妈总会接一句船长的话。|After school, An'an held up a paper boat. “Mom, let's send it to sea!” Usually, Mom would answer like a ship's captain.|Warm living room wide shot: An'an eagerly holds folded blue paper boat, Mom just home near sofa with work bag.
今天，妈妈放下包，慢慢坐到沙发上。她笑了一下，声音很轻：“让我先坐一会儿。”|Today, Mom put down her bag and slowly sat on the sofa. She smiled a little. “Let me sit for a moment.”|Living room medium shot: tired Mom seated on beige sofa, work bag set aside; An'an holds blue paper boat nearby.
安安把小船转了个方向：“那我来当船长，你当乘客。”妈妈却揉了揉额头，没有马上接话。|An'an turned the boat around. “I'll be the captain, and you can be the passenger.” Mom rubbed her forehead and did not answer right away.|Closer sofa scene: An'an offers paper boat; Mom gently rubs forehead, fatigued rather than angry.
屋子忽然安静了。安安低头看看船角，想起早上自己磨蹭着不肯穿鞋。|The room suddenly felt quiet. An'an looked at the boat's corners and remembered how slowly she had put on her shoes that morning.|Close view of worried An'an looking down at blue boat, tired Mom softly visible on sofa behind.
“是不是因为我早上不听话，你才不想陪我？”安安小声问。小船被她捏得皱了一点。|“Do you not want to play because I was difficult this morning?” An'an asked softly, squeezing a wrinkle into the boat.|Two-person medium shot: An'an anxiously holds wrinkled paper boat; Mom turns attentively toward her.
妈妈抬起头，认真看着她：“不是。今天工作很忙，我有点累。不是你做错了什么。”|Mom looked up at her carefully. “No. Work was busy today, and I'm tired. You haven't done something wrong.”|Eye-level close conversation: Mom reassuring An'an warmly, blue paper boat in child's hands, no angry gestures.
“可是你今天没有大声笑。”安安说。妈妈点头：“我累的时候，笑声也会小一点。爱你没有变少。”|“But you aren't laughing loudly today,” An'an said. Mom nodded. “My laugh gets quieter when I'm tired. My love for you hasn't become smaller.”|Sofa conversation medium shot: Mom smiles softly and meets An'an's eyes, child beginning to relax.
安安还是有点失望：“我很想现在玩。”妈妈说：“我知道。等人陪的时候，确实不容易。”|An'an still felt disappointed. “I really want to play now.” Mom said, “I know. Waiting for company can be hard.”|Close child expression: An'an disappointed holding boat in lap; Mom listens without dismissing feelings.
妈妈和爸爸商量好，先在卧室安静休息二十分钟。爸爸在客厅陪安安，厨房的小计时器也定好了。|Mom and Dad agreed she would rest quietly in the bedroom for twenty minutes. Dad would stay with An'an, and they set the kitchen timer.|Living room wide scene: Mom, Dad and An'an discuss rest; Dad sets simple unnumbered timer, blue boat on table.
“计时器响了，我就出来，先读你选的书。”妈妈说，“你不需要守着我，也不用让我马上开心起来。”|“When the timer rings, I'll come out and read the book you choose,” Mom said. “You don't need to watch over me or make me cheerful right away.”|Bedroom doorway medium shot: Mom explains calmly to An'an; Dad nearby in living room, blue boat in child's hand.
安安问：“那小船怎么办？”爸爸指指地毯：“我们先搭一片不怕弄湿的纸上大海，好不好？”|“What about the boat?” An'an asked. Dad pointed to the rug. “Shall we first make a paper sea that won't get anything wet?”|Living room floor wide shot: Dad and An'an lay blue paper sheets on rug, folded blue paper boat, dry pretend ocean.
安安画了几条弯弯的浪。她玩得开心了一点，也还想妈妈。两种感觉一起待在心里。|An'an drew a few curvy waves. She felt a little happier playing, and still missed Mom. Both feelings could stay together.|Overhead floor craft view: An'an draws abstract waves on blue paper, Dad nearby, folded blue boat, no text.
计时器响了。妈妈走出来，喝了一口水：“谢谢你们。我还没有完全不累，不过可以陪你读一会儿了。”|The timer rang. Mom came out and took a sip of water. “Thank you. I'm still a little tired, but I can read with you now.”|Kitchen-living-room medium shot: Mom returns with water glass; An'an and Dad by paper ocean, simple timer nearby.
安安跑去拿书：“你说回来，真的回来了。”妈妈拍拍身旁的位置：“来，船长坐这里。”|An'an ran for a book. “You said you'd come back, and you did.” Mom patted the seat beside her. “Sit here, Captain.”|Sofa medium shot: Mom pats cushion, An'an approaches with blank-cover picture book, blue boat on coffee table.
他们读到一艘大船。安安把纸船停在书边，妈妈的声音慢慢暖起来，不需要很大声。|They read about a big ship. An'an parked her paper boat beside the book. Mom's voice grew warm without needing to be loud.|Close cozy reading scene: Mom and An'an share illustrated ship book without text, blue paper boat beside it.
晚上，安安也累了，不想再拼最后一块积木。妈妈说：“可以明天再拼。你也能听听身体的话。”|That evening, An'an felt tired and did not want to place the last block. Mom said, “You can finish tomorrow. You can listen to your body too.”|Evening living room floor scene: sleepy An'an sets block down beside unfinished structure; Mom sits nearby gently.
安安把小船放好：“妈妈有妈妈的心情，我有我的心情。”妈妈点点头：“需要帮助时，我们可以说出来。”|An'an put her boat away. “Mom has Mom's feelings, and I have mine.” Mom nodded. “When we need help, we can say so.”|Medium tidy shelf scene: An'an places blue paper boat on low shelf; Mom listens, warm evening light.
睡前，妈妈亲了亲她。今天的笑声小一点，拥抱慢一点，可安安知道，爱还在这里。|At bedtime, Mom kissed her. Today's laughter was quieter and the hug was slower, but An'an knew the love was still there.|Tender bedtime scene: Mom kisses An'an's forehead by bed, child relaxed, teal hoodie folded on chair, warm lamp.
''')

add('xiao-xiao-de-bu-yuan-yi', '小小的不愿意', '温柔，也可以有边界',
    '善良可以有边界；照顾朋友，也可以照顾自己。',
    'Kindness can have boundaries. You can care about your friends and yourself.',
    ['边界', '表达'], '练习说清楚自己的意愿，也学习听见朋友的拒绝。',
    '不要求孩子为拒绝找足够好的理由；同意可以改变，但要清楚告知并商量处理。',
    ['安安嘴上答应时，心里是什么感觉？', '别人说不愿意时，我们能怎样继续做朋友？'],
    '用玩具演练“这个我想留着”“我现在不愿意”，再练习回应“好，我听见了”。', '''
安安搭了一座积木车站。最后一根横梁放上去时，她屏住呼吸，车站终于稳稳地站住了。|An'an built a block station. She held her breath as she placed the final beam. At last, the station stood firmly.|Living room floor wide shot: An'an carefully completes wooden block station with red roof beam, proud focused face.
她把小车开进去，又开出来。这是她搭了很久的车站，她想让它留到明天。|She drove a toy car in and out. The station had taken a long time to build, and she wanted to keep it until tomorrow.|Ground-level view: An'an rolls red toy car through intact wooden station with red roof beam, alone.
乐乐来了：“我能拿这些积木搭一架飞机吗？”他指着车站最上面的横梁。|Lele arrived. “Can I use these blocks to build an airplane?” He pointed to the beam at the top of the station.|Two-child medium floor scene: Lele points to red roof beam of intact block station; An'an hesitates.
安安想说“不”，嘴巴却没有动。她怕乐乐觉得她小气，以后不来找她玩了。|An'an wanted to say no, but the word did not come out. She worried Lele would think she was selfish and stop visiting.|Close view of anxious An'an beside intact station, Lele awaiting answer, red car nearby.
“好……吧。”她慢慢说。乐乐以为她同意了，拿下横梁，又搬走了两块支柱。|“I... guess so,” she said slowly. Lele thought she agreed and removed the beam and two supports.|Floor action scene: Lele removes red roof beam and two supports from station; An'an watches unhappily, no collapse danger.
车站变成了一堆积木。安安坐在旁边，手里紧紧握着小车，心里越来越委屈。|The station became a pile of blocks. An'an sat beside it, gripping her toy car and feeling more and more upset.|Close floor scene: dismantled wooden blocks, An'an grips red car sadly, Lele builds small block airplane nearby.
乐乐问她飞机好不好看。安安只说：“随便。”乐乐也有点不知所措。|Lele asked whether she liked the airplane. “Whatever,” An'an said. Lele did not know what to do.|Two-child floor medium shot: Lele shows wooden block airplane with red wing beam, An'an turns away upset.
妈妈来送水，看见安安的表情。她轻声问：“你愿意告诉我，刚才发生了什么吗？”|Mom brought water and noticed An'an's expression. “Would you like to tell me what happened?” she asked softly.|Living room medium scene: Mom places two water cups safely on table and kneels near upset An'an; Lele nearby.
安安说：“我其实不想拆车站，可我又不想让乐乐不高兴。”她终于把心里那句不愿意说了出来。|“I didn't want to take the station apart, but I didn't want Lele to be unhappy,” An'an said. At last, she voiced the no inside her.|Close conversation: An'an explains to Mom, Lele listening quietly at respectful distance, scattered blocks.
妈妈说：“你可以喜欢朋友，也可以想保留自己的作品。说不愿意，不会把你变成坏朋友。”|Mom said, “You can like your friend and want to keep your work. Saying no doesn't make you a bad friend.”|Gentle eye-level two-person shot: Mom reassures An'an beside scattered wooden station blocks.
“可是我已经答应了。”安安低下头。妈妈说：“可以把现在的想法说清楚，我们一起处理已经发生的事。”|“But I already said yes,” An'an said, looking down. Mom replied, “You can explain how you feel now, and we can work out what to do.”|Medium floor discussion: An'an thoughtful, Mom patient with open hands, unfinished airplane on rug.
安安对乐乐说：“我刚才没说清楚。我还想留着车站，看到它拆了，我很难过。”|An'an told Lele, “I wasn't clear before. I wanted to keep the station, and I felt sad seeing it taken apart.”|Two-child face-to-face floor conversation: An'an speaks honestly, Lele attentive, Mom out of frame.
乐乐看看积木：“我以为你愿意。对不起。我们一起搭回去吧？”安安点点头，眼睛亮了一点。|Lele looked at the blocks. “I thought you wanted to. I'm sorry. Shall we rebuild it together?” An'an nodded, her eyes a little brighter.|Two-child medium shot: Lele offers red beam back to An'an, scattered blocks ready for rebuilding.
他们把柱子一块块找出来。有一处安安也忘了怎么搭，两人试了几次，才把横梁放稳。|They found the supports one by one. An'an had forgotten one part too. They tried several times before the beam sat firmly.|Floor construction action: An'an and Lele collaborate rebuilding wooden station, carefully settling red roof beam.
安安把车站挪到墙边：“这个我今天还想留着。旁边这些积木，你可以拿去搭飞机。”|An'an moved the station by the wall. “I want to keep this today. You can use these other blocks for an airplane.”|Wide living room floor: intact station safely by wall, separate pile of spare blocks; An'an indicates spare pile to Lele.
乐乐问：“那小车能借我一会儿吗？”安安想了想：“现在可以，等我再玩车站时，请还给我。”|“Can I borrow the car for a while?” Lele asked. An'an thought. “Yes, for now. Please give it back when I want to play with the station.”|Close exchange: An'an willingly hands red car to Lele, intact station and spare blocks background.
后来，安安想坐在乐乐刚搭的飞机旁。乐乐说：“先别碰，我还没搭稳。”安安停住手：“好。”|Later, An'an reached toward Lele's new airplane. “Please don't touch yet. It isn't steady,” he said. She stopped her hand. “Okay.”|Floor medium shot: Lele builds spare-block airplane, An'an withdraws reaching hand respectfully, station intact by wall.
两人照样玩得很热闹。一句不愿意，没有把朋友推远，倒让他们更知道彼此在想什么。|They still had a lively time together. A no had not pushed them apart. It helped them understand each other better.|Wide playful scene: An'an plays station, Lele plays separate block airplane with red car, both relaxed and happy.
睡前，安安练习了一遍：“这个我想留着。这个现在可以借。”说清楚，比把委屈藏起来舒服多了。|Before bed, An'an practiced. “I want to keep this. You can borrow this one now.” Being clear felt better than hiding her hurt.|Evening shelf scene: An'an points to preserved station and red car, Mom listens encouragingly, no text.
第二天，乐乐一来就问：“今天车站可以改建吗？”安安笑着说：“可以，我们先一起想想！”|The next day, Lele arrived and asked, “Can we change the station today?” An'an smiled. “Yes! Let's plan it together first!”|Sunny living room floor ending: An'an and Lele discuss intact station, both pointing thoughtfully, spare blocks ready.
''')

add('wo-de-mi-mi-shei-neng-ting', '我的秘密谁能听', '分享之前，先问问我',
    '亲近也需要尊重；孩子的感受和隐私值得被认真对待。',
    'Being close also means being respectful. A child’s feelings and privacy matter.',
    ['隐私', '信任'], '让孩子知道个人事情可以提出分享边界，涉及安全的事情应寻求可靠帮助。',
    '不承诺绝对保密；清楚区分普通隐私与让人害怕、受伤或被要求隐瞒的危险事情。',
    ['妈妈没有先问就分享时，安安为什么难过？', '如果一件事让你害怕或不安全，你可以向哪些可靠大人求助？'],
    '一起列出两个可以求助的可靠大人，练习分享前问“这件事可以告诉别人吗”。', '''
明天，班里要轮流讲一个小故事。安安把书包放好，悄悄拉着妈妈进了房间。|Tomorrow, everyone in class would tell a short story. An'an put away her bag and quietly took Mom into her room.|Bedroom doorway wide shot: An'an gently leads Mom inside, school bag on low hook, cozy home.
“我有点怕上台。”安安说，“一想到大家看着我，肚子就像装了几只小蝴蝶。”|“I'm a little scared of standing in front of everyone,” An'an said. “Thinking about them looking at me makes my tummy flutter.”|Close bedside conversation: An'an touches tummy nervously, Mom listens at eye level, no literal butterflies.
妈妈点头：“谢谢你告诉我。我们可以试着讲给一只小熊听，再讲给我听。”安安松了口气。|Mom nodded. “Thank you for telling me. You could try telling your story to a teddy bear, then to me.” An'an felt relieved.|Bedroom medium scene: Mom and An'an sit beside plush teddy bear placed as pretend audience, no words.
晚饭后，奶奶来做客。妈妈聊天时随口说：“安安明天要讲故事，紧张得像肚子里有小蝴蝶呢。”|After dinner, Grandma visited. While chatting, Mom casually mentioned An'an's story and the fluttering feeling in her tummy.|Living room three-person scene: Mom talks to Grandma in lavender cardigan; An'an nearby looks startled, no speech bubbles.
奶奶关心地看过来。安安却一下热了脸。她抱起小熊，躲到了沙发另一边。|Grandma looked over kindly, but An'an's face grew hot. She picked up her teddy bear and moved to the far side of the sofa.|Sofa medium shot: embarrassed An'an hugs teddy and moves away; Mom and Grandma notice gently.
妈妈问：“怎么了？”安安摇头。等奶奶去厨房倒水，她才小声说：“我只想告诉你。”|“What's wrong?” Mom asked. An'an shook her head. When Grandma went for water, she whispered, “I only wanted to tell you.”|Two-person sofa close-up: An'an whispers to Mom holding teddy, Grandma absent.
妈妈先说：“奶奶是关心你呀。”安安捏着小熊的耳朵：“可是我还没有想让她知道。”|“Grandma cares about you,” Mom said at first. An'an held the teddy's ear. “But I wasn't ready for her to know.”|Close emotional conversation: An'an sad and firm with teddy, Mom realizes child's discomfort, no angry face.
妈妈安静下来，重新听她说。原来自己觉得只是聊天，安安却觉得心里的小抽屉被别人打开了。|Mom grew quiet and listened again. What felt like casual conversation to her felt like someone opening An'an's private little drawer.|Sofa two-person medium shot: Mom attentive and reflective, An'an confiding with teddy, no literal drawer metaphor.
“是我没有先问你。”妈妈说，“对不起。你愿意告诉我，不等于你愿意让我告诉所有人。”|“I didn't ask you first,” Mom said. “I'm sorry. Telling me doesn't mean you wanted me to tell everyone.”|Eye-level close shot: Mom sincerely apologizes, An'an listening, teddy in lap.
妈妈走到奶奶身边，说明自己刚才没有问安安。奶奶轻声说：“我知道了，今天不追问她。”|Mom explained to Grandma that she had not asked An'an first. Grandma said softly, “I understand. I won't ask her about it today.”|Kitchen medium scene: Mom quietly speaks with Grandma holding water glass; An'an absent, pale green cabinets.
回来后，妈妈和安安约好：关于她的感受、照片和个人小事，想分享前，先问她一声。|When Mom returned, they agreed she would ask before sharing An'an's feelings, photos, or personal stories.|Sofa medium conversation: Mom and An'an establish agreement calmly, teddy between them, no contracts or text.
“那什么秘密都可以不说吗？”安安问。妈妈说：“有些事，如果让你害怕、受伤，或者不安全，要找可靠的大人帮忙。”|“Can every secret stay private?” An'an asked. Mom replied, “If something makes you scared, hurt, or unsafe, ask a trusted grown-up for help.”|Close reassuring conversation: Mom explains calmly, An'an thoughtful, safe warm living room, no scary imagery.
“就算有人要求你不许说，也可以来找我。”妈妈说，“需要别人一起保护你时，我会尽量先告诉你，要找谁、为什么。”|“Even if someone tells you not to tell, you can come to me,” Mom said. “If we need help keeping you safe, I'll explain who we need and why whenever I can.”|Medium two-person sofa scene: Mom offers open hand, An'an visibly reassured, teddy tucked beside her.
第二天，安安讲完了故事。放学时，她对妈妈说：“我还是紧张，不过我讲到最后一句啦！”|The next day, An'an finished her story. After school, she told Mom, “I was still nervous, but I reached the last sentence!”|School gate sidewalk: An'an excitedly reports to Mom, backpack on child, school facade without signs.
妈妈问：“这件开心的事，可以告诉奶奶吗？”安安想了想：“可以。不过小蝴蝶那句，就先留给我们。”|Mom asked, “May I tell Grandma this happy news?” An'an thought. “Yes. But let's keep the butterfly part between us for now.”|Close school-gate conversation: Mom asks gently, An'an thoughtfully nods with one hand on tummy, no butterflies.
晚上，奶奶祝贺安安，没问她不想说的部分。安安又抱着小熊坐到妈妈身边。小抽屉的钥匙，好好地留在她手里。|That evening, Grandma congratulated her without asking about the part she wanted private. An'an sat beside Mom with her teddy. Her private little drawer felt safely her own again.|Warm living room ending: Grandma smiles to An'an seated beside Mom with teddy, peaceful trusting family scene, no literal key or drawer.
''')

add('yi-ge-ren-wan-de-xia-wu', '一个人玩的下午', '无聊里，长出一条小街',
    '有人陪伴很快乐，独处也可以慢慢找到乐趣。',
    'Company is wonderful, and time alone can slowly grow its own joys.',
    ['独处', '想象力'], '接纳无聊和失望，在安全、有大人可求助的环境中尝试自主游戏。',
    '不把独自玩作为不回应孩子的理由；说明大人在哪里、忙多久，危险工具由大人操作。',
    ['乐乐不能来时，安安心里是什么感觉？', '家里有什么普通东西，可以变成游戏的一部分？'],
    '提供纸盒、纸和积木，先让孩子决定想做什么，成人只协助需要帮助的部分。', '''
安安把两把小椅子排好，等乐乐来玩。今天，她想和他搭一座大大的车站。|An'an lined up two small chairs and waited for Lele. Today, she wanted them to build a big station together.|Sunny living room wide shot: An'an prepares two low child chairs and block basket for friend, alone.
门铃没有响，妈妈却接到电话。乐乐家临时有事，今天不能来了。|The doorbell did not ring. Instead, Mom got a call. Something had come up in Lele's family, and he could not come today.|Living room medium shot: Mom finishes phone call with screen hidden, An'an beside two prepared chairs looks disappointed.
安安把一把椅子往旁边推了推：“那这个下午还有什么好玩的？”窗外的云也像走得很慢。|An'an pushed one chair aside. “What is there to enjoy this afternoon now?” Even the clouds outside seemed to move slowly.|Wide quiet living room: disappointed An'an moves one low child chair, soft clouds through window, toy basket untouched.
她去找妈妈：“你陪我搭吧。”妈妈说：“我还要把手里的事情做完，大约半小时。我在餐桌这里，你需要帮助可以叫我。”|She asked Mom to build with her. “I need about half an hour to finish this,” Mom said. “I'll be at the table. Call me if you need help.”|Medium shot: Mom at oak dining table with closed-back laptop screen not visible, An'an nearby seeking company.
妈妈陪她找了纸和积木，又约好忙完来看她的车站。安安点点头，可心里还是空了一小块。|Mom helped her find paper and blocks and promised to see her station afterward. An'an nodded, though something still felt missing.|Floor scene: Mom sets paper and blocks near An'an and low chairs, then listens, no abandonment.
安安在地毯上躺了一会儿，数窗帘上的光斑。一个人玩，好像还不知道从哪里开始。|An'an lay on the rug for a while, looking at spots of light on the curtain. She did not yet know how to begin playing alone.|Quiet floor-level shot: An'an resting on rug watching dappled curtain light; Mom visible at table in background.
她翻出一个空纸盒。盒子侧面有个小洞，看起来像一扇圆圆的窗。|She found an empty cardboard box. A little hole in the side looked like a round window.|Close object discovery: An'an turns plain small cardboard box with existing round opening, curious face, no labels.
“乘客可以从这里看风景。”安安小声说。她把盒子放在椅子旁，里面铺上一张软纸。|“Passengers could look out here,” she whispered. She put the box beside a chair and lined it with soft paper.|Overhead floor: An'an lines plain cardboard box with soft paper beside low chair, block pile nearby.
一只小熊坐进去，正好露出脑袋。安安把一条蓝色纸带铺在地上，当作通往车站的路。|A teddy bear fit inside with its head peeking out. An'an laid a blue strip of paper on the floor as a road to the station.|Ground-level scene: teddy sits in box beside child chair, An'an lays blue paper strip across rug, no text.
路太短了。她又添一段，让它绕过椅子脚，转到窗边。车站旁，慢慢有了一条小街。|The road was too short, so she added another piece around a chair leg and toward the window. A little street began growing beside the station.|Overhead widening layout: An'an extends blue paper road around low chair legs toward safe window area, box station and teddy.
安安想给车站开个门，拿着纸盒去问妈妈。妈妈帮她剪好，再把剪刀收回高处。|An'an wanted a doorway in the station and asked Mom. Mom cut one safely, then put the scissors away out of reach.|Oak table medium scene: Mom alone operates scissors on cardboard box while An'an watches from safe distance; no scissors in child hands.
小车从门口开进去，停在小熊身边。安安换成低低的声音：“下一站，窗边小城！”|The car drove through the doorway and parked beside the bear. An'an used a low voice. “Next stop, Window Town!”|Close floor pretend-play scene: An'an rolls red toy car through cut doorway of plain cardboard station, teddy inside.
她给积木房子排了不同的队伍，假装有人买面包，有人等朋友。她不用一直问别人接下来怎么玩。|She arranged block houses and imagined people buying bread or waiting for friends. She did not need to keep asking someone what to play next.|Wide play layout: An'an arranges wooden block buildings along blue paper road, cardboard station, teddy, no actual extra people.
小街的桥倒了。安安噘了噘嘴，把桥墩挪近一点。这次，小车慢慢开过去，没有掉下来。|The little bridge fell. An'an frowned and moved the supports closer. This time, the car crossed slowly without falling.|Close floor construction: An'an rebuilds short block bridge over blue paper road and tests red car, focused face.
妈妈忙完了，按约定走过来：“我可以参观你的小街吗？”安安一下坐直了：“请从这边进！”|Mom finished and came over as promised. “May I visit your little street?” An'an sat up. “Please enter this way!”|Living room wide scene: Mom approaches An'an's finished pretend street, child proudly gestures to cardboard station.
安安介绍车站、面包店和那座修好的桥。妈妈听得很认真，没有急着把小街变成自己的样子。|An'an introduced the station, bakery, and repaired bridge. Mom listened carefully without changing the street into her own design.|Two-person floor medium shot: An'an guides Mom through blue paper road and wooden block town, both interested.
晚上，乐乐问她下午做了什么。安安说：“开始有点无聊，后来我的小街越来越忙了。下次请你来参观。”|That evening, Lele asked what she had done. “I was bored at first, then my little street got busy,” she said. “Come visit next time.”|Evening living room: An'an talks through Mom's phone held safely with screen turned away, pretend street still on rug, Mom nearby.
安安把小熊送回车站。一个人的下午，没有一下子变热闹，却一点一点长出了自己的故事。|An'an returned the bear to the station. Her afternoon alone had not become lively all at once. Little by little, it had grown a story of its own.|Tender floor ending: An'an places teddy in cardboard station beside completed little street, warm sunset, Mom at table background.
''')

add('zui-hou-yi-kuai-dan-gao', '最后一块蛋糕', '把想要，好好说出来',
    '公平需要把需要说出来，一起商量；不必总由一个人退让。',
    'Fairness starts with sharing our needs and deciding together. One person need not always give in.',
    ['公平', '协商'], '练习表达自己的需要，并理解平分、轮流等方法适用于不同事情。',
    '不夸奖固定某个孩子总是让步，也不以年龄或性别规定谁该让；食物切分由成人操作。',
    ['安安说“你吃吧”时，真的不想吃吗？', '遇到不能分成两份的东西，还可以商量哪些办法？'],
    '拿一个能分的物品和一个不能分的玩具，讨论平分、轮流、一起玩各自适合什么情况。', '''
午后，妈妈把蛋糕盘放在桌上。安安和乐乐吃完自己的那一份，盘子里还剩最后一块。|One afternoon, Mom put a cake plate on the table. After An'an and Lele ate their portions, one last slice remained.|Kitchen wide shot: Mom places plate with exactly one triangular strawberry cake slice, two children with empty small plates.
最后一块顶上有一颗红草莓。安安看过去，乐乐也看过去，两人的手都动了一下。|A red strawberry sat on the last slice. An'an looked at it, and so did Lele. Both moved a hand a little.|Close tabletop scene: one intact triangular cake slice with single whole strawberry, An'an and Lele hands hesitate, no extra cake.
安安想到乐乐是客人，先说：“你吃吧。”可是话一出口，她又忍不住看了看草莓。|Thinking of Lele as her guest, An'an said, “You can have it.” Yet she could not help looking at the strawberry again.|Two-child medium table view: An'an offers reluctantly, Lele listens; exactly one strawberry-topped cake slice.
乐乐问：“你不喜欢这个味道吗？”安安没有回答，慢慢拿小勺碰着自己的空盘子。|“Don't you like this flavor?” Lele asked. An'an did not answer and tapped her spoon gently against her empty plate.|Close view: An'an downcast with spoon and empty plate; Lele curious, shared last slice untouched.
妈妈看见了，轻声问：“你们两个，是不是都还想吃一点？”两人一起点了点头。|Mom noticed and asked softly, “Would both of you like some more?” They both nodded.|Three-person kitchen medium scene: Mom gently asks two children, single cake slice between two empty child plates.
安安说：“我想让乐乐开心，可我也想吃。”乐乐说：“我以为你不想要，才准备拿。”|An'an said, “I want Lele to be happy, but I want some too.” Lele replied, “I thought you didn't want it. That's why I was going to take it.”|Close honest two-child conversation at table, untouched slice center, attentive faces.
妈妈说：“两个想要都可以说出来。说清楚，我们才知道要商量什么。”蛋糕还在盘子里，谁也不用急着拿。|Mom said, “You can both say what you want. Then we know what to work out.” The cake stayed on the plate. No one had to grab it.|Medium scene: Mom with open hands listens to An'an and Lele, hands resting away from single cake slice.
“分成两份吧！”安安提议。乐乐看看草莓：“那草莓也能分吗？”妈妈说：“可以，我来切。”|“Let's split it!” An'an suggested. Lele looked at the strawberry. “Can we split that too?” Mom said, “Yes. I'll cut it.”|Table conversation: children point thoughtfully toward whole strawberry on single slice; Mom prepares to help, knife not in child hands.
妈妈把蛋糕和草莓都切成两份，放进两个小盘子。两块看起来差不多大，草莓也各有半颗。|Mom cut the cake and strawberry in half and put them on two small plates. The pieces looked about the same size, each with half a strawberry.|Overhead table: adult Mom carefully cuts one cake slice and one strawberry into exactly two equal portions; children's hands safely away.
安安看看自己的，又看看乐乐的。她笑起来：“原来不用一个人全让掉。”乐乐也笑了。|An'an looked at her piece and Lele's, then smiled. “One of us doesn't have to give up all of it.” Lele smiled too.|Two children eating scene: exactly two small cake portions each topped with half strawberry on separate plates, both pleased.
吃完蛋糕，两人去玩小车。只有一辆红色小车，安安拿起来：“这个可不能切成两半。”|After the cake, they went to play with a toy car. There was only one red car. An'an picked it up. “We can't cut this in half.”|Living room floor medium shot: An'an holds one intact red toy car, Lele beside wooden block road, no cake or knives.
乐乐想让它过桥，安安想让它进车站。两人停下来，先把各自想怎么玩说了一遍。|Lele wanted it to cross a bridge. An'an wanted it to enter a station. They paused and explained their ideas.|Two-child floor conversation: Lele points to block bridge, An'an points to station, one red toy car between them.
“先过桥，再进车站，好不好？”乐乐问。安安点头：“下一圈，我们换着开。”|“Could it cross the bridge and then enter the station?” Lele asked. An'an nodded. “We can swap drivers on the next trip.”|Floor planning shot: An'an and Lele connect wooden bridge and station with simple road, single red toy car.
小车跑完一圈，乐乐把它递给安安。轮到她了。两人的办法，让游戏也变成了两个人的。|After one trip, Lele handed the car to An'an. It was her turn. Their plan made the game belong to both of them.|Close exchange: Lele willingly hands intact red toy car to An'an beside wooden bridge and station.
第二天，他们在公园都想先荡秋千。安安看着一张空座位：“这次轮流，等前一个人停稳再换。”|The next day, they both wanted the same swing. An'an looked at the empty seat. “Let's take turns and wait for it to stop before switching.”|Park medium shot: two children stand beside one empty low swing, Mom supervises nearby, swing fully still.
他们约好一人先玩一小会儿，由妈妈提醒交换。乐乐等待时，就去旁边看看叶子。|They agreed each would have a short turn, with Mom reminding them to swap. While waiting, Lele looked at leaves nearby.|Safe park wide shot: An'an seated on gently moving low swing, Mom nearby; Lele examining leaves well outside swing path.
安安发现，不是每样东西都要分成一样的两份。蛋糕能平分，小车和秋千可以轮流，办法要一起想。|An'an realized that not everything had to be divided in half. Cake could be shared, while cars and swings could take turns. They could decide together.|Park medium conversation after swing stops: An'an and Lele discuss with Mom beside still swing, no collage.
回家时，她对妈妈说：“下次我想要，就先好好说。也听听别人想要什么。”这次，心里没有藏着一块没吃到的蛋糕。|On the way home, she told Mom, “Next time I'll say what I want and listen to what others want.” This time, no uneaten piece of cake was hiding in her heart.|Warm sunset sidewalk ending: An'an walks happily with Mom and Lele, relaxed expression, no imagined cake or symbols.
''')

add('pai-dui-shi-de-na-yi-fen-zhong', '排队时的那一分钟', '给慢一点，留个位置',
    '给别人一点时间，也是在给每个人安心尝试的机会。',
    'Giving others time gives everyone room to try with confidence.',
    ['耐心', '换位思考'], '理解排队与安全距离，接纳每个人尝试时速度不同。',
    '不把害怕或动作慢的孩子当作麻烦；大人负责确认设施安全、提供帮助并允许放弃。',
    ['安安在下面等和爬到上面时，感觉哪里不同？', '有人需要慢一点时，我们可以怎样等、怎样帮？'],
    '玩轮流完成简单动作的游戏，提前约好等候位置，允许每个人选择尝试或跳过。', '''
周末的公园很热闹。安安一眼看见滑梯，拉着妈妈快步走过去，队伍已经排到了树影下。|The park was lively on the weekend. An'an spotted the slide and hurried over with Mom. The line stretched into the tree's shade.|Park wide establishing shot: An'an and Mom join short orderly line at safe low children's slide, bright trees.
她站到队伍最后，踮着脚看前面：“怎么还没有轮到我？”前面的孩子才刚走到台阶边。|She joined the end of the line and stood on tiptoe. “Why isn't it my turn yet?” The child ahead had only just reached the steps.|Queue medium shot: An'an impatient at end with Mom beside her; small child ahead approaching slide steps.
那个小朋友穿着紫色外套，抓紧扶手，一阶一阶慢慢爬。安安觉得每一步都过了好久。|The child in a purple jacket gripped the rail and climbed slowly, one step at a time. Each step seemed very long to An'an.|Side view of low slide: small purple-jacket child climbs carefully holding rails; An'an waits below with Mom.
“他太慢啦。”安安小声说。妈妈问：“你能看见他的脸吗？”安安抬头，只看见他紧紧抓着的手。|“He's too slow,” An'an whispered. Mom asked, “Can you see his face?” An'an looked up but could only see his tightly gripping hand.|Close queue view: An'an looks upward thoughtfully; small child's hands grip safe rail in foreground, Mom nearby.
安安往旁边挪了一步，想从另一侧先上去。妈妈轻轻提醒：“台阶要一个一个走，我们等这里。”|An'an moved aside, hoping to climb first from the other side. Mom gently reminded her, “One at a time on the steps. We wait here.”|Medium scene: An'an stops short of stepping toward occupied slide steps, Mom guides to waiting area without grabbing roughly.
小朋友在顶上停了一下。他的爸爸站在旁边问：“要我扶你一下，还是想先下来？”|The child paused at the top. His dad stood nearby and asked, “Would you like a hand, or would you rather come down?”|Safe low slide side view: purple-jacket child paused on protected platform; his dad in olive jacket offers support from beside rail.
小朋友想了一会儿，坐好，慢慢滑下来。落地时，他笑了，爸爸在出口旁接住他的手。|The child thought, sat down, and slid slowly. He smiled at the bottom, where his dad offered a hand.|Slide bottom action: purple-jacket child reaches safe landing smiling, olive-jacket dad holds out hand, An'an waits clear of exit.
终于轮到安安。她一下爬了两阶，又停下来。原来站在台阶上，看到的地面比刚才远多了。|At last, it was An'an's turn. She climbed two steps and stopped. From the steps, the ground looked farther away than before.|Side close shot: An'an pauses on low slide steps gripping rails, Mom supervises nearby, no other child on equipment.
她也抓紧扶手，心里冒出一点点怕。刚才在下面等的时候，她没有想到这里会是这样的感觉。|She gripped the rail too and felt a little fear. While waiting below, she had not imagined it would feel this way.|Close view of An'an's face and hands gripping slide rail, apprehensive but safe on protected steps.
身后的孩子没有催。安安回头看了一眼，听见妈妈说：“你可以慢慢来，也可以下来。”|The child behind did not hurry her. An'an looked back and heard Mom say, “You can take your time, or come back down.”|Medium slide view: An'an on steps, patient boy in green waits well back on ground; Mom reassures from nearby.
安安站稳，再往上走一阶。她终于明白，那一分钟不是空着的，有人正在认真试一件难的事。|An'an steadied herself and took one more step. She understood that the waiting minute was not empty. Someone was trying something difficult.|Side scene: An'an carefully takes one step holding rail, determined expression, Mom near low slide.
妈妈在旁边陪着。安安慢慢坐好，脚伸到前面，轻轻往下一滑，风从耳边跑过去。|Mom stayed nearby. An'an sat carefully, stretched her feet forward, and gently slid down. The breeze rushed past her ears.|Slide action shot: An'an correctly seated feet first on low slide, happy cautious face, Mom by landing outside path.
滑到下面，安安赶紧走开，让出出口。她摸摸自己的心口：“我刚才也要等一会儿，才准备好。”|At the bottom, An'an moved away to clear the exit. She touched her chest. “I needed a moment to be ready too.”|Landing medium shot: An'an safely moves to side clearing exit, Mom smiles, green-shirt boy starts only after path clear.
再排队时，安安站得松快多了。前面有人系鞋带，她没有挤过去，留出了小小的一段距离。|When she lined up again, An'an felt more relaxed. A child ahead tied a shoe. She left a little space instead of squeezing past.|Park queue scene: An'an waits with clear gap behind child kneeling to tie sneaker away from steps, Mom nearby.
“要帮忙吗？”妈妈问那个孩子的家长。安安看着树叶晃来晃去，发现等待时，也有东西可以看。|Mom asked the child's parent whether they needed help. An'an watched the leaves swaying and found there were things to notice while waiting.|Queue medium shot: Mom speaks kindly to other parent beside shoelace child; An'an watches sunlit leaves, calm.
回家时，安安说：“排队的一分钟，对每个人可能不一样。”妈妈牵着她。慢一点的人，也好好地留在队伍里。|On the way home, An'an said, “A minute in line can feel different for everyone.” Mom held her hand. There was room in the line for people who needed more time too.|Wide park exit ending: An'an and Mom walk hand in hand through trees, low slide peacefully distant, warm afternoon.
''')

add('ba-ba-mei-you-ying', '爸爸没有赢', '没有奖杯，也想继续',
    '输了可以难过，也可以继续喜欢；一次结果不能替我们定义全部。',
    'You can feel sad about losing and still love playing. One result does not define you.',
    ['输赢', '坚持'], '允许失败后的失望，看见努力、乐趣与继续选择的空间。',
    '不要求立刻乐观或把每次失败都转成进步任务；成人示范负责地调节情绪。',
    ['爸爸输了以后，有哪些不同的感受？', '一件喜欢的事，除了赢，还会带给你什么？'],
    '玩一场轻松的轮流游戏，结束后各说一个感受和一个喜欢的瞬间，可以先休息再聊。', '''
社区要办羽毛球比赛。安安帮爸爸把水杯装进包里：“爸爸，你一定是最厉害的！”|There was a neighborhood badminton match. An'an packed Dad's water bottle. “Dad, you'll be the best!”|Home entry wide shot: An'an packs blue water bottle into sports bag; Dad holds badminton racket, excited preparation.
爸爸笑了：“我很喜欢打球，不过今天还有很多打得好的人。”安安已经想象他举起奖杯的样子。|Dad smiled. “I love playing, but there will be many good players today.” An'an was already imagining him holding a trophy.|Medium doorway conversation: Dad gently speaks to excited An'an, racket and sports bag, no imaginary trophy overlay.
球场边，妈妈和安安找到座位。爸爸走进场里，和对手握了握手。白色羽毛球轻轻飞起来。|Mom and An'an found seats beside the court. Dad shook hands with his opponent, and the white shuttlecock took flight.|Community court wide shot: Dad in navy sports sweater shakes hands with adult opponent in green shirt across net; Mom and An'an seated safely off court.
开始几个回合，爸爸接住了好几球。安安高兴得直拍手，妈妈提醒她留在座位旁。|Dad returned several shots in the early rallies. An'an clapped excitedly, and Mom reminded her to stay by their seats.|Court sideline medium view: An'an claps beside seated Mom; Dad returns white shuttlecock beyond net, spectator distance safe.
后来，对手打出一个很快的球。爸爸伸长手臂，还是没接到。安安的手停在半空中。|Then the opponent hit a fast shot. Dad stretched out his arm but missed. An'an's hands paused in mid-clap.|Dynamic court scene: Dad stretches for missed white shuttlecock falling safely on court; An'an's surprised expression visible at sideline.
又一个回合结束，爸爸擦擦汗，认真站回自己的位置。安安小声问：“他是不是要输了？”|Another rally ended. Dad wiped his sweat and returned to his place. An'an whispered, “Is he going to lose?”|Sideline close shot: An'an whispers anxiously to Mom; Dad wipes sweat on court in background, no scoreboard text.
最后一球落地，比赛结束了。赢的是对手。爸爸垂下手里的球拍，站了一会儿。|The final shuttle landed, and the match was over. The opponent had won. Dad lowered his racket and stood quietly for a moment.|Court medium shot: Dad lowers racket looking disappointed; green-shirt opponent across net, white shuttle on floor.
安安没有等到奖杯，心里像少了一块。她看着爸爸：“可是你平时明明打得很好呀。”|There was no trophy for Dad, and An'an felt something missing. “But you play so well at home,” she said.|Bench medium scene after match: disappointed An'an speaks to Dad now beside Mom, racket resting on sports bag.
爸爸坐下来，喝了一口水：“今天他打得更好。我也有点失望，想先歇一会儿。”|Dad sat and drank some water. “He played better today. I'm disappointed too, and I'd like a little rest.”|Close bench shot: Dad drinks from blue water bottle, honestly tired and disappointed, An'an and Mom listen.
妈妈没有催他说没关系，只把毛巾递过去。安安靠近一点，安安静静地陪爸爸坐着。|Mom did not hurry him to say it was okay. She handed him a towel. An'an moved closer and quietly sat with him.|Tender three-person bench scene: Mom hands white towel to Dad; An'an sits close quietly, sports bag below.
过了一会儿，爸爸站起来，走向对手：“你今天那几个快球打得真好。恭喜！”声音不大，却很认真。|After a while, Dad stood and went to his opponent. “Your fast shots were really good today. Congratulations!” His voice was quiet but sincere.|Court-side medium shot: Dad respectfully shakes green-shirt opponent's hand, An'an and Mom watch from bench.
对手也说：“你接住的那几个球很漂亮。”爸爸笑了一下。输了的一场里，也有打得好的时候。|The opponent said, “You made some lovely returns too.” Dad smiled a little. Even in a lost match, there had been good moments.|Close two-adult sportsmanship scene: Dad and opponent converse warmly with rackets lowered, no trophy in Dad hands.
回家路上，安安问：“你下次还想打吗？”爸爸说：“想。不过我现在先想吃饭，腿也要休息。”|On the way home, An'an asked, “Do you want to play again?” Dad said, “Yes. First, I want dinner and a rest for my legs.”|City sidewalk wide shot: Dad carries sports bag, An'an and Mom walk beside him, afternoon light.
安安想了想：“我以为输了，就会不喜欢了。”爸爸说：“结果会影响心情，但喜欢不一定跟着走掉。”|An'an thought. “I thought losing would make you stop liking it.” Dad said, “Results can change how we feel without taking away what we love.”|Sidewalk close conversation: Dad meets An'an's curious gaze while walking, badminton bag on shoulder.
晚饭后，爸爸说起接住的一个难球，也说起几次没看准的地方。他没有把自己说成没用的人。|After dinner, Dad talked about a difficult shot he returned and a few he misjudged. He did not call himself useless.|Kitchen table family medium shot: Dad discusses match calmly with An'an and Mom, water glass and empty dinner plates, no written diagrams.
“等休息好了，我想再练练。”爸爸说，“也想和你继续玩。”安安把小球拍放到门边：“那我们约好啦。”|“When I've rested, I'd like to practice again,” Dad said. “And I'd like to keep playing with you.” An'an put her small racket by the door. “It's a plan!”|Home entry medium scene: An'an places small badminton racket beside Dad's adult racket, Dad smiling gently, no text.
第二个周末，他们在空地上轻轻打球。安安漏了一球，先噘嘴，再把羽毛球捡起来：“我还想再试一次。”|The next weekend, they played gently in an open area. An'an missed a shot, frowned, then picked up the shuttle. “I'd like another try.”|Safe open courtyard action shot: An'an bends to pick up white shuttle with small racket in other hand, Dad waits patiently well apart.
这次没有比赛，也没有奖杯。羽毛球来来回回，安安发现，爸爸没有赢的那天，喜欢的事情也没有结束。|There was no match or trophy this time. As the shuttle went back and forth, An'an found that the day Dad lost had not been the end of something he loved.|Wide warm courtyard ending: An'an and Dad enjoy gentle badminton rally with white shuttle between them, Mom seated safely off playing area.
''')

def main():
    target = ROOT / 'content-drafts/richang'
    kit = json.loads((target / 'lan-ping-guo.json').read_text())['imagePromptKit']
    expected = [18, 20, 18, 18, 20, 16, 18, 18, 16, 18]
    assert len(BOOKS) == 10
    for index, (slug, title, subtitle, moral, moral_en, tags, goal, reminder, questions, activity, pages) in enumerate(BOOKS):
        assert len(pages) == expected[index], (title, len(pages))
        dest = target / f'{slug}.json'
        if dest.exists():
            raise RuntimeError(f'Refusing to overwrite existing draft: {dest}')
        order = index + 11
        book = dict(id=slug, seriesId='richang', title=title, subtitle=subtitle,
            moral=dict(zh=moral, en=moral_en), ageLabel='4–8 岁', publishedAt='2026-10-02', order=order,
            comingSoon=True, pages=[dict(page=i, zhText=zh, enText=en, illustrationPrompt=scene, imageStatus='pending') for i, (zh,en,scene) in enumerate(pages,1)],
            metadata=dict(category='family-growth', ageRange=dict(min=4,max=8), estimatedMinutes=7,
                languages=['zh','en'],seriesId='richang',seriesOrder=order,personalizationEnabled=False,
                tags=['日常系列','生活智慧','亲子共读',*tags],featured=False,bedtimeSuitable=True),
            parentGuide=dict(goal=goal, reminder=reminder, questions=questions, activity=activity,
                ageTips=dict(age4to5='先看表情和动作，允许孩子用指画面、点头或简单词语表达感受。',
                    age6to8='讨论不同角色的想法和可选择的办法，不把一种选择当成唯一正确答案。')))
        dest.write_text(json.dumps(dict(book=book,imagePromptKit=kit),ensure_ascii=False,indent=2)+'\n')
    batch = target / 'batch-11-20'
    batch.mkdir(exist_ok=True)
    plan = [dict(id=b[0],title=b[1],pages=len(b[-1]),order=i+11) for i,b in enumerate(BOOKS)]
    (batch / 'plan.json').write_text(json.dumps(dict(approved=True,totalPages=180,books=plan),ensure_ascii=False,indent=2)+'\n')
    manuscript = ['# 日常系列第二批逐页文稿与分镜\n']
    for b in BOOKS:
        manuscript.append(f'## {b[1]}\n\n寓意：{b[3]}\n')
        for i,(zh,en,scene) in enumerate(b[-1],1):
            manuscript.append(f'### 第 {i} 页\n\n{zh}\n\n{en}\n\n分镜：{scene}\n')
    (batch / 'manuscript.md').write_text('\n'.join(manuscript))
    print('Saved 10 approved books and 180 bilingual pages; illustrations remain pending.')

if __name__ == '__main__':
    main()
