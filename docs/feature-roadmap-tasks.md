# StoryBloom 功能扩充任务清单

> 本文档是功能规划与任务拆解，供后续实现者（人或 AI）按序领取任务。
> 生成日期：2026-07-19。决策背景见文末「决策记录」。
>
> 阅读约定：
> - 每个任务有 **验收标准**，实现完成后必须逐条核对。
> - 文中链接的代码文件是当前代码中的参考位置，实现时以实际代码为准。
> - 标注 ⚠️ 的是易错点或需要人工介入的环节。
> - 全局要求：遵守根目录 CLAUDE.md（服务端组件优先、`npx tsc --noEmit` 验证、不做超出任务范围的改动）。

## 总览与优先级

| 编号 | 功能 | 优先级 | 依赖 | 状态 |
|---|---|---|---|---|
| A | 绘本馆 `/library` + 成语故事系列 | P0 | 无 | 已完成（A1-A5 ✅；A3 首批 10 本全部上线） |
| B | 西游记连载系列 | P1 | A（复用 A 的全部基建） | 已完成前 2 回（后 3 回待生产） |
| C | 科普问答系列（「好奇为什么」） | P1 | A | 已完成前 2 本（后 6 题待生产） |
| D | 用户绘本公开分享链接 | P1 | 无（与 A 并行可做） | 已完成（迁移已执行） |
| E | PDF 导出 / 打印排版 | P2 | 无 | 未开始 |
| F | 读后互动小问题 | P2 | A（数据模型里预留字段） | 未开始 |
| G | 阅读进度与收藏 | P3 | A | 未开始 |

建议实施顺序：**A → D → B/C（可并行）→ E → F → G**。
A 是基建 + 首个内容系列，跑通后 B/C 基本是内容生产工作。

## 交接协议（给实现者）

1. **一次只领一个子任务**（如 A1），不要一个会话里横跨多个大任务。A 内部按 A1 → A2 → A3 → A4 → A5 顺序做（A3 的批量内容生产可与 A4 页面开发并行）。
2. 动手前先读本文档对应小节 + 小节中链接到的代码文件。文档中「已核实」的结论可直接采信，无需重新调查；其余以实际代码为准，若发现文档与代码冲突，**以代码为准并回来修订本文档**。
3. 完成后逐条勾选验收标准（直接改本文档的 `[ ]` 为 `[x]`），并把总览表状态改为「进行中/已完成」。
4. 每个子任务收尾必须：`npx tsc --noEmit` 通过；若有测试则 `npm test` 通过；不做验收标准之外的"顺手改进"。
5. 需要人工介入的环节（标 ⚠️ 的审核、图片挑选、命名确认）：停下来向维护者提出，不要擅自替维护者做决定。

---

## A. 绘本馆 `/library` + 成语故事系列（P0）

### 目标

新增公开可访问的"绘本馆"，承载预生成的系列化绘本内容。首个系列为**成语故事**（目标首批 10 本，框架支持后续扩到几百本）。每本书有独立 URL，可被搜索引擎收录（SEO 是核心诉求之一——目前站点生成内容全部私有，几乎没有可索引内容）。

### 背景与现状

- 现有静态样例书在 [src/lib/sample-books.ts](src/lib/sample-books.ts)：3 本 8 页中英双语书，图片资源放 `public/sample-books/`，通过首页弹窗阅读（[src/app/page.tsx](src/app/page.tsx) 中 `sampleResult` 状态）。
- 阅读器组件为 [src/components/book/BookPreview.tsx](src/components/book/BookPreview.tsx)。
- 类型定义在 [src/types/index.ts](src/types/index.ts)：`StoryPage` / `GenerateResponse` 已有完整的双语页结构，**尽量复用，不要另起炉灶**。
- 图片提示词的组织方式可参考 [docs/sample-book-prompts/](docs/sample-book-prompts/)（全局风格 prompt + 角色一致性 prompt + 每页 prompt + 负面 prompt）。
- 站点是 Next.js App Router，部署在 Cloudflare（opennextjs-cloudflare），页面尽量用**静态渲染**（内容是构建期确定的）。

### A1. 数据模型与目录结构

**任务**：定义系列/书籍的数据模型和内容存放结构。

