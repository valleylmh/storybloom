# StoryBloom 家庭故事平台审计与实施计划

> 状态基线：2026-08-16。本文档以当前仓库实际代码为准，不把规划中的能力写成已交付能力。

## 1. 产品结论

StoryBloom 应从“AI 绘本生成器”收敛为家庭故事平台，核心由四部分组成：

1. 精选绘本内容
2. 有声绘本阅读器
3. 家庭专属绘本创作
4. 私人故事书架

核心闭环是：

`绘本馆 → 打开并播放 → 收藏或读完 → 让孩子成为主角 → 选择家庭角色并确认形象 → 生成专属版本 → 保存到私人书架 → 反复阅读与继续创作`

当前仓库已经具备这条闭环的大部分底层零件，但它们分散在馆藏阅读器、首页生成器、家庭角色、最近作品、私有云归档和分享模块中。后续实施应复用这些能力并补齐状态与关联，不新建第二套生成器、角色库或存储体系。

本轮明确不把家庭录音、逐页录音或声音克隆作为核心阅读路径。阅读器必须在不请求麦克风权限的情况下工作。现有家庭声音代码保留为独立、默认关闭的可选能力，不进入家庭故事平台主流程。

## 2. 审计范围与方法

本次审计覆盖：

- `/library`、系列页和馆藏详情页
- `LibraryBookExperience`、`LibraryBookReader`、`LibraryNarrationToolbar`
- 普通生成作品的 `BookPreview` 与 `NarrationToolbar`
- `/api/audio`、TTS 路由、浏览器语音与音频缓存
- Supabase Magic Link 登录与全局 `AuthProvider`
- 本地作品历史、IndexedDB、本地/云端 Story Repository
- 家庭角色、卡通形象确认和故事角色 Anchor
- 文本生成任务、逐页插图任务、失败页恢复
- 分享快照、公开阅读页和撤销令牌
- 当前 Vitest、TypeScript、lint、构建与浏览器测试基础

状态定义：

- **Existing**：当前代码已经形成可用闭环，阶段内只需兼容和回归。
- **Partial**：已有基础，但缺少产品要求中的关键状态、入口、持久化或错误边界。
- **Missing**：当前代码没有对应数据模型或可用流程。

## 3. 当前资产清单

### 3.1 绘本馆路由、组件和数据来源

| 项目 | 状态 | 当前实现 | 主要缺口 |
|---|---|---|---|
| 绘本馆首页 `/library` | Partial | 按系列展示馆藏，支持成语故事、西游记、好奇为什么 | 没有继续阅读、最近播放、收藏、今晚读什么、分类筛选 |
| 系列页 `/library/[seriesId]` | Partial | 展示系列说明和有序书目 | 没有系列完成比例、已读状态和明确的继续下一回状态 |
| 馆藏详情页 `/library/[seriesId]/[bookId]` | Partial | SEO、结构化数据、8 页正文、阅读器、前后篇、分享与改编 CTA | 详情 metadata 不完整，结束态和专属改编上下文未结构化 |
| 馆藏数据 | Existing | `src/lib/library/` 静态 TypeScript 数据，当前 3 个系列、100 本已发布、每本 8 页 | `LibraryBook` 缺少 category、estimatedMinutes、languages、tags、featured、bedtimeSuitable、personalizationEnabled 等字段 |
| 馆藏发布保护 | Existing | `comingSoon`、发布过滤、sitemap、图片存在性与大小测试 | 仍需为新增 metadata 建立完整性测试 |

当前馆藏数量：

- 成语故事：30 本
- 西游记：60 回
- 好奇为什么：10 本
- 合计：100 本已发布馆藏

### 3.2 阅读器和播放能力

