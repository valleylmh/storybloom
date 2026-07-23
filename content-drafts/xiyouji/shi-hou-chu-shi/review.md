# 《石猴出世》整本验收单

- 状态：文字与 8 张插图已完成，等待维护者最终审核；暂未修改 `imageStatus` 或移除 `comingSoon`
- 文字：8 页中英双语低龄改编稿
- 插图：2026-07-22 使用 Codex 内置 imagegen 工具逐页生成
- 一致性方法：第 2 页建立无衣饰石猴锚点，第 3–6 页引用该图；第 7 页在同一角色上加入固定美猴王服装，第 8 页引用第 7 页服装锚点
- 最终资源：`public/library/xiyouji/shi-hou-chu-shi/1.webp` 至 `8.webp`
- 图片规格：1200×1200 WebP，单张约 129–251KB，全部低于 300KB
- 原始生成图：`/private/tmp/storybloom-shi-hou-chu-shi/page-01-source.png` 至 `page-08-source.png`
- 总览图：`content-drafts/xiyouji/shi-hou-chu-shi/contact-sheet.jpg`

## 角色与画风锚点

无衣饰石猴固定为暖金棕色毛发、浅棕裸脸与胸口、明亮琥珀色大眼、圆耳、短尖发束和长尾，比例圆润低龄，不带衣饰、冠甲或兵器。第 7 页加冕后固定穿金黄无袖坎肩、朱红腰带与深红长裤；第 8 页保持同一套服装，不提前出现凤翅紫金冠、紧箍、铠甲或金箍棒。

全书采用精致动画电影质感的 3D 黏土绘本风格，暖色电影光、可触摸的手作材质、神话古代中国场景、1:1 构图；无文字、标识、水印、现代物件、伤害或恐怖画面。

## 逐页文字与画面

1. 东海之上有座花果山，山顶立着一块吸收了日月光华的仙石。
   In the Eastern Sea rose the Mountain of Flowers and Fruit, where a magic stone drank in the light of sun and moon.
   画面：东海日出、花果山瀑布桃林与山顶发光仙石，全景建立世界。
2. 轰的一声，仙石裂开，蹦出一只灵巧的小石猴，眼睛亮晶晶。
   With a great crack, the stone split open — and out sprang a nimble little stone monkey with bright shining eyes.
   画面：小石猴从裂开的仙石中跃出；本页为无衣饰角色身份锚点。
3. 小石猴很快和山里的猴群玩到了一起，爬树、摘桃、捉迷藏。
   The little stone monkey soon joined the mountain monkeys — climbing trees, picking peaches, playing hide-and-seek.
   画面：桃林群猴游戏，小石猴保持第 2 页脸型、毛色、眼睛与发束。
4. 一天，猴子们发现一道大瀑布：“谁敢钻进去，我们就拜他为王！”
   One day the monkeys found a great waterfall. “Whoever dares to leap through shall be our king!”
   画面：群猴指向瀑布，小石猴站上岩石，勇敢但不逞凶。
5. 小石猴闭上眼睛，纵身一跳，穿过水帘，稳稳落在了石桥上。
   The stone monkey shut his eyes and leapt — through the curtain of water, landing safely on a stone bridge.
   画面：穿越水帘的动态瞬间，水珠与洞内石桥清晰，无危险感。
6. 水帘后面藏着一座石头洞府，锅碗桌椅样样齐全，正好安家！
   Behind the waterfall lay a stone cave home — with stone pots, bowls, tables and chairs, all ready for a family!
   画面：温暖完整的石洞家园，小石猴触摸石椅探索。
7. 猴子们欢呼着涌进洞府，齐声说：“美猴王！美猴王！”
   The monkeys poured in, cheering together: “Handsome Monkey King! Handsome Monkey King!”
   画面：群猴献桃献花、加冕庆祝；首次建立金黄坎肩、朱红腰带、深红长裤服装锚点。
8. 从此，花果山有了自己的猴王。而小猴王心里，还装着更大的世界。
   And so the mountain had its Monkey King — whose bright eyes already dreamed of a wider world.
   画面：悟空穿第 7 页固定服装坐在山巅眺望海上夕阳，安静钩出下一回寻师旅程。

## 上线前最后一步

维护者确认文字、裸石猴身份连续性、第 7–8 页服装连续性和整本画面后，再在 `src/lib/library/xiyouji.ts` 为 8 页补 `imageStatus: "complete"`，并移除本书的 `comingSoon`。