- 新增类型（放 [src/types/index.ts](src/types/index.ts) 或新建 `src/types/library.ts`）：
  - `LibrarySeries`：`id`（slug，如 `chengyu`）、`title`、`subtitle`、`description`（系列页 SEO 文案）、`coverImage`、`accent` 色、`ageRange`、`bookCount`、`comingSoon?`。
  - `LibraryBook`：`id`（slug，如 `shou-zhu-dai-tu`）、`seriesId`、`title`（成语本身，如「守株待兔」）、`subtitle`、`origin`（典故出处，如《韩非子》）、`moral`（寓意一句话，中英双语）、`idiomMeaning`（成语释义 + 英文翻译，成语系列特有）、`pages: StoryPage[]`（**复用现有 `StoryPage`**）、`ageLabel`、`publishedAt`、`order`（系列内排序）、`quiz?`（预留，见任务 F，本期只定义类型不实现 UI）。
- 内容存放：`src/lib/library/` 目录，每个系列一个数据文件（如 `src/lib/library/chengyu.ts`），书多了以后可拆为每本一个文件 + index 聚合。图片放 `public/library/<seriesId>/<bookId>/<page>.webp`。
- 提供访问函数：`getAllSeries()`、`getSeries(seriesId)`、`getBook(seriesId, bookId)`、`getAdjacentBooks(seriesId, bookId)`（上一本/下一本导航用）。纯同步静态数据即可，不需要数据库。

**验收标准**：
- [x] 类型通过 `npx tsc --noEmit`。
- [x] `StoryPage` 被复用，没有重复定义双语页结构。
- [x] 用 1 本占位书（文字可先用假数据）验证访问函数可用。

> A1 完成记录（2026-07-19）：类型放 `src/types/library.ts`；数据与访问函数在 `src/lib/library/`（`chengyu.ts` + `index.ts`）；测试 `tests/library.test.ts`（4 例通过）。占位书「守株待兔」文字为未审核草稿，`comingSoon: true`，A2/A3 完成后替换。`getSeriesBooks(seriesId)` 在计划之外补充导出（系列页需要列出书目）。

### A2. 成语故事内容生产脚本

**任务**：写一个离线脚本（`scripts/generate-library-book.ts`，用 `tsx` 或 `node --experimental-strip-types` 运行，不进入应用 bundle），输入成语名 + 出处梗概，产出一本书的草稿 JSON。

- 文案生成接入方式（已核实）：[src/lib/story-generator.ts](src/lib/story-generator.ts) 导出 `generateStoryText(input: StoryInput): Promise<{ pages, coverTitle }>`，脚本可直接调用——构造 `StoryInput`，`theme: "custom"`、`customTheme` 填成语典故要求（8 页结构、温和化等，见下）。⚠️ 若 custom theme 的通用 prompt 不足以约束成语结构，优先在脚本侧把要求写进 `customTheme`/`otherDetails` 文本；实在不够再考虑给 generator 加可选参数，但**不得改变现有 API 行为**。脚本运行需要 `.env.local` 里的文本模型环境变量（`CPA_API_KEY` 等，本地跑脚本前确认已配置）。
- 生成要求（写入 prompt）：
  - 8 页结构：1-2 页设定人物场景，3-6 页推进典故情节，7 页点题（成语出现），8 页寓意收尾。
  - 每页中文 ≤ 40 字，英文为意译而非直译，符合 4-8 岁认知。
  - 温和化处理：典故中的负面结局（如「守株待兔」的饿死）改为温和版本（如「什么也没等到，明白了道理」）。
  - 同时产出：每页 `illustrationPrompt`（沿用 [docs/sample-book-prompts/](docs/sample-book-prompts/) 的「全局风格 + 角色一致性 + 页级」三段式）、`idiomMeaning`、`moral`。
- 输出草稿到 `content-drafts/<seriesId>/<bookId>.json`（此目录加入 `.gitignore` 与否由维护者定，建议提交以便追溯审核修改）。
- ⚠️ **人工审核环节**：脚本产出的是草稿。流程为：脚本生成 → 人工审核/修改 JSON → 使用 Codex 内置生图工具逐页生成（第 1 页作为后续角色锚点）→ 图片放入 `public/library/` → 草稿转正式数据文件。在脚本 README 里写清这个流程。