| 能力 | 状态 | 当前实现 | 主要缺口 |
|---|---|---|---|
| 馆藏翻页阅读器 | Existing | 受控页码、翻页/平铺模式、页码缩略图、图片灯箱 | 还未复用于用户生成绘本和分享页 |
| 中文播放 | Existing | 馆藏优先云端 TTS，失败回退 `SpeechSynthesis` | 缺少统一状态机、明确重试和位置恢复 |
| 英文播放 | Existing | 云端 TTS 与本机英语语音 | 同上 |
| 中英双语播放 | Existing | 每页先中文、后英文 | 云端 MP3 只能整段高亮，切换模式后的恢复策略未持久化 |
| 自动翻页 | Partial | 当前页 `audio.onended` 或系统语音完成后自动进入下一页，最后一页停止 | 没有用户可关闭的开关；错误后重试和失败页保护未形成状态机 |
| 文字高亮 | Partial | 云端音频高亮当前语言段落；系统语音按当前中/英文段落切换 | 没有句子/词时间轴时只能段落级；这是允许的首版降级，但需在模型中明确 highlight granularity |
| 键盘翻页 | Existing | 左右方向键；灯箱支持 Escape 和左右键 | 需要 E2E 回归 |
| 触摸翻页 | Partial | 横向位移超过 48px 时翻页 | 只判断 X 位移，未判断纵向滚动意图，可能与页面滚动冲突 |
| Reduced motion | Existing | 翻页动画和文字过渡支持 `prefers-reduced-motion` | 新增播放 UI 必须沿用 |
| 音频预取 | Partial | 播放当前页时预取下一页；内存 Promise 缓存 | 每次停止会清空整个缓存；未复用已有 IndexedDB `client-audio-cache`；没有签名 URL 过期判断 |
| 音频取消 | Partial | 使用 `AbortController`、run id、`speechSynthesis.cancel()` 和清除 `<audio>` | 手动翻页会取消旧播放，但状态分散，快速操作仍缺少明确的命令层测试 |
| 播放错误 | Partial | 展示错误文字，云端失败自动回退系统语音 | 错误 UI 没有统一“点击重试”，没有超时与离线状态，浏览器自动播放受限时退回原生播放器而非主按钮 |
| 暂停/继续/重放/停止 | Partial | 云端 `<audio controls>` 可暂停继续；语言按钮再次点击会停止 | 主操作不是“一键播放故事”，系统语音路径不支持真正暂停/继续，缺少重放当前页和显式停止命令 |
| 播放状态机 | Missing | 当前由 `activeNarration`、`audioStatus`、`playbackKind`、`audioError`、`audioMeta` 等状态共同决定 | 需要收敛为 `idle/loading/playing/paused/ended/error`，并用事件驱动迁移 |
| 播放进度保存 | Missing | 馆藏阅读页每次从第 1 页开始 | 需要页码、模式、页内位置、完成比例、最后阅读时间和读完状态 |

普通生成作品仍使用独立的 `NarrationToolbar`，按整本使用浏览器 `SpeechSynthesis`，没有翻页阅读、页级高亮或进度恢复。后续应让馆藏和用户生成作品复用同一个核心阅读器，但保留不同内容适配器，不强行把所有页面路由合并。

### 3.3 登录、匿名数据与云端保存

| 能力 | 状态 | 当前实现 | 主要缺口 |
|---|---|---|---|
| 全局登录 | Existing | `AuthProvider` + Supabase Magic Link，匿名首页不强制登录 | 继续保持匿名优先 |
| 匿名作品保存 | Existing | `client-history` 使用 IndexedDB，localStorage 作为 fallback | 只保留最多 10 本；没有阅读进度、收藏、分享管理和书架 metadata |
| 登录作品保存 | Partial | `saved_stories` + 私有 `story-archive`，由用户主动导入/同步 | 登录不自动同步是正确边界；尚无阅读进度和收藏表 |
| 本地/云端书架 | Partial | `/me/books` 展示本机与云端副本，支持打开和删除 | 不是产品化“我的书架”；缺少收藏、继续阅读、最近阅读、改标题、来源馆藏、角色系列和分享状态 |
| 匿名登录后合并 | Partial | 已有显式、本地优先的作品导入与冲突处理 | 没有阅读进度“按更新时间取新”和收藏并集的合并逻辑 |
| 删除生命周期 | Partial | 本地删除作品记录；云端删除主记录后再删图片；分享可用令牌撤销 | 云端先删行后删 Storage，失败会产生孤立资源；没有统一处理音频、分享、生成任务和可恢复规则 |

