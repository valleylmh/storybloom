# 《五行山下》整本验收单

- 状态：8 张插图已完成，等待维护者最终审核；暂未修改 `imageStatus` 或移除 `comingSoon`
- 文字：8 页中英双语低龄温和改编稿，见同目录 `draft.json`
- 插图：2026-07-23 使用 Codex 内置 imagegen 工具逐页生成
- 悟空锚点：本地临时角色锚点（未入库）
- 连续性方法：第 1 页建立智慧引路人与整体画风；第 2 页建立五色山峰、开放石窝和清泉；第 3–8 页按场景引用石窝/五行山页面与悟空锚点
- 最终资源：`public/library/xiyouji/wu-xing-shan-xia/1.webp` 至 `8.webp`
- 图片规格：1200×1200 WebP，单张约 103–231KB，全部低于 300KB
- 原始生成图：本地临时源图第 1 至 8 页（未入库）
- 总览图：`content-drafts/xiyouji/wu-xing-shan-xia/contact-sheet.jpg`

## 角色与场景锚点

悟空固定为暖金棕色毛发、浅棕裸脸与胸口、琥珀色大眼、圆耳、向后扬起的短尖发束和长尾；穿金黄无袖坎肩、朱红腰带与深红长裤，赤脚。金箍棒固定为细长红色棒身与金色两端。本回悟空始终没有冠、紧箍、头环、铠甲或鞋。

智慧引路人固定为银白高发髻、长白眉须与简洁象牙色宽袖长袍，神态温和。五行山固定为多座柔和金、绿、青、红色山峰；悟空停留处是带清泉、桃篮、花草、灯笼和大幅天空视野的开放式石窝，不是牢笼或挤压空间。

全书采用精致动画电影质感的 3D 黏土绘本风格，暖色电影光、手作材质、神话古代中国场景和 1:1 构图；无文字、标识、水印、现代物件、攻击动作、疼痛、惩罚或恐怖画面。

## 逐页文字与画面

1. 天宫的热闹平息后，悟空遇见一位智慧的引路人，请他试试安静与耐心。
   After the commotion in Heaven settled, a wise guide invited Wukong to try a different challenge: quietness and patience.
   画面：安静云台上，引路人温和提出耐心挑战；悟空和金箍棒保持跨书锚点。
2. 悟空爽快答应挑战：在五行山下住一阵，想清楚本领该怎么用。
   Wukong gladly accepted: he would stay beneath Five Elements Mountain for a while and think about how his abilities should be used.
   画面：五色山峰、清泉和开放石窝首次完整出现；悟空主动把手放在胸前接受挑战。
3. 山脚为他围出一个安全的小石窝，有桃子、清泉，也能看见天空。
   The mountainside formed a safe little stone shelter, with peaches, fresh water, and a clear view of the sky.
   画面：宽敞石窝内有桃篮、清泉和暖灯，洞口完整框出天空与五色山峰。
4. 刚开始，他总想马上离开。风吹过山谷，他便坐好，慢慢数一数呼吸。
   At first he wanted to leave at once. When the wind crossed the valley, he sat still and slowly counted his breaths.
   画面：悟空盘腿数手指，金箍棒放在一旁，姿态放松并逐渐专注。
5. 春花秋叶轮流经过，悟空想起从前的顽皮，也想起被吓到的朋友。
   As blossoms and autumn leaves came and went, Wukong remembered his mischief and the friends who had felt frightened.
   画面：秋叶与旧桃花共同提示时间流逝，悟空平静反思，没有羞辱或悲伤。
6. 他渐渐明白：本领越大，越要守住约定，也要替别人着想。
   He began to understand: the greater one's abilities, the more carefully one must keep promises and consider others.
   画面：悟空整理清泉边的藤蔓，让兔子和小鸟安心饮水，用行动表现体贴。
7. 悟空安静等待，帮小鸟挡雨，给迷路的小动物指路，心越来越稳。
   Wukong waited calmly, sheltering birds from rain and guiding lost little animals until his heart grew steady.
   画面：悟空用金箍棒托住大叶片为小鸟挡雨，同时给小鹿指向安全山路；金箍棒没有武器姿态。
8. 一天，远处传来清亮的铃声。一位去西方取经的僧人正向山脚走来。
   One day, a clear bell sounded in the distance. A monk journeying west for sacred scriptures was approaching the mountain.
   画面：悟空从开放石窝望见远处走来的唐僧，夕阳山路自然钩出下一回《师徒相遇》；悟空仍无金色头环。

## 上线前最后一步

维护者确认悟空与金箍棒连续性、五行山/石窝连续性、唐僧首次出场形象及全书无疼痛惩罚表达后，再在 `src/lib/library/xiyouji.ts` 接入本书、为 8 页标记 `imageStatus: "complete"`，并按上线计划调整 `comingSoon`。