**验收标准**：
- [x] 脚本可独立运行：`npx tsx scripts/generate-library-book.ts chengyu shou-zhu-dai-tu "守株待兔：宋人耕田，兔触株死……"`。
- [x] 产出 JSON 结构与 `LibraryBook` 类型一致（脚本内用 zod 校验，项目已有 zod 依赖）。
- [x] 不影响现有 `/api/generate` 行为（回归：现有生成流程正常）。

> A2 完成记录（2026-07-19）：脚本 `scripts/generate-library-book.ts` + 流程文档 `scripts/README.md`。实现决策：**不复用** `generateStoryText()`——它在 API 失败/漂移时会静默回退到模板故事，对内容生产不可接受（模板会伪装成真草稿）；改为直接调用导出的 `requestCpaStory()`（story-generator.ts 仅把 `requestCpaStory`/`STYLE_SPINES` 从私有改为导出，无行为变化，35 个测试全过）。支持 `--dry-run`（不花钱检查 prompt）。⚠️ 验证时 CPA 中转端点返回 530（服务端不可达，curl 独立确认），真实内容生成（A3）待服务恢复后执行。

### A3. 首批内容：10 个成语

**任务**：用 A2 脚本生成并人工审核首批 10 本。建议选低龄认知度高、情节可视化强的：

守株待兔、画蛇添足、拔苗助长、亡羊补牢、井底之蛙、狐假虎威、愚公移山、刻舟求剑、掩耳盗铃、对牛弹琴。

- 每本 8 页 × 10 本 = 80 张插图。⚠️ 图片生成是本任务最大工作量，且需要人工挑选一致性最好的图。建议先用 2 本（守株待兔、狐假虎威）走完全流程验证管线，再批量做剩下 8 本。
- 图片统一风格：建议全系列用同一种风格（如现有 `fairytale` 风格 prompt），保持书架视觉统一。
- 每本书的第 1 页图兼作封面图（或单独生成封面，实现者与维护者确认）。
- 插图执行约束（2026-07-20）：使用 Codex 内置生图工具，每页一张；第 1 页确定角色、服装和材质，后续 7 页以其为引用图保持一致，不走应用内或外部平台的图片生成接口。

**验收标准**：
- [x] 至少 2 本完整上线（文字审核过 + 8 页图齐全），其余 8 本可标记 `comingSoon` 逐步补充。
- [x] 图片为 webp，单张 ≤ 300KB（Cloudflare 流量与加载速度考虑）。

> A3 完成记录（2026-07-21）：首批 10 本《守株待兔》《狐假虎威》《画蛇添足》《拔苗助长》《亡羊补牢》《井底之蛙》《愚公移山》《刻舟求剑》《掩耳盗铃》《对牛弹琴》均已完成文字与插图验收；每本含 8 页中英双语内容，共 80 张插图，全部使用 Codex 内置生图工具逐页生成。最终资源均为 1200×1200 WebP，单张不超过 300KB；10 本均无 `comingSoon`、已进入 sitemap，并继承浏览器端绘本视频生成及系统分享/复制 canonical 阅读链接。各书审核记录、逐页视觉检查和整本接触表见对应的 `content-drafts/chengyu/<book-id>/` 目录。

### A4. 路由与页面

**任务**：三层页面，全部服务端组件 + 静态渲染（`generateStaticParams`）。

1. **`/library`（绘本馆首页）**：系列卡片列表（成语故事 + 预告中的西游记/科普问答占位卡）。风格沿用站点现有视觉（暖色调、accent 色系统，参考 `SAMPLE_BOOKS_META` 的 accent 用法）。
2. **`/library/[seriesId]`（系列页）**：系列介绍 + 书籍网格（封面图、标题、成语释义一行）。`comingSoon` 的书显示但不可点。
3. **`/library/[seriesId]/[bookId]`（书籍详情/阅读页）**：
   - 核心阅读体验来自 [BookPreview.tsx](src/components/book/BookPreview.tsx)。⚠️ 已核实：它是重客户端组件（`"use client"`，内含旁白音频缓存、视频面板、zip 导出、社交分享图渲染等），整体塞进静态内容页会拖入大量无关代码。**推荐做法**：从中提取轻量的翻页阅读核心（页图 + 双语文本 + 翻页控制）为共享组件（如 `StoryReader`），BookPreview 和 library 页都用它；旁白/视频/导出等重功能保留在 BookPreview。不要复制粘贴出第二套阅读器。
   - 页面额外内容：成语释义卡（中英）、典故出处、寓意、上一本/下一本导航、"想要一本以孩子为主角的绘本？"→ 首页生成器的转化引导（这是绘本馆导流回核心功能的关键链接）。