隐私边界必须保持：登录不等于同意上传，本地作品、阅读记录、收藏和照片都不能因为登录自动上传。首次云端同步仍需用户明确选择。

### 3.4 家庭角色、专属生成和生成任务

| 能力 | 状态 | 当前实现 | 主要缺口 |
|---|---|---|---|
| 家庭角色库 | Existing | 登录用户可创建孩子、家人和宠物角色；照片进入私有 Storage | 首次改编仍需允许不上传照片的快速角色 |
| 快速人物确认 | Existing | 极简创作可输入名字/身份，选择已有角色或保存新角色 | 馆藏改编入口尚未带入这套流程 |
| 卡通形象确认 | Partial | 新上传角色可先生成卡通形象，支持确认或重新生成 | 选择已有角色时不会形成“本故事 Anchor 确认”；缺少发型、年龄、眼镜、服装的结构化调整 |
| 故事级 Anchor | Partial | 服务端可并行生成 story character anchor，并把私有 token 绑定到主角 | Anchor 在文本生成时自动尝试，失败可静默降级，家长无法在整本生成前确认 |
| Character Bible | Existing | 结构化视觉锁、页级 `castIds`、参考图按实际出场角色传入 | 需要保存已确认 Anchor 版本并支持后续复用 |
| 可恢复生成任务 | Existing | 文本任务 ID、本地恢复指针、服务端任务状态、worker/lease 基础 | 生产共享存储和 worker 仍需按部署环境验收 |
| 逐页插图与单页重试 | Existing | 先文本后逐页图片；失败页可手动重试，单页失败不废弃整本 | 只能重画图片；缺少“只改文字”“保留角色换场景”“锁定角色后重画”等明确操作 |
| 馆藏改编入口 | Partial | 详情页 CTA 把书名拼入 `idea` 查询参数 | 没有 sourceLibraryBookId、StorySpec、系列、结构、场景和可替换角色位置 |
| 来源关联 | Missing | 生成结果只知道当前 `StoryInput` | 需要保存来源馆藏与专属版本关联，并支持返回原故事 |
| 自动进入私人书架 | Partial | 生成结果自动保存本机最近作品 | 没有专属书架状态、来源、主角色、最近打开和完成状态 |

### 3.5 分享、隐私和公共内容

| 能力 | 状态 | 当前实现 | 主要缺口 |
|---|---|---|---|
| 家庭作品默认私有 | Existing | 用户生成作品先存在本机；私有云需主动导入；不会自动进入馆藏 | 保持不变 |
| 主动创建分享 | Partial | `/api/share` 创建最小公开快照和持久化图片 | 创建前没有隐私预览和风险确认 |
| 撤销分享 | Existing | 本地保存 `deleteToken`，可调用 DELETE 并清理分享图片 | DELETE 请求失败时前端仍删除本地凭据，可能失去再次撤销能力 |
| 分享有效期 | Missing | `shared_stories` 没有过期字段 | 需要 7 天、30 天默认、永久三档 |
| 分享管理 | Missing | 仅在当前作品组件中显示当前浏览器记住的一个链接 | 登录用户需要服务端列表；匿名用户需要可靠恢复方案 |
| 公共和私人内容区分 | Partial | 馆藏走 `/library`，用户分享走 `/s` 且 noindex | 未来统一搜索和书架 UI 仍需明确视觉标识 |

### 3.6 首页和信息架构

