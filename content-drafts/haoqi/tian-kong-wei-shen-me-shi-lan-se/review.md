# 《天空为什么是蓝色的》整本验收单

- 状态：文字与 8 张插图已完成，等待维护者最终审核；暂未修改 `imageStatus` 或移除 `comingSoon`
- ID：`tian-kong-wei-shen-me-shi-lan-se`
- 系列：`好奇为什么`
- 适读年龄：4-8 岁
- 插图生成日期：`2026-07-22`
- 插图资源：`public/library/haoqi/tian-kong-wei-shen-me-shi-lan-se/1.webp` 至 `8.webp`
- 源 PNG：`/private/tmp/storybloom-tian-kong-wei-shen-me-shi-lan-se/1.png` 至 `8.png`
- 接触表：`content-drafts/haoqi/tian-kong-wei-shen-me-shi-lan-se/contact-sheet.jpg`
- 插图规格：8 张均为 1200×1200 WebP，单张不超过 300KB

## 文字与科学审核

- 蓝天成因使用“气体分子”和“蓝光波纹较短、更容易散射”的低龄表达；没有把尘埃、烟雾或空气污染颗粒画成蓝天成因。
- 日落页表现更长的大气光路，以及蓝光向四周散开、橙红光更容易到达眼睛；没有使用“蓝光散光了”等易混淆说法。
- 七种颜色保留为儿童熟悉的可见光约定；第 2 页用棱镜和彩虹建立直观经验。
- 月亮内容不涉及本书；第 8 页的彩虹只作为孩子想象中的淡淡延伸问题，不暗示夜间真实出现彩虹。

## 角色与画风锚点

- 朵朵：5 岁中国女孩、两侧圆发髻和珊瑚色发绳、珊瑚色连衣裙、白袜和白色运动鞋。
- 妈妈：短卷深色头发、象牙色衬衫、蓝色长裤、白色运动鞋、棕色肩包。
- 全书统一使用精致动画电影质感的 3D clay-like 儿童绘本风格、暖色电影光、手作材质、正方形 1:1 构图。
- 所有页面均无画面文字、字母、标签、对话框、标识或水印；没有现代科技物件、危险动作或恐怖元素。

## 逐页文字与画面重点

1. 傍晚散步时，朵朵仰起头问：“妈妈，天空为什么是蓝色的呀？”
   On an evening walk, Duoduo looked up and asked, "Mama, why is the sky blue?"
   画面：朵朵与妈妈在湖畔公园并肩散步，朵朵指向开阔蓝天；建立人物、服装和公园锚点。
2. 妈妈说：“阳光看起来是白色的，其实里面藏着七种颜色呢。”
   Mama said, "Sunlight looks white, but seven colors hide inside it."
   画面：妈妈用玻璃棱镜把一束阳光分成彩虹，朵朵蹲在旁边惊喜观看；棱镜和七色光清晰。
3. “阳光穿过大气层时，会遇到数不清、肉眼看不见的气体分子。”
   "As sunlight travels through the atmosphere, it meets countless gas molecules too tiny to see."
   画面：阳光穿过清澈大气，点状分子以象征方式呈现；没有尘埃、烟雾或霾。
4. “蓝色光的波纹更短，遇到气体分子时，更容易朝四面八方散开。”
   "Blue light has shorter waves, so gas molecules scatter it more easily in every direction."
   画面：蓝色短波遇到分子后向多方向散开，较长的暖色波保持较直路径；示意清楚且无标签。
5. “散开的蓝光铺满天空，所以我们抬头看，到处都是蓝色。”
   "That scattered blue fills the whole sky — so everywhere we look, we see blue."
   画面：母女在公园抬头观察蓝天，蓝色散射光以柔和小光点象征，人物姿态与前页有变化。
6. “那傍晚为什么会变成橙红色？”“阳光斜着穿过更多空气，蓝光大多散到四周，橙红光更容易来到眼睛。”
   "Then why does sunset turn orange?" "At dusk sunlight crosses more air. Most blue light scatters aside, while orange-red light reaches our eyes more easily."
   画面：低角度夕阳、较长光路、橙粉天空和湖面倒影；母女观察日落，画面没有错误的尘埃示意。
7. 朵朵眨眨眼睛：“原来天空的颜色，是阳光和空气一起变的魔术！”
   Duoduo's eyes sparkled. "So the sky's color is a magic trick by sunlight and air together!"
   画面：朵朵在长椅旁张开双臂拥抱天空，妈妈坐在旁边微笑；蓝到橙的天空完成总结。
8. 回家路上，朵朵又想到了新问题：“那……彩虹又是怎么来的呢？”
   On the way home, a new question bloomed: "Then... where do rainbows come from?"
   画面：蓝调夜色中母女牵手回家，朵朵回头看向想象中的淡彩虹，明确作为下一本的好奇钩子。

## 插图文件规格

| 页码 | 文件大小 |
| --- | ---: |
| 1 | 158,972 bytes |
| 2 | 182,532 bytes |
| 3 | 161,280 bytes |
| 4 | 55,980 bytes |
| 5 | 143,316 bytes |
| 6 | 164,696 bytes |
| 7 | 145,912 bytes |
| 8 | 114,828 bytes |

## 生成与检查记录

- 8 页均使用 Codex 内置 `image_gen`，每页单独调用；没有使用 CLI 或应用内图片接口。
- 第 1 页不带引用，建立朵朵、妈妈、湖畔公园和画风锚点；第 2-8 页均引用最终第 1 页源图，保持角色与材质连续。
- 最终资源使用本地 `cwebp` 统一缩放为 1200×1200 WebP，8 张均小于 300KB。
- 已逐张 `view_image` 检查源图和最终 WebP，并检查接触表；未发现文字、水印、明显肢体错误、破图、危险或恐怖内容。
- 第 3 页的发光点是气体分子的象征化表现；第 4 页明确显示短蓝波的多方向散射；第 8 页彩虹为想象中的淡弧线。
- 第 4 页首版过度继承第 1 页的行走构图，与相邻页面重复；最终版已重做为无人物的纯天空散射示意，保留统一材质与色彩，同时让科学关系更清楚。

## 上线前最后一步

维护者确认科学表达、人物连续性和整本画面后，再在 `src/lib/library/haoqi.ts` 为 8 页补 `imageStatus: "complete"`，并移除本书的 `comingSoon`。