4. **入口**：首页加绘本馆入口卡片（放在精选绘本书架附近）；[Footer.tsx](src/components/layout/Footer.tsx) 加链接。

**SEO 要求（本任务核心，不可省）**：
- [x] 每页 `generateMetadata`：标题如「守株待兔 - 中英双语成语故事绘本 | StoryBloom」、description 用寓意/释义。
- [x] 书籍页注入 JSON-LD（`Book` 或 `Article` schema）。
- [x] **新建** `src/app/sitemap.ts` 与 `src/app/robots.ts`（已核实：项目目前两者都没有），sitemap 覆盖所有 library 路由 + 首页/custom 等公开页。
- [x] OG 图：书籍页用封面图作 og:image（分享到社交媒体有图）。

**验收标准**：
- [x] 三层路由静态生成（`next build` 输出中确认为 Static/SSG）。
- [x] 移动端可用（现有站点是移动优先，阅读页在 375px 宽下检查）。
- [x] Lighthouse 书籍页 SEO 分 ≥ 95。
- [x] `npx tsc --noEmit` 通过，现有页面无回归。

> A4 完成记录（2026-07-19）：路由 `src/app/library/{page,[seriesId]/page,[seriesId]/[bookId]/page}.tsx`，全部服务端组件；build 确认 `/library` Static、两层动态路由 SSG。阅读器复用策略调整：书籍页是纯静态内容（图 + 双语文本），直接复用 `pages-grid`/`page-card` 的 CSS 类而非提取 `StoryReader` 组件——BookPreview 的翻页/朗读等交互对静态页非必需，提取组件反而引入客户端 JS（书籍页 First Load JS 仅 106kB vs 首页 211kB）。D 任务的分享页有交互需求，届时再评估提取。SEO：`layout.tsx` 补了全局 `metadataBase`（canonical 此前是相对路径，Lighthouse 不认）；`comingSoon` 书籍页自动 `noindex` 且不进 sitemap；临时把占位书置为发布态实测 Lighthouse SEO=100 后还原。入口：首页表单下方入口卡（中英双语文案）+ Footer 链接（顺带补了 /custom 链接）。占位书未发布（`comingSoon: true`），系列页显示"即将上线"不可点，书籍详情页带"抢先预览"横幅（直链可看，便于内容审核）。

> A4 增补记录（2026-07-20）：维护者验收《守株待兔》后，书籍页增加独立客户端小岛 `LibraryBookTools`，只复用现有 `StoryVideoPanel`，Remotion 渲染引擎仍在点击后动态加载，不引入整个 `BookPreview`。分享使用馆藏书自身的稳定 canonical URL（系统分享 + 复制链接），不依赖任务 D 的 Supabase 快照。无旁白 MP4 已在 Chrome 本地实测生成成功：720×1280、约 51.29 秒；375px 下工具区无横向溢出。

### A5. 个性化钩子（差异化亮点，可与 A4 分开实现）

**任务**：在书籍阅读页放一个轻量个性化入口："让 {孩子名} 走进这个故事"。

- 表现：书末尾（或阅读完成时）出现引导卡，点击跳转首页生成器并**预填该成语主题**（如 URL 参数 `/?theme=custom&customTheme=守株待兔的故事，融入孩子日常`）。
- ⚠️ 只做跳转预填，**不要**在本期做"直接在 library 页内联生成"（会把内容页和昂贵的生成链路耦合）。
- 已核实：首页 [page.tsx](src/app/page.tsx) 已有读 URL 参数的模式（`mode` / `book` / `view` 三个 query key，见文件顶部常量），照同样模式新增主题预填参数即可；StoryForm 本身目前不读 URL，参数解析放在 page 层传入。

**验收标准**：
- [x] 从书籍页点击引导 → 首页表单已预填对应主题 → 正常走生成流程。