| 能力 | 状态 | 当前实现 | 主要缺口 |
|---|---|---|---|
| 绘本馆入口 | Partial | 首页表单之后有绘本馆卡片，Footer 有入口 | 不够首要；没有“今晚读一本”主入口 |
| 创作入口 | Existing | 首页默认是记录/快速/完整创作表单 | 首次进入仍直接面对创作状态，阅读价值不够突出 |
| 我的书架入口 | Partial | “我的”进入 `/me`，侧栏有“我的绘本” | 首页和移动端没有清晰“书架”入口 |
| 三入口主导航 | Missing | 当前没有统一的绘本馆/创作/书架导航 | 阶段 2 建立；不能破坏匿名创作 |
| 移动端底部导航 | Missing | 无 | 阶段 2 实现，阅读页可使用精简版或隐藏非必要入口 |

### 3.7 测试覆盖

| 测试层 | 状态 | 当前实现 | 主要缺口 |
|---|---|---|---|
| TypeScript | Existing | `tsconfig` 严格模式，默认使用 `npx tsc --noEmit` | 新增模块需保持无错误 |
| 单元测试 | Partial | Vitest Node 环境覆盖馆藏数据、TTS 路由、生成任务、存储、分享和隐私基础 | 没有阅读状态机、阅读进度、收藏和组件交互测试 |
| 集成测试 | Partial | 多个 route/repository 测试实质上覆盖服务端集成边界 | `package.json` 没有独立 `integration` 脚本 |
| 浏览器 E2E | Missing | 仓库没有 Playwright 配置和 E2E 目录 | 阶段 6 引入轻量 Playwright dev dependency，并先覆盖核心闭环 |
| 浏览器兼容 | Partial | 之前做过人工桌面与移动尺寸验收，代码有触摸/键盘/reduced-motion | 没有 Chromium/WebKit/Firefox 自动回归 |

## 4. P0 阅读器验收差距

| P0 场景 | 当前状态 | 阶段 1 动作 |
|---|---|---|
| 匿名用户一次点击播放 | Partial | 提供唯一主按钮“播放故事”，默认使用上次语言或中文 |
| 播放结束自动翻页 | Existing | 纳入状态机并增加可关闭开关 |
| 最后一页停止 | Existing | 增加 `ended` 结束态和家长确认的下一回提示 |
| 暂停后继续 | Partial | 统一云端音频暂停/继续；系统语音无法可靠暂停时采用可解释的当前段重放策略 |
| 手动翻页立即停止旧音频 | Existing | 增加快速连续翻页与竞态测试 |
| 刷新恢复页码 | Missing | 新增本地阅读进度仓库 |
| 网络错误后手动重试 | Partial | `error` 状态提供“播放失败，点击重试” |
| 切换语言不重叠 | Partial | 模式切换事件先 cancel，再更新并从当前页重播 |
| 手机浏览器可用 | Partial | 修复纵向滚动与横向滑动判定，保证 44px 以上主点击区 |
| 不请求麦克风权限 | Existing | 主流程禁止调用 `getUserMedia`；加入源代码/E2E 保护 |
| 馆藏和用户作品复用阅读器 | Missing | 建立内容适配层，优先把本地用户作品接入同一核心阅读器 |
| 无时间轴仍可播放 | Existing | 保留 page/paragraph fallback，不把时间轴设为必填 |

## 5. 数据设计

### 5.1 复用原则

1. 用户生成绘本继续复用 `GenerateResponse`、`StoryRepository`、`saved_stories` 和本地 IndexedDB。
2. 家庭角色继续复用 `family_characters`，不创建新的“专属角色”表。
3. `ChildProfile` 与 `FamilyCharacter` 保持分离；阅读进度不要求选择孩子档案。
4. 登录不触发自动云同步。阅读记录和收藏的上传/合并必须经过明确的账户同步动作。
5. 本地阅读状态使用独立、可升级的 IndexedDB store，不改写现有 `storybloom-client-history` v1。

### 5.2 统一内容标识

```ts
type StoryContentType = "library" | "personalized";

type StoryContentRef = {
  contentType: StoryContentType;
  contentId: string;
};
```

馆藏 `contentId` 使用 `${seriesId}/${bookId}`，专属绘本使用稳定 `storyId`。UI 不把两类内容混在一起显示，但阅读器只依赖统一的 `title/pages/contentRef` 适配结果。

### 5.3 ReadingProgress

首版字段：

```ts
type ReadingProgress = {
  contentType: "library" | "personalized";
  contentId: string;
  pageIndex: number;
  positionMs?: number;
  languageMode: "zh" | "en" | "zh-en";
  playbackMode: "page";
  autoAdvance: boolean;
  progressPercent: number;
  completedAt?: string;
  lastReadAt: string;
  updatedAt: string;
};
```

规则：

- 本地复合键：`contentType:contentId`。
- 每次翻页、暂停、结束、切换语言和页面离开时节流保存。
- `positionMs` 只在 HTMLAudioElement 可可靠读取时保存；系统语音不伪造页内位置。
- 完成比例按已到达的最大页与总页数计算，避免用户向前翻页导致进度倒退。
- 读完最后一页时设置 `completedAt`；再次重读不会删除完成记录。
- 登录合并：同一内容采用 `updatedAt` 更新的一条；完成状态取并集后保留较新的阅读位置。

服务端阶段使用新增 `reading_progress` 表，不把阅读状态塞进 `saved_stories.story_snapshot`。这样馆藏和私人绘本可共用，删除作品时也可显式级联。

### 5.4 Favorite

```ts
type Favorite = {
  contentType: "library" | "personalized";
  contentId: string;
  createdAt: string;
};
```

规则：

- 匿名用户立即写本地并乐观更新 UI。
- 登录合并取并集，取消收藏以显式 tombstone 或较新的删除时间为准，不能因为旧云端记录把用户刚取消的收藏加回来。
- 服务端使用独立 `favorites` 表和 `(user_id, content_type, content_id)` 唯一约束。

### 5.5 私人书架 metadata

优先给 `SavedStory` 增加向后兼容的可选字段，并通过 `saved_stories` 可空列持久化：

```ts
type StoryPlatformMetadata = {
  sourceLibraryBookId?: string;
  mainCharacterId?: string;
  lastOpenedAt?: string;
  completedAt?: string;
  seriesKey?: string;
  confirmedAnchorVersion?: string;
};
```

`sourceLibraryBookId` 保存 `${seriesId}/${bookId}`。旧本地快照和旧云端记录没有这些字段时继续正常打开。

### 5.6 PersonalizationDraft

馆藏改编需要单独草稿，不直接把所有上下文塞进首页 query string：

```ts
type PersonalizationDraft = {
  id: string;
  sourceLibraryBookId: string;
  selectedCharacterIds: string[];
  selectedStyle?: string;
  storySpec: {
    theme: string;
    structure: string[];
    scenes: string[];
    tone: string;
    ageRange: string;
    seriesId?: string;
    replaceableRoles: string[];
  };
  anchorStatus: "not_started" | "generating" | "review" | "confirmed" | "failed";
  generationTaskId?: string;
  createdAt: string;
  updatedAt: string;
};
```

匿名草稿先存在本地。只有涉及私有家庭照片或跨设备保存时才要求登录和明确授权。

### 5.7 馆藏 metadata

在 `LibraryBook` 上增加可维护的结构化字段，不在 React 组件中散落文案：

```ts
type LibraryCategory =
  | "idiom"
  | "classic"
  | "science"
  | "bedtime"
  | "family-growth";

type LibraryBookMetadata = {
  category: LibraryCategory;
  ageRange: { min: number; max: number };
  estimatedMinutes: number;
  languages: Array<"zh" | "en">;
  seriesId?: string;
  seriesOrder?: number;
  personalizationEnabled: boolean;
  tags: string[];
  featured: boolean;
  bedtimeSuitable: boolean;
};
```

现有 `ageLabel`、`episodeNumber`、`order` 暂时保留，避免一次性迁移全部调用方；新字段先作为展示与筛选的权威来源，后续再清理重复字段。

### 5.8 数据库迁移和回滚

后续数据库变化必须遵循：