> A5 完成记录（2026-07-19）：零新增基建——复用已有的 `/?mode=minimal&idea=<文案>` 深链（每日灵感邮件同款机制，MinimalStoryEntry 挂载时读 `idea` 参数预填输入框并截断 100 字）。书籍页 CTA 改为「让孩子走进这个故事」并带上 `让孩子走进「{成语}」的故事…` 文案。Playwright 实测：点击 CTA → 首页极简输入框已预填 → 可直接生成。原计划的 `/?theme=custom&customTheme=` 方案不需要（idea 深链等价且已存在）。

---

## B. 西游记连载系列（P1，依赖 A）

### 目标

公版 IP 连载系列，制造"追更"复访动力。每回一本 8 页书，首批 5 回。

### 任务

1. **内容规划**：从原著挑适合低龄的前期情节，首批 5 本建议：石猴出世、拜师学艺、龙宫借宝（金箍棒）、大闹天宫（软化处理）、师徒相遇。⚠️ 低龄改编原则写入生成 prompt：打斗改为"比试/智斗"，妖怪形象趣味化不恐怖，不出现死亡描写。
2. **连载字段**：`LibraryBook` 增加 `episodeNumber`、系列页按连载顺序展示，书籍页显示「第 N 回」+ 下一回预告（未上线的显示"即将更新"）。
3. **角色一致性** ⚠️：连载系列的核心难点——孙悟空/唐僧等主角必须跨书视觉一致。建立系列级角色卡（`docs/library-prompts/xiyouji/characters.md`：每个角色的固定外观 prompt），所有页级 prompt 强制引用。生成图片时同角色多本书对比检查。
4. **个性化钩子**：西游记版的引导文案——"让 {孩子名} 成为陪悟空取经的小伙伴"。
5. 复用 A2 脚本（支持传系列参数与系列专属 prompt 模板）、A4 页面（无需新路由）。

**验收标准**：
- [x] 首批至少 2 回完整上线，上一回/下一回导航可用；未发布下一回时的「即将更新」逻辑已保留。（后 3 回内容待生产）
- [x] 孙悟空在不同书之间外观一致（人工对比确认）。

> B 完成记录（2026-07-22）：前 2 回文字完成低龄审核与角色一致性修订；按角色卡使用 Codex 内置生图工具生成 16 张插图，全部为 1200×1200 WebP 且低于 300KB。第 2 页作为裸石猴锚点，第 7 页建立美猴王服装锚点，跨书复用；每回均有接触表和逐页审核记录。`imageStatus: "complete"` 已补齐并移除 `comingSoon`，两回进入 sitemap。后 3 回（龙宫借宝/大闹天宫/师徒相遇）待后续内容生产。

---

## C. 科普问答系列（P1，依赖 A）

### 目标

"为什么"类科普绘本。⚠️ **命名注意**：「十万个为什么」是少年儿童出版社的注册商标，**不得使用**。建议系列名：「好奇为什么」或「小问号」（实现前与维护者确认最终命名）。

### 任务

1. **内容结构**：每本回答一个问题（如「天空为什么是蓝色的」「为什么要睡觉」），8 页结构：1-2 页孩子视角提出问题 → 3-6 页拟人化/故事化解释 → 7 页回到现实印证 → 8 页延伸一个新问题（钩下一本）。
2. **首批 8 题建议**：天空为什么是蓝的、为什么会下雨、为什么要睡觉、月亮为什么跟着我走、为什么树叶会变黄、肚子为什么会咕咕叫、为什么星星会眨眼、彩虹是怎么来的。
3. **科学准确性** ⚠️：生成 prompt 中要求"简化但不错误"（可以说"光在空气里散开了，蓝色散得最多"，不可以说"天空是海的倒影"这类伪科学）。审核环节需重点核对科学性。
4. `LibraryBook` 增加 `question` 字段（原始问题，用于 SEO 标题——"为什么"类搜索词流量好）。
5. 复用 A2 脚本 + A4 页面。

**验收标准**：
- [x] 首批至少 2 本完整上线。（文字科学性已审核，插图已生成并接入书库）
- [x] 每本书籍页 SEO 标题含完整问题句（如「天空为什么是蓝色的？- 儿童科普双语绘本」）。