1. 只做 additive migration：新增表、可空列、索引和 RLS，不重命名或删除现有字段。
2. 每个 migration 同时提供 `supabase/rollbacks/<migration-name>.sql`，只回滚该阶段新增对象。
3. RLS 默认只允许 `auth.uid() = user_id`；匿名数据不直写 Supabase。
4. 分享表新增 `expires_at` 时，旧分享保留兼容：旧行可视为永久，直到用户主动修改或撤销。
5. 数据库部署仍需在 Supabase Dashboard 手工完成并记录，代码通过不等于生产迁移已部署。

## 6. 播放状态机设计

阶段 1 使用单一状态机，不再由多个布尔状态推断：

```ts
type PlaybackStatus =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "ended"
  | "error";

type PlaybackState = {
  status: PlaybackStatus;
  pageIndex: number;
  languageMode: "zh" | "en" | "zh-en";
  source: "cloud" | "browser" | null;
  autoAdvance: boolean;
  highlight: "none" | "page" | "paragraph" | "sentence" | "word";
  error?: { code: string; message: string; retryable: boolean };
};
```

主要事件：

- `PLAY`
- `AUDIO_READY`
- `PAUSE`
- `RESUME`
- `STOP`
- `REPLAY_PAGE`
- `PAGE_SELECTED`
- `LANGUAGE_CHANGED`
- `SOURCE_FAILED`
- `PLAYBACK_FAILED`
- `PAGE_ENDED`
- `BOOK_ENDED`
- `RETRY`

竞态规则：

- 每次 `PAGE_SELECTED`、`LANGUAGE_CHANGED`、`STOP` 和组件卸载都递增 session id 并中止旧请求。
- 只有当前 session id 可以更新播放器、页码、高亮或错误状态。
- 预取请求不得改变 UI 状态；预取失败只清理缓存，不触发自动跳页。
- 页面播放失败后停在当前页，等待用户重试，不自动跳到下一页。
- 最后一页结束进入 `ended`，只展示“重新播放”和“继续下一回”提示，不自动打开下一本。

## 7. 音频来源和缓存设计

保持轻量接口：

```ts
interface AudioSource {
  prepare(input: {
    contentId: string;
    pageIndex: number;
    languageMode: "zh" | "en" | "zh-en";
    signal: AbortSignal;
  }): Promise<PreparedAudio>;
}
```

实现顺序：

1. `CloudPageAudioSource`：调用现有 `/api/audio`，复用服务端 TTS 去重与持久缓存。
2. `BrowserSpeechSource`：云端失败或无需网络时使用 `SpeechSynthesis`。
3. 不为首版引入新的音频库。

缓存规则：

- 内存只缓存当前页和下一页 Promise。
- 使用已有 `client-audio-cache` 保存可复用 URL 前，必须校验 `signedUrlExpiresAt`。
- data URL 可本地缓存；临时签名 URL 过期后重新向服务端请求，不重复生成付费 TTS，服务端应命中自己的文本/声音 cache key。
- 语言、文本、声音或 Anchor 变化必须生成不同缓存键。

## 8. 埋点设计

当前 Vercel Analytics 只有在用户同意后加载。新增产品事件也必须遵守同一 consent，且不得包含儿童姓名、照片、自由文本、家庭关系描述、音频 URL、分享 token 或故事正文。

首批事件：

- `library_opened`
- `library_book_opened`
- `playback_started`
- `playback_paused`
- `playback_resumed`
- `playback_error`
- `page_completed`
- `book_completed`
- `reading_resumed`
- `book_favorited`
- `book_unfavorited`
- `series_next_clicked`
- `personalization_clicked`
- `personalization_started`
- `character_anchor_generated`
- `character_anchor_confirmed`
- `personalization_completed`
- `personalization_failed`
- `personalized_book_opened`
- `personalized_book_replayed`
- `page_regenerated`
- `share_created`
- `share_revoked`

允许的公共属性：

- `contentType`
- 馆藏 `seriesId`、`bookId`
- `languageMode`
- `pageNumber`、`totalPages`
- `source`（cloud/browser）
- 归一化错误类别，不含供应商原始错误正文
- 粗粒度设备类别和浏览器类别，优先使用分析 SDK 已提供字段

不记录：

- 儿童身份或年龄的精细画像
- 阅读速度、停顿或错误推断出的能力/情绪标签
- 家庭角色姓名、照片路径、声音 ID
- 自由输入主题、家长事实和允许的想象

北极星指标：每周完成至少一次有效阅读或播放的家庭数。首版“家庭”只能在登录且明确同步后按账户去重；匿名阶段使用隐私友好的设备级近似，不能跨设备指纹追踪。

## 9. 分阶段实施

### 阶段 0：审计、能力矩阵、数据和埋点设计

状态：**已完成审计、质量检查与阶段内修复，并作为独立阶段提交。**

- [x] 审计馆藏、阅读器、音频、认证、作品保存、家庭角色、分享和任务
- [x] 标记 Existing / Partial / Missing
- [x] 设计统一内容引用、阅读进度、收藏、书架 metadata 和改编草稿
- [x] 设计播放状态机、音频来源和埋点隐私边界
- [x] 运行阶段 0 质量检查并记录结果
- [x] 单独提交阶段 0

阶段 0 质量结果：

- `pnpm lint`：通过，0 error；保留 107 条既有 warning 作为后续分阶段清理基线。
- `npx tsc --noEmit`：通过。
- Vitest：91 个测试文件通过、3 个跳过；601 项测试通过、5 项跳过。Edge TTS 的 4 项本机 WebSocket 测试因需要监听 `127.0.0.1`，在允许本机端口的环境中单独运行并通过。
- `pnpm build`：通过；Next.js 生成 133 个静态页面，馆藏详情为 100 条静态路径。
- 构建后已清理 `.next` 并重新启动 `pnpm dev`，`http://localhost:3000` 已恢复 Ready。

阶段 0 同时修复了两项审计基线问题：

- 将已废弃且会进入交互提示的 `next lint` 脚本迁移为可自动执行的 ESLint 命令。
- 将西游记测试清单从过期的 50 回更新为当前实际发布的 60 回。

### 阶段 1：P0 有声绘本阅读器

- 建立 reducer/状态机和命令层
- 主按钮“播放故事 / 暂停 / 继续播放 / 重新播放”
- 自动翻页开关、停止、重放当前页和明确重试
- 本地阅读进度仓库、刷新恢复和“继续第 N 页”
- 中/英/双语安全切换
- 修复触摸滑动与滚动冲突
- 让本地用户生成绘本通过内容适配器复用阅读器
- 增加状态机、进度仓库和核心交互测试

阶段 1 不引入数据库 migration；登录用户先保持本地优先。服务端进度与合并在阶段 2 随收藏一起交付。

### 阶段 2：绘本馆、收藏和三入口信息架构

- LibraryBook metadata 与完整性测试
- 继续阅读、最近播放、收藏、系列进度、今晚读什么
- 首页“今晚读一本 / 给孩子做一本”双主入口
- 绘本馆 / 创作 / 书架主导航和移动底部导航
- 新增 `reading_progress`、`favorites` 迁移、RLS、回滚 SQL
- 显式合并匿名进度和收藏

### 阶段 3：馆藏故事到专属版本

- 结构化 `StorySpec` 和 `PersonalizationDraft`
- 详情页与读完页“让孩子成为故事主角”
- 三步内进入家庭角色选择
- 故事级 Anchor 预览、调整、确认和重试
- 保存 `sourceLibraryBookId` 与确认的 Anchor 版本
- 生成完成后进入私人书架，并可返回原始馆藏

### 阶段 4：私人书架、继续创作、分享与删除生命周期

- 我的创作 / 收藏 / 最近阅读 / 继续阅读
- 改标题、删除确认、分享状态和角色系列
- 使用同一角色继续创作
- 分享预览、30 天默认有效期、服务端列表与可靠撤销
- 删除故事时处理图片、音频、分享和任务；失败可重试并避免孤儿资源