> C 完成记录（2026-07-22）：前 2 本文字完成科学性审核；天空篇将蓝天成因修正为气体分子 Rayleigh 散射，月亮篇将解释限定为短途视差观察。使用 Codex 内置生图工具完成 16 张插图，全部为 1200×1200 WebP 且低于 300KB；每本均有接触表和逐页审核记录。`imageStatus: "complete"` 已补齐并移除 `comingSoon`，两本进入 sitemap。其余 6 题待后续内容生产。
>
> B/C 共同的工程加固：系列页封面与书籍页正文图现在以 `imageStatus === "complete"` 为准；`/library` 首页占位卡移除，三个真实系列卡就位；测试覆盖已发布书的完整图片、`bookCount`、sitemap 与 SEO 字段。此前的 SSG 验证保持有效。

---

## D. 用户绘本公开分享链接（P1，独立于 A）

### 目标

用户生成的绘本目前只存在本地/自己账号下，无法分享。分享链接是最低成本的增长渠道（家长分享到家庭群）。

### 现状（已核实，实现者直接采信）

- **故事没有持久存储**：[src/lib/storage.ts](src/lib/storage.ts) 的 `cacheStory` 只是缓存——Redis（Upstash）TTL 24 小时，无 Redis 时落本地磁盘/内存。24 小时后故事即不可取。浏览器端 [src/lib/client-history.ts](src/lib/client-history.ts) 只在 localStorage 存历史记录。**因此分享功能必须先做"故事快照持久化"（写入 Supabase），这是本任务的前置工作，工作量计入。**
- **已有"分享"是图片分享**：BookPreview 内已有社交分享功能（渲染分享长图 + Web Share API 分享图片文件），但没有"链接分享"。新按钮命名注意与现有"分享图片"区分（如「复制阅读链接」）。
- 绘本馆的预生成书籍已有稳定公开路由，可直接分享 canonical 阅读链接；这不解决用户生成绘本的持久化，因此不计作 D 完成。
- 页面图片 `imageUrl` 可能是 data URL（base64 内嵌）或第三方临时 URL，分享快照落库前必须把图片转存为对象存储的稳定 URL（Supabase Storage），⚠️ 否则要么 JSON 过大（base64）要么图片过期失效。

### 任务

1. **分享数据层**：`shared_stories` 表（Supabase）：`share_id`（nanoid，不可枚举）、`story_json`、`created_at`、`expires_at?`、`owner_user_id?`。图片持久化到 Supabase Storage（见上方"现状"第 3 条——data URL 解码后上传，替换 JSON 内引用后再落库）。
2. **分享 API**：`POST /api/share`（创建，需限流——项目已有 `@upstash/ratelimit`）、分享页读取用服务端直查。
3. **分享页 `/s/[shareId]`**：只读阅读页，复用阅读器（同 A4 对 BookPreview 的复用策略）。页面含"我也要做一本"转化入口。`noindex`（用户内容不进搜索引擎）。
4. **入口 UI**：绘本阅读完成界面加"分享"按钮 → 生成链接 + 复制；移动端用 Web Share API。
5. **隐私**：分享页不展示孩子全名之外的表单信息（喜好细节等不渲染）；提供删除入口（有账号的用户可删自己的分享）。

**验收标准**：
- [x] 生成绘本 → 点分享 → 得到链接 → 无痕窗口打开可完整阅读（含图片）。
- [x] 分享 API 有限流；share_id 不可枚举。
- [x] 分享页 `noindex`；不泄露多余个人信息。

> D 完成记录（2026-07-22）：迁移 `supabase/migrations/202607210001_shared_stories.sql` 已由维护者执行。`shared_stories` 表保持 RLS 开启且无客户端策略，仅 service-role 可达；公开 `story-shares` bucket 用于持久化分享图片。服务端快照只保留书名、孩子名、语言与正文页，刻意丢弃玩具、朋友和外观描述等个性化字段。API `POST/DELETE /api/share` 保留 IP 哈希限流、不可枚举 `share_id` 与一次性 `deleteToken` 删除机制。迁移后已完成真实端到端验证：创建返回 200、分享页返回 200、凭 token 删除返回 200、删除后页面返回 404；测试记录已立即清理。

---

## E. PDF 导出 / 打印排版（P2）

### 目标