### 阶段 5：搜索、分类、今晚读什么和睡前模式

- 标题、系列、主题、成语和科普关键词搜索
- 公共馆藏与私人绘本分组显示
- 年龄、时长、语言、系列、主题筛选
- 规则推荐和可解释的日期轮换
- 低刺激睡前模式；读完整本停止

### 阶段 6：E2E、质量评测、性能与兼容性

- Playwright Chromium / WebKit / Firefox
- 移动尺寸与网络失败流程
- iPhone Safari、Android Chrome 人工关键流程清单
- 固定生成质量测试集和人工评分模板
- 性能、音频缓存、快速操作竞态和可访问性修复

## 10. 每阶段交付模板

每个阶段必须独立提交，并在进入下一阶段前记录：

1. 修改文件
2. 数据库变化和回滚方式
3. 新增接口
4. 对现有功能的兼容性影响
5. lint 结果
6. `npx tsc --noEmit` 结果
7. 单元测试结果
8. 集成测试结果；若仓库无独立脚本，明确列出实际执行的 route/repository 测试
9. production build 结果
10. 本文档状态更新

当前仓库使用 `pnpm-lock.yaml`，后续继续使用 pnpm，不切换包管理器。虽然仓库日常 UI 迭代默认不要求 production build，但本项目实施任务已明确要求每阶段运行，因此每阶段构建前先确认没有 dev server；构建后如需继续浏览器调试，应清理混合 `.next` 输出并重新启动 dev server。

## 11. 兼容性和非目标

必须保持：

- 匿名用户可以阅读和创作。
- 登录不会自动上传本地作品、阅读记录、收藏、照片或声音。
- 现有 `GenerateResponse`、生成任务和逐页插图恢复继续工作。
- 旧本地历史和旧云端 `saved_stories` 没有新字段时仍可打开。
- 普通生成预览在切换到统一阅读器前继续保留现有浏览器朗读，避免一次性重写。
- 家庭照片仍需明确监护人授权，并只存私有 Storage。
- 分享内容不会自动进入公共绘本馆。

本轮非目标：

- 完整逐页录音器
- 家长录制整本
- 浏览器复杂降噪
- 声音克隆主流程
- 无限自动播放或下一本自动播放
- 儿童短视频信息流
- 儿童心理、情绪、能力或兴趣画像
- 复杂机器学习推荐
- 大规模扩充馆藏
- 更换现有技术栈或重写整个生成器

## 12. 主要风险

1. **浏览器系统语音暂停不一致**：不同 Safari/Chrome 对 `speechSynthesis.pause()` 支持不稳定。首版应允许“继续”从当前段重新朗读，并在 UI 中保持一致状态，不伪造精确位置。
2. **付费 TTS 重复请求**：客户端取消后服务端请求可能已经开始。必须依赖服务端 cache key 和 inflight 去重，客户端只预取一页。
3. **匿名数据升级**：不能升级现有 IndexedDB 时误删作品。阅读状态使用独立 DB/store，并为 localStorage 不可用提供内存降级。
4. **登录合并隐私**：合并不等于自动云同步。应先本地计算冲突预览，再由用户确认写入账户。
5. **分享撤销凭据丢失**：匿名分享不能在 DELETE 失败时丢掉唯一 delete token；阶段 4 必须修复。
6. **云端删除孤儿资源**：删除顺序和失败补偿需要可恢复任务，不能继续“先删主记录再删 Storage”。
7. **状态机与现有组件耦合**：先提取纯 reducer 和存储模块，再最小接入现有 `LibraryBookExperience`，避免同时重写 UI、路由和音频服务。

## 13. 最终产品定位检查

后续界面、README、ROADMAP 和代码命名应统一表达：

> StoryBloom 是一个由精选绘本、有声阅读、家庭专属创作和私人故事书架组成的家庭故事平台。

- 绘本馆负责每天被打开。
- 有声阅读负责低门槛使用。
- 专属生成负责让孩子走进故事。
- 私人书架负责让家庭故事被长期保存。