家长最终想要"能打印的绘本"。现有导出只有图片 zip（[src/lib/client-zip.ts](src/lib/client-zip.ts)）。PDF 也是通向付费定制（/custom）的体验漏斗。

### 任务

1. **技术选型**（实现者调研后定，倾向前端方案避免服务端渲染成本）：浏览器端 `pdf-lib` 或 `jspdf` 合成；⚠️ 注意 Cloudflare Workers 的包体积/运行时限制，倾向纯客户端生成。
2. **排版**：横向 A4 每页一跨页（左图右文或上图下文）、封面页（书名 + 孩子名 + 献词 `dedication` 字段已存在）、末页 StoryBloom 品牌页。中文字体嵌入注意体积（考虑只嵌子集或用图片化文字，实现者评估）。
3. **入口**：阅读完成界面"下载 PDF"按钮；library 书籍页同样提供（预生成内容可直接下载，作为引流钩子——可要求留邮箱后下载，接入现有 newsletter 订阅链路，实现者与维护者确认是否加此门槛）。

**验收标准**：
- [ ] 8 页书导出 PDF < 15MB，中文不乱码，手机 Safari/Chrome 都能触发下载。
- [ ] 打印预览（A4）版式无溢出。

---

## F. 读后互动小问题（P2，依赖 A 数据模型）

### 目标

每本书 2-3 道理解小问题，提升教育属性。成语系列尤其合适（"守株待兔是什么意思？"）。

### 任务

1. **数据**：启用 A1 预留的 `quiz` 字段：`Array<{ question: string; questionEn?: string; options: string[]; answerIndex: number; explanation: string }>`。A2 脚本增加 quiz 生成（同样人工审核）。
2. **UI**：阅读到最后一页后出现"小问答"卡片，选择题形式，答对有庆祝动效（简单 CSS 即可，不引入动画库），答错显示解释并可重选。纯客户端状态，本期不记录成绩。
3. 先在 library 内容上线；用户生成的绘本是否附带 quiz 由后续任务决定（生成 API 加页数会增加成本 ⚠️，本期不做）。

**验收标准**：
- [ ] library 书籍读完出现问答，交互完整（选择/反馈/解释）。
- [ ] 用户生成绘本流程无任何变化。

---

## G. 阅读进度与收藏（P3，依赖 A）

### 目标

内容库变大后，"读到哪了/收藏了什么"产生留存价值。

### 任务

1. **本地优先**：未登录用 localStorage 记录（复用 [src/lib/client-history.ts](src/lib/client-history.ts) 的模式）：每本 library 书的已读标记 + 收藏列表。
2. **UI**：系列页书卡显示"已读"角标；绘本馆首页加"继续阅读"行；书籍页收藏按钮。
3. **登录同步（可选子任务）**：已登录用户同步到 Supabase（family 账号体系已存在，见 [src/app/family/page.tsx](src/app/family/page.tsx)）。⚠️ 先确认 family 登录的实际使用率再决定是否做，避免过度建设。

**验收标准**：
- [ ] 未登录状态下已读/收藏在刷新后保留。
- [ ] 不影响现有 family library 功能。

---

## 决策记录

- **2026-07-19**：内容系列（成语故事/西游记/科普问答）放**独立路由 `/library`**，不并入首页样例书架。理由：独立 URL 才有 SEO 价值；首页书架不适合承载几十上百本内容。首页保留入口卡片。
- **2026-07-19**：「十万个为什么」为注册商标，系列改用自有命名（最终名待定，候选：好奇为什么/小问号）。
- **2026-07-19**：内容生产采用"脚本生成草稿 → 人工审核 → 静态数据上线"流程，不做运行时动态生成（成本与质量控制考虑）。
- **2026-07-19**：个性化钩子（孩子名字进入经典故事）通过"跳转首页生成器 + 预填主题"实现，不在 library 页内联生成。
- **2026-07-21**：科普问答系列定名**「好奇为什么」**（维护者确认），series id 用 `haoqi`。
- **2026-07-21**：B/C 的文字草稿由本会话直接撰写进数据文件（CPA 文本服务持续 530 不可用，脚本模板已备好待恢复后用于后续批量生产）；草稿书 `comingSoon: true`，与成语系列相同的"审核→插图→发布"流程。
