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
| 绘本馆首页 `/library` | Existing | 继续阅读、最近播放、我的收藏、系列故事、公共/私人分组搜索、年龄/时长/语言/系列/主题/睡前组合筛选，以及参考家长主动年龄选择的可解释“今晚读什么”；无历史时隐藏空模块 | 搜索和筛选的跨浏览器自动化回归留到阶段 6 |
| 系列页 `/library/[seriesId]` | Existing | 展示系列说明、有序书目、完成数量、系列进度、已读/未读和收藏状态；长系列由用户主动“显示更多” | 下一回仍由详情页用户主动进入，符合不自动连播原则 |
| 馆藏详情页 `/library/[seriesId]/[bookId]` | Existing | SEO、结构化数据、8 页阅读器、收藏、metadata、前后篇、分享、低刺激睡前模式、规则相关推荐，以及携带来源 ID 的“让孩子成为故事主角”入口；读完状态也展示入口 | 页面级文字/场景修复仍在后续阶段 |
| 馆藏数据 | Existing | `src/lib/library/` 静态内容保持不变；`LibraryBookMetadata` 和 resolver 统一补齐 category、ageRange、estimatedMinutes、languages、seriesOrder、tags、featured、bedtimeSuitable、personalizationEnabled | 个别书的 metadata override 可按内容运营逐步补充 |
| 馆藏发布保护 | Existing | `comingSoon`、发布过滤、sitemap、图片存在性与大小测试 | 仍需为新增 metadata 建立完整性测试 |

当前馆藏数量：

- 成语故事：30 本
- 西游记：60 回
- 好奇为什么：10 本
- 合计：100 本已发布馆藏

### 3.2 阅读器和播放能力

| 能力 | 状态 | 当前实现 | 主要缺口 |
|---|---|---|---|
| 馆藏翻页阅读器 | Existing | 受控页码、翻页/平铺模式、页码缩略图、图片灯箱；本地用户生成作品已复用同一 `LibraryBookExperience` | 公开分享页仍使用轻量静态阅读视图 |
| 中文播放 | Existing | 馆藏优先云端 TTS，失败回退 `SpeechSynthesis`；统一状态机、重试和可用时的页内位置恢复 | 服务端跨设备进度尚未接入 |
| 英文播放 | Existing | 云端 TTS 与本机英语语音，共用相同状态机和取消边界 | 同上 |
| 中英双语播放 | Existing | 每页先中文、后英文；切换模式先取消旧任务并从当前页重播 | 云端 MP3 没有句子/词时间轴，只做当前语言段落高亮 |
| 自动翻页 | Existing | 当前页结束后按开关进入下一页；最后一页停止；不会自动进入下一本 | 系列下一回仍由用户主动点击 |
| 文字高亮 | Existing | 云端音频高亮当前语言段落；系统语音按当前中/英文段落切换；暂停时清除、继续时恢复 | 有时间轴前不承诺句子或词级同步 |
| 键盘翻页 | Existing | 左右方向键；灯箱支持 Escape 和左右键 | 需要 E2E 回归 |
| 触摸翻页 | Existing | 横向位移超过 48px 且显著大于纵向位移时翻页；阅读舞台使用 `touch-action: pan-y` | iPhone Safari 和 Android Chrome 仍需阶段 6 人工回归 |
| Reduced motion | Existing | 翻页动画和文字过渡支持 `prefers-reduced-motion` | 新增播放 UI 必须沿用 |
| 音频预取 | Existing | 优先请求当前页，只主动预取下一页；复用 IndexedDB `client-audio-cache` 和当前会话 Promise；校验 URL 过期并在加载失败时失效缓存 | 仍需阶段 6 做弱网和缓存容量评测 |
| 音频取消 | Existing | `AbortController`、run id、`speechSynthesis.cancel()` 和清除 `<audio>` 共同保证页面/语言/离开时取消旧任务 | 需要 Playwright 竞态回归 |
| 播放错误 | Existing | 45 秒请求超时、云端失败回退系统语音、自动播放受限回到主按钮、最终失败显示“点击重试” | 离线/格式失败的多浏览器自动化回归放在阶段 6 |
| 暂停/继续/重放/停止 | Existing | 单一主按钮“播放故事 / 暂停 / 继续播放 / 重新播放”，另有重播当前页和停止 | `SpeechSynthesis.pause()` 的平台差异需继续人工验证 |
| 播放状态机 | Existing | `playback-machine.ts` 提供 `idle/loading/playing/paused/ended/error` 和事件驱动迁移 | 后续埋点只消费状态，不再新增平行布尔状态 |
| 播放进度保存 | Partial | 独立 IndexedDB `storybloom-reading-state`，localStorage fallback；保存页码、最大页、语言、自动翻页、可用时的页内位置、完成比例和时间 | 登录用户服务端保存与显式合并在阶段 2 |

本地用户生成作品的正式成品预览已经复用馆藏核心阅读器，默认继续使用浏览器 `SpeechSynthesis`，避免改变既有付费 TTS 成本和 Provider 边界。精选案例和定制案例仍保留旧 `NarrationToolbar`；页面管理、插图重试和修复区没有被阅读器替代，只在界面上与“阅读和播放”明确分区。

### 3.3 登录、匿名数据与云端保存

| 能力 | 状态 | 当前实现 | 主要缺口 |
|---|---|---|---|
| 全局登录 | Existing | `AuthProvider` + Supabase Magic Link，匿名首页不强制登录 | 继续保持匿名优先 |
| 匿名作品保存 | Existing | `client-history` 使用 IndexedDB，localStorage 作为 fallback；书架保留上限提升到 50 本 | 仍是单设备存储，浏览器数据被清除后需依赖主动云端导入或分享管理码 |
| 登录作品保存 | Partial | `saved_stories` + 私有 `story-archive`，由用户主动导入/同步；云端副本可独立改标题和安全删除 | 登录不自动同步是正确边界；阶段 2/4 migration 未部署前跨设备状态和新分享字段不可宣称生产可用 |
| 本地/云端书架 | Existing | `/me/books` 展示继续阅读、收藏、最近阅读、我创作的、分享管理；本机/云端副本支持打开、改标题、分享状态和删除确认 | 本机与云端仍保持显式副本边界，不自动双向改名或上传 |
| 匿名登录后合并 | Partial | 作品仍使用显式导入；阅读进度和收藏新增家长主动“合并并开启同步”，进度按更新时间取新并保留最大完成度，收藏支持删除 tombstone | migration 未部署前只在本机可用；不会因为登录自动上传 |
| 删除生命周期 | Existing | 删除最后一份作品副本前先撤销分享；撤销先写 `revoked_at` 再清理公开图片；云端先删私有 Storage 再删主记录，失败可重试 | 当前成品不持久化独立音频对象；生成临时资源沿用既有 TTL，因此没有额外永久音频/任务孤儿需要删除 |

隐私边界必须保持：登录不等于同意上传，本地作品、阅读记录、收藏和照片都不能因为登录自动上传。首次云端同步仍需用户明确选择。

### 3.4 家庭角色、专属生成和生成任务

| 能力 | 状态 | 当前实现 | 主要缺口 |
|---|---|---|---|
| 家庭角色库 | Existing | 登录用户可创建孩子、家人和宠物角色；照片进入私有 Storage；馆藏改编可直接选择已有角色 | 匿名用户仍只保存文字角色草稿，不上传照片 |
| 快速人物确认 | Existing | 馆藏改编和普通极简创作共用名字/身份/已有角色选择；无照片时提供明确的文字 Anchor，不假装还原真实长相 | 多角色同时担任主角仍不在第一版范围 |
| 卡通形象确认 | Existing | 新上传角色先生成卡通形象；已有角色展示私有参考图；可更换参考图、调整外观文字、返回修改和重试 | 真实 CPA 质量仍需使用已部署环境和家庭测试集持续评测 |
| 故事级 Anchor | Existing | 登录且有参考图时，在整本生成前调用私有 Anchor API 生成预览；家长确认后临时 token 随任务复用，不再重复生成；匿名无照片时确认文字 Anchor | 本轮未调用真实付费 Provider，生产可用性仍需部署环境实测 |
| Character Bible | Existing | 结构化视觉锁、页级 `castIds`、参考图按实际出场角色传入；确认的 Anchor v1 metadata 写入本地成品快照，临时 token 不长期保存 | 跨书复用确认 Anchor 和服装策略留到阶段 4 |
| 可恢复生成任务 | Existing | 文本任务 ID、本地恢复指针、服务端任务状态、worker/lease 基础 | 生产共享存储和 worker 仍需按部署环境验收 |
| 逐页插图与单页重试 | Existing | 先文本后逐页图片；失败页可手动重试，单页失败不废弃整本 | 只能重画图片；缺少“只改文字”“保留角色换场景”“锁定角色后重画”等明确操作 |
| 馆藏改编入口 | Existing | 详情页和读完状态传递 `sourceLibraryBookId`；公共 API 返回内部 `StorySpec` 的主题、8 页结构、场景、基调、适龄阶段和替换角色位置 | 批量内容运营工具留到后续 |
| 来源关联 | Existing | `StoryInput`、生成任务和安全快照保留 `sourceLibraryBookId`、草稿 ID、确认 Anchor；成品页可返回原始馆藏 | 云端旧记录需要在主动导入后才出现新关联 |
| 自动进入私人书架 | Existing | 文本任务返回后继续由现有 `localStoryRepository` 自动保存；专属成品复用统一阅读器并显示来源链接 | 云端书架仍遵循用户主动导入/同步，不因登录自动上传 |

### 3.5 分享、隐私和公共内容

| 能力 | 状态 | 当前实现 | 主要缺口 |
|---|---|---|---|
| 家庭作品默认私有 | Existing | 用户生成作品先存在本机；私有云需主动导入；不会自动进入馆藏 | 保持不变 |
| 主动创建分享 | Existing | `/api/share` 创建最小公开快照和持久化图片；创建前展示即将公开的昵称、图文和隐私风险，并要求家长确认 | migration 未部署时自动降级为旧分享格式，默认到期需待部署后生效 |
| 撤销分享 | Existing | `revoked_at` 先阻断公开读取，再清理图片和数据库行；清理失败保留行和本地 `deleteToken` 供重试 | 旧表兼容模式没有 `revoked_at`，但仍先清理图片再删除行，不丢撤销凭据 |
| 分享有效期 | Existing | 7 天、30 天默认、永久三档；过期链接读取时拒绝访问并尝试清理 | `expires_at` migration 尚未部署到 Supabase Dashboard |
| 分享管理 | Existing | `/me/books` 汇总当前浏览器分享和登录用户 owner 分享；显示创建/到期时间、打开、复制、撤销；匿名用户可复制和恢复管理码 | 旧匿名分享没有标题/创建时间时显示兼容文案 |
| 公共和私人内容区分 | Existing | 馆藏走 `/library`，用户分享走 `/s` 且 noindex；统一搜索明确分为“精选馆藏”和“我的私人绘本”，私人结果标注本机/云端来源且不会进入公共馆藏 | 阶段 6 补跨浏览器 E2E |

### 3.6 首页和信息架构

| 能力 | 状态 | 当前实现 | 主要缺口 |
|---|---|---|---|
| 绘本馆入口 | Existing | 首页首屏内容区提供同等清晰的“今晚读一本”，进入 `/library` | 保持匿名直接打开 |
| 创作入口 | Existing | 首页同区提供“给孩子做一本”，保留记录/快速/完整创作和匿名优先 | 后续阶段 3 再接馆藏改编草稿 |
| 我的书架入口 | Existing | Footer、桌面首页导航和移动底部导航进入 `/me/books`；书架显示继续阅读、收藏、最近阅读、分享管理和我创作的；馆藏搜索可在用户主动输入后检索私人作品并回到本机作品或书架 | 后续只需阶段 6 E2E/兼容性收尾 |
| 三入口主导航 | Existing | 绘本馆 / 创作 / 书架形成统一入口，未替换既有创作模式 | 阅读详情页隐藏移动导航以减少干扰 |
| 移动端底部导航 | Existing | 已实现大点击区、安全区和当前项状态；390×844 Chrome 视口实测三入口均为约 117×52px，阅读详情页隐藏固定导航 | iPhone Safari 与 Android Chrome 仍需阶段 6 真机复核 |

### 3.7 测试覆盖

| 测试层 | 状态 | 当前实现 | 主要缺口 |
|---|---|---|---|
| TypeScript | Existing | `tsconfig` 严格模式，默认使用 `npx tsc --noEmit` | 新增模块需保持无错误 |
| 单元测试 | Partial | Vitest Node 环境覆盖馆藏数据、TTS 路由、生成任务、存储、分享和隐私基础；已新增播放状态机、阅读进度和阅读器产品边界测试 | 收藏和真实组件交互测试仍待补充 |
| 集成测试 | Partial | 多个 route/repository 测试实质上覆盖服务端集成边界 | `package.json` 没有独立 `integration` 脚本 |
| 浏览器 E2E | Missing | 仓库没有 Playwright 配置和 E2E 目录 | 阶段 6 引入轻量 Playwright dev dependency，并先覆盖核心闭环 |
| 浏览器兼容 | Partial | 已完成人工桌面与约 390px 手机宽度验收，代码有触摸/键盘/reduced-motion | 没有 Chromium/WebKit/Firefox 自动回归，Safari/Android 仍需人工复核 |

## 4. P0 阅读器验收差距

| P0 场景 | 当前状态 | 当前实现 |
|---|---|---|
| 匿名用户一次点击播放 | Existing | 唯一主按钮“播放故事”，默认恢复上次语言或使用中文 |
| 播放结束自动翻页 | Existing | 已纳入状态机并提供默认开启、可关闭的开关 |
| 最后一页停止 | Existing | `ended` 结束态；不会自动进入下一本 |
| 暂停后继续 | Existing | 云端音频和系统语音路径都提供暂停/继续；系统语音继续时恢复当前语言段落高亮 |
| 手动翻页立即停止旧音频 | Existing | 页面选择先取消旧 session，可按原播放意图准备新页 |
| 刷新恢复页码 | Existing | 本地阅读进度仓库恢复页码、语言、自动翻页和可用的页内位置 |
| 网络错误后手动重试 | Existing | 云端失败先降级，最终 `error` 状态提供“播放失败，点击重试” |
| 切换语言不重叠 | Existing | 模式切换先 cancel，再更新并从当前页重播；浏览器实测只高亮新语言 |
| 手机浏览器可用 | Existing | 修复纵向滚动与横向滑动判定，主按钮 58px、次按钮至少 46px；手机宽度实测通过 |
| 不请求麦克风权限 | Existing | 主流程不调用 `getUserMedia`/`MediaRecorder`，并有源代码保护测试 |
| 馆藏和用户作品复用阅读器 | Existing | 本地用户成品通过 `LibraryBookExperience` 接入相同阅读器 |
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
  maxPageIndex: number;
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
  userId?: string;
  anonymousId?: string;
  sourceLibraryBookId: string;
  sourceTitle: string;
  selectedCharacterIds: string[];
  selectedStyle: "watercolor" | "cartoon" | "fairytale";
  storySettings: {
    prompt: string;
    ageGroup: "2-3" | "4-5" | "6-8";
  };
  anchorStatus: "pending" | "preview" | "confirmed" | "failed";
  anchor?: {
    version: 1;
    displayName: string;
    relationship: string;
    appearance: string;
    referenceType: "canonical" | "source" | "text";
    characterId?: string;
    confirmedAt: string;
  };
  generationJobId?: string;
  generatedStoryId?: string;
  createdAt: string;
  updatedAt: string;
};
```

匿名草稿先存在 `storybloom.personalizationDrafts.v1`，localStorage 不可用时退化到当前标签页内存。结构化 `StorySpec` 始终由馆藏源数据在服务端重新解析，query string 只携带 `${seriesId}/${bookId}`，客户端不能伪造馆藏正文。只有涉及私有家庭照片或故事级图片 Anchor 时才要求登录和明确授权；临时 Anchor token 不写入长期草稿或成品快照。

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
  highlight: "zh" | "en" | "zh-en" | null;
  positionMs: number;
  durationMs: number;
  message: string | null;
  error: { code: string; message: string; retryable: boolean } | null;
};
```

主要事件（代码中使用明确的过去式/请求式事件名）：

- `PLAY_REQUESTED`
- `PLAY_STARTED`
- `PAUSED`
- `RESUMED`
- `STOPPED`
- `PAGE_SELECTED`
- `LANGUAGE_CHANGED`
- `AUTO_ADVANCE_CHANGED`
- `POSITION_CHANGED`
- `FAILED`
- `RETRY_REQUESTED`
- `PAGE_ENDED`
- `BOOK_ENDED`

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

- 客户端只主动请求当前页并预取下一页；已成功页的 Promise 可在当前会话内复用，整本最多只有少量页。
- 使用已有 `client-audio-cache` 保存可复用 URL 前，必须校验 `signedUrlExpiresAt`。
- data URL 可本地缓存；临时签名 URL 过期或实际加载失败后清理内存与 IndexedDB 条目，再向服务端请求。服务端应命中自己的文本/声音 cache key，避免重复付费生成。
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

状态：**已完成实现、浏览器验收、全量测试和 production build，并作为独立阶段提交。**

- [x] 建立 reducer/状态机和命令层
- [x] 主按钮“播放故事 / 暂停 / 继续播放 / 重新播放”
- [x] 自动翻页开关、停止、重放当前页和明确重试
- [x] 本地阅读进度仓库、刷新恢复和“继续第 N 页”
- [x] 中/英/双语安全切换
- [x] 修复触摸滑动与滚动冲突
- [x] 让本地用户生成绘本通过内容适配器复用阅读器
- [x] 增加状态机、进度仓库和产品边界测试

阶段 1 不引入数据库 migration；登录用户先保持本地优先。服务端进度与合并在阶段 2 随收藏一起交付。

阶段 1 修改文件：

- `src/lib/reader/playback-machine.ts`
- `src/lib/reading-progress.ts`
- `src/lib/client-audio-cache.ts`
- `src/components/library/LibraryNarrationToolbar.tsx`
- `src/components/library/LibraryBookExperience.tsx`
- `src/components/library/LibraryBookReader.tsx`
- `src/components/book/BookPreview.tsx`
- `src/app/library/[seriesId]/[bookId]/page.tsx`
- `src/app/globals.css`
- `tests/playback-machine.test.ts`
- `tests/reading-progress.test.ts`
- `tests/library-reader-product-boundary.test.ts`

数据库变化：无。没有新增 Supabase migration、表、列或 RLS；本地新建独立 IndexedDB `storybloom-reading-state`，并提供 `storybloom.readingProgress.v1` localStorage fallback。

新增接口：没有新增 HTTP API。新增内部 `PlaybackState/PlaybackEvent`、`ReadingProgressRecord`、本地读写/合并函数和音频缓存失效函数；现有 `/api/audio` 请求契约、Provider endpoint、`DASHSCOPE_TOKEN_KEY` 和家庭声音配置均未改变。

兼容性影响：馆藏继续云端 TTS 优先；本地用户成品复用相同阅读器但保持 `preferCloudTts={false}`，继续使用浏览器语音，不改变既有付费路径。登录不会自动上传阅读记录；家庭录音、麦克风和声音克隆不进入主流程。既有逐页插图重试、分享、视频和页面管理功能保留。

阶段 1 质量结果：

- `pnpm lint`：通过，0 error；107 条既有 warning，与阶段 0 基线相同。
- `npx tsc --noEmit`：通过。
- Vitest：94 个测试文件通过、3 个跳过；613 项测试通过、5 项跳过。完整套件中的 Edge TTS 本机 WebSocket 测试需允许临时监听 `127.0.0.1`，在该环境中已通过。
- 集成测试：仓库没有独立 `integration` 脚本；完整 Vitest 已包含 route、repository、TTS server 和生成任务边界测试。
- `pnpm build`：通过；Next.js 生成 133 个静态页面，包含 100 条馆藏详情静态路径。
- 构建后已清理 `.next` 并恢复 `pnpm dev`，`http://localhost:3000` 可正常打开。

阶段 1 浏览器验收：

- 桌面端实测一键播放、暂停/继续、停止、重播、自动翻页关闭与开启、最后一页停止。
- 实测播放中切换中/英文会取消旧任务，只高亮新的语言段落。
- 实测快速连续跳页后只准备最终选择页，停止后没有遗留播放。
- 实测刷新恢复页码、语言、自动翻页，并显示“继续第 N 页”。
- 实测约 390px 手机宽度下播放控件单列、主按钮和次按钮可点击，播放与暂停正常。
- 页面明确说明不需要录音，不请求麦克风权限；保护测试禁止核心阅读器出现 `getUserMedia`、`mediaDevices` 或 `MediaRecorder`。

### 阶段 2：绘本馆、收藏和三入口信息架构

状态：**完成。代码、桌面及 390×844 手机视口、lint、TypeScript、完整测试和 production build 均已通过；阶段 3 尚未开始。**

- [x] LibraryBook metadata、resolver 与完整性测试
- [x] 继续阅读、最近播放、收藏、系列进度、今晚读什么
- [x] 首页“今晚读一本 / 给孩子做一本”双主入口
- [x] 绘本馆 / 创作 / 书架主导航和移动底部导航代码
- [x] 新增 `reading_progress`、`favorites` migration、RLS、回滚 SQL
- [x] 家长显式合并匿名进度和收藏；登录本身不自动上传
- [x] 完成 390×844 Chrome 手机视口复核
- [x] 阶段 2 独立提交

阶段 2 修改范围：

- 馆藏 metadata 与摘要：`src/types/library.ts`、`src/lib/library/metadata.ts`、`src/lib/library/catalog.ts`
- 本地/云端状态：`src/lib/favorites.ts`、`src/lib/cloud-reading-state.ts`、`src/lib/reading-sync-preference.ts`、`src/hooks/useFavorites.ts`、`src/hooks/useReadingProgressCloudSync.ts`
- 绘本馆和书架 UI：`LibraryCatalogExperience`、`LibraryCatalogCard`、`LibrarySeriesExperience`、`LibraryFavoriteButton`、`ReadingSyncControl`、`BookshelfReadingSections`
- 信息架构：`FamilyPlatformNav`、首页双入口、Footer 三入口
- 数据库：`supabase/migrations/202608160001_family_reading_state.sql` 与对应 rollback
- 测试：`tests/library-platform-state.test.ts`、`tests/family-platform-navigation.test.ts`

数据库变化：新增 `reading_progress` 和 `favorites` 两张 owner-only RLS 表。迁移为 additive；rollback 仅删除本阶段表和专用更新时间函数。迁移文件尚未在 Supabase Dashboard 部署，所以生产环境跨设备同步不得宣称已可用；本机收藏与阅读进度不受影响。

新增接口：没有新增 HTTP route。登录用户在明确点击“合并并开启同步”后，浏览器通过现有 Supabase 会话直接访问 RLS 表；收藏使用 `updated_at/deleted_at` tombstone，阅读进度沿用阶段 1 合并规则。未选择同步时不发送本机阅读记录。

兼容性影响：100 本馆藏正文和静态路由未改；馆藏首屏只渲染有限卡片，通过“显示更多”主动展开，避免无限滚动。现有本机/云端私人作品边界、匿名创作、家庭照片和声音配置不变。移动主导航在阅读详情页自动隐藏。

阶段 2 质量结果：

- `pnpm lint`：通过，0 error；107 条既有 warning，与阶段 0/1 基线相同。
- `npx tsc --noEmit`：通过。
- Vitest：96 个测试文件通过、3 个跳过；620 项测试通过、5 项跳过。
- 集成测试：仓库没有独立 `integration` 脚本；完整 Vitest 已覆盖 migration 结构、合并规则和既有 route/repository/TTS 边界。
- `pnpm build`：通过；仍生成 133 个静态页面和 100 条馆藏详情路径。
- 构建后已清理 `.next` 并恢复 `pnpm dev`。

阶段 2 桌面浏览器验收：

- 绘本馆按真实历史显示最近阅读；无继续阅读/收藏历史时对应模块不渲染。
- 收藏点击后所有重复卡片即时变为已收藏，并立即出现“我的收藏”。
- `/me/books` 同时显示“继续阅读 / 我的收藏 / 最近阅读 / 我创作的”；空分区不展示。
- 西游记系列页显示 `1 / 60 本已读完`、逐本进度、回目和收藏状态。
- 详情页展示分类、预计时长、年龄、语言和收藏入口。
- 首页首屏内容区显示“今晚读一本 / 给孩子做一本”双入口。

阶段 2 手机视口验收：

- Chrome DevTools 以 `390×844`、`devicePixelRatio=2` 复核；`documentWidth` 和 `bodyWidth` 均为 390px，无横向溢出。
- 馆藏列表稳定为两列，每张常规卡片约 173px 宽；首屏“今晚读什么”和同步提示在窄屏下不溢出。
- 固定底部导航显示“绘本馆 / 创作 / 书架”，三个入口各约 `117×52px`；详情阅读页不渲染该固定导航。
- 馆藏收藏按钮点击区统一为 `44×44px`；点击后立即切换为取消收藏，本地写入 `storybloom.favorites.v1` 并出现“我的收藏”。
- 详情页保持 390px 文档宽度，“播放故事”主按钮可见；整个流程未请求麦克风权限。
- 本轮为桌面 Chrome 手机视口验收，不替代阶段 6 的 iPhone Safari 和 Android Chrome 真机人工复核。

### 阶段 3：馆藏故事到专属版本

状态：**完成。结构化来源、角色选择、整本生成前 Anchor 确认、任务关联、本地书架保存和返回原始馆藏已经打通；阶段 4 尚未开始。**

- [x] 结构化 `LibraryStorySpec` 和本地 `PersonalizationDraft`
- [x] 详情页与读完状态“让孩子成为故事主角”
- [x] 从馆藏入口直接进入来源上下文，点击一次“选择角色”打开家庭角色确认
- [x] 已有家庭角色/新参考图/无照片文字角色三种 Anchor 路径
- [x] 登录家庭角色在整本生成前通过私有 API 生成故事级 Anchor 预览；支持重试
- [x] Anchor 确认检查发型、年龄感、眼镜等显著特征、服装和鞋子
- [x] 生成任务保存 `sourceLibraryBookId`、草稿 ID 和 Anchor v1 metadata
- [x] 确认的临时 story Anchor token 由生成任务复用，公开响应、本地草稿和长期快照均不保存 token
- [x] 生成结果继续自动进入本机私人书架，专属成品可返回原始馆藏

阶段 3 修改范围：

- StorySpec 与草稿：`src/lib/library/personalization.ts`、`src/lib/personalization-drafts.ts`、`src/types/index.ts`
- 公共来源接口：`GET /api/library/personalization?book=${seriesId}/${bookId}`
- 私有 Anchor 接口：`POST /api/library/personalization/anchor`
- 创作闭环：馆藏详情、`LibraryBookExperience`、`MinimalStoryEntry`、`BookPreview`、首页入口收敛
- 生成与持久化：`/api/generate`、`story-generator`、`text-generation-executor`、generation job payload 和 story snapshot
- 测试：StorySpec、草稿恢复、私有 Anchor 边界、生成 prompt、任务 payload、快照、导航与 token 隐私

数据库变化：无。本阶段不新增 Supabase migration。家庭角色继续复用 `family_characters` 和私有 `family-photos`；`PersonalizationDraft` 默认本地保存。跨设备草稿同步不在本阶段实现。

新增接口：

- `GET /api/library/personalization` 只返回公开馆藏的结构化 StorySpec，可短时公共缓存。
- `POST /api/library/personalization/anchor` 必须登录，校验家庭角色 owner 和私有路径，返回 `private, no-store` 的 Anchor 图片与短期 token；匿名请求实测返回 401。

兼容性影响：原有极简创作、成长记录、完整创作和生成任务字段全部保持可选；没有来源 ID 的旧作品继续正常打开。普通创作仍沿用原角色确认逻辑。登录不会自动上传匿名草稿；没有照片的匿名用户可以使用文字 Anchor，且界面明确不承诺还原真实长相。Provider endpoint 和 `DASHSCOPE_TOKEN_KEY` 均未改动。

阶段 3 质量结果：

- `pnpm lint`：通过，0 error；107 条既有 warning，与阶段 2 基线相同。
- `npx tsc --noEmit`：通过。
- Vitest：99 个测试文件通过、3 个跳过；630 项测试通过、5 项跳过。
- 集成测试：仓库没有独立 `integration` 脚本；完整 Vitest 覆盖来源解析、任务 payload、Anchor token 复用/剥离、快照和既有生成边界。
- production build：通过；生成 135 个静态页面和 100 条馆藏详情路径。

阶段 3 浏览器验收：

- 桌面：从《石猴出世》详情点击“让孩子成为故事主角”，URL 只携带来源 ID；创作页自动展示来源、8 页结构继承提示和预填故事方向。
- 匿名：填写名字与外观后进入文字 Anchor；可返回调整，只有点击“确认并生成专属版”才会提交整本生成。本轮未点击该按钮，未消耗真实生成额度。
- 私有接口：未登录调用 Anchor API 返回 `401 {"error":"请先登录。"}`；真实家庭照片和付费 CPA Anchor 未在本轮调用。
- 390×844 Chrome：文档宽度 390px、无横向溢出；来源卡片 358px 宽，“选择角色”50×50px；Anchor 底部弹层 390px 宽，主按钮 352×44px。
- 核心流程没有录音入口，也未请求麦克风权限。

### 阶段 4：私人书架、继续创作、分享与删除生命周期

状态：**完成。私人书架、分享隐私预览、账户/匿名管理、同角色续作和可重试删除生命周期已交付；阶段 5 也已完成。**

- [x] 我创作的 / 我的收藏 / 最近阅读 / 继续阅读统一在 `/me/books`
- [x] 本机和云端副本分别改标题，避免登录后隐式覆盖另一端
- [x] 单副本和全部删除均有明确确认
- [x] 书架卡片显示创建时间、最近阅读、阅读进度、家庭角色系列和主动分享状态
- [x] 成品页“沿用角色创作下一本”，继承角色 ID、确认外观和画风
- [x] 新冒险明确不自动继承旧服装与场景
- [x] 创建分享前展示即将公开的昵称、图片、文字和家庭信息风险
- [x] 分享有效期支持 7 天、30 天默认和永久
- [x] 登录用户服务端分享列表；匿名用户本地凭据和可携带管理码
- [x] 撤销失败保留 `deleteToken`；公开链接先失效再清理图片
- [x] 删除最后一份作品副本前撤销关联分享
- [x] 云端删除先清理私有 Storage，再删除数据库行，失败可安全重试
- [x] 旧 `shared_stories` schema 兼容，允许代码和 migration 分步部署

阶段 4 修改范围：

- 书架 UI：`BookshelfShareManager`、`DeviceCloudStoryLibrary`、`LocalStoryLibrary`、`/me/books`、对应 CSS
- 成品和续作：`BookPreview`、`MinimalStoryEntry`、`story-continuation-drafts.ts`
- 分享：`ShareLinkPanel`、`client-share-management.ts`、`/api/share`、`share-store.ts`
- 存储：本地/云端 Story Repository、`client-history.ts`、Story Repository patch 类型
- 数据库：`supabase/migrations/202608160002_private_bookshelf_sharing.sql` 与对应 rollback
- 回归修复：普通私人绘本只在存在对应成长记录时同步，消除 `growth-record-not-found` 未处理错误
- 测试：分享到期/兼容/撤销顺序、匿名管理码、撤销失败凭据保留、同角色续作

数据库变化：`shared_stories` 增加可空 `client_story_id`、`expires_at`、`revoked_at`，并增加 owner/story 与到期索引。迁移为 additive，旧行的 `expires_at = null` 继续视为永久；rollback 仅删除本阶段约束、索引和三列。迁移尚未在 Supabase Dashboard 部署，因此生产环境的 30 天默认到期和服务端作品关联仍不可宣称已生效。代码已实现缺列回退：迁移部署前旧分享仍可创建、读取和撤销。

新增/调整接口：

- `GET /api/share`：登录用户列出自己的有效分享摘要，不返回故事正文或撤销 token。
- `POST /api/share`：新增 `clientStoryId` 和 `expiry`，默认 `30d`；响应新增实际 `expiresAt`。
- `DELETE /api/share`：支持 delete token、登录 owner 或登录用户按 `clientStoryId` 批量撤销；公开资源清理未完成时返回可重试状态。

兼容性影响：登录仍不会自动上传本地作品或续作草稿；改标题只修改用户主动选择的本机或云端副本。匿名管理码等同撤销凭据，只在家长主动复制时离开浏览器。确认 Anchor 的临时 `storyReferenceToken` 不写入续作草稿；只继承可长期保存的角色 ID、外观确认和画风。当前私人绘本不持久化独立音频文件，生成临时资产继续由既有 TTL 管理，因此删除生命周期没有新增音频或生成任务表操作。Provider endpoint、`DASHSCOPE_TOKEN_KEY`、录音和声音克隆路径均未改变。

阶段 4 质量结果：

- `pnpm lint`：通过，0 error；107 条既有 warning，与阶段 3 基线相同。
- `npx tsc --noEmit`：通过。
- Vitest：101 个测试文件通过、3 个跳过；638 项测试通过、5 项跳过。
- 集成测试：仓库没有独立 `integration` 脚本；完整 Vitest 已覆盖分享 Storage/数据库顺序、旧 schema 回退、匿名撤销恢复和既有 route/repository/TTS 边界。
- `pnpm build`：通过；生成 135 个静态页面和 100 条馆藏详情路径。
- 构建后已清理 `.next` 并恢复 `pnpm dev`；开发服务 Ready。

阶段 4 浏览器验收：

- 登录书架显示本机/云端副本边界、改标题、删除和分享状态；旧分享在 migration 未部署时仍可列出，不再显示服务端读取错误。
- 390×844 Chrome：文档宽度和 viewport 均为 390px，无横向溢出；书架和分享管理主要按钮高度均为 44px。
- 成品页显示“沿用角色创作下一本”；点击后恢复家庭角色、确认外观和原画风，预填全新冒险说明，并明确旧服装/场景不会带入。
- 创建家庭分享只打开隐私预览；默认选择 30 天，未勾选风险确认时“确认并创建分享”不可用。本轮未实际创建或撤销线上分享。
- 普通私人绘本重新打开后没有新增控制台错误；核心阅读和续作流程未请求麦克风权限。

### 阶段 5：搜索、分类、今晚读什么和睡前模式

状态：**完成。搜索与组合筛选、公共/私人分组、可解释今晚推荐、详情页规则推荐和统一阅读器睡前模式均已交付；阶段 6 尚未开始。**

- [x] 标题、系列、主题、成语和科普关键词搜索；搜索 corpus 由可维护 metadata 构建，不把整本正文塞进首页
- [x] 公共馆藏与私人绘本明确分组；私人作品只在用户主动输入搜索词后读取并在浏览器内匹配
- [x] 年龄、时长、语言、系列、分类、主题和“仅看适合睡前”组合筛选
- [x] 家长主动选择的今晚阅读年龄本地保存；精选/睡前/年龄匹配逐级放宽并按日期稳定轮换
- [x] 详情页同系列、同主题、同年龄和相近时长规则推荐；同系列下一本优先但不自动播放
- [x] 馆藏和私人作品共用的低刺激睡前模式；进入时切回翻页阅读并开启自动翻页，最后一页结束后停止
- [x] 搜索词、儿童姓名和私人故事正文不写入埋点；不建立儿童兴趣、能力或情绪画像

阶段 5 修改范围：

- 发现规则与搜索字段：`src/lib/library/discovery.ts`、`src/lib/library/catalog.ts`
- 馆藏首页：`LibraryCatalogExperience`，新增搜索、组合筛选、私人结果、年龄偏好和新版今晚推荐
- 详情页推荐：`LibraryRelatedBooks` 与馆藏详情页接入
- 阅读器：`LibraryBookExperience` 增加睡前模式，继续复用现有状态机、朗读工具栏和最后一页停止逻辑
- 样式：`src/app/globals.css` 增加发现面板、私人结果、推荐卡片和低刺激全屏阅读样式
- 测试：`tests/library-discovery.test.ts` 和 `tests/library-reader-product-boundary.test.ts`

数据库变化：无。没有新增 Supabase migration、表、列、RLS 或 Storage bucket。今晚阅读年龄只保存在当前浏览器的 `storybloom.library.tonight-age.v1`；私人搜索复用现有本地 Story Repository 和登录用户已有的私有 `saved_stories`，不会因为登录或搜索自动上传本机作品。

新增接口：没有新增 HTTP route。新增内部 `LibraryDiscoveryFilters`、搜索文本标准化、馆藏组合筛选、今晚推荐、私人作品本地匹配和规则推荐函数。云端私人作品继续通过现有 Supabase owner-only RLS 读取；搜索词不会发送给 Supabase、分析服务或生成 Provider。

兼容性影响：100 本馆藏正文、现有路由、音频 Provider 顺序、`/api/audio`、`DASHSCOPE_TOKEN_KEY`、家庭声音和生成器均未改变。私人搜索只在存在非空查询时读取书架；本机作品可直接打开，只有云端副本的作品引导家长前往书架主动保存到本机后打开。睡前模式不会创建第二套播放器，也不会请求麦克风权限；退出后恢复页面滚动，播放设置和进度继续由统一阅读器保存。规则推荐只展示链接，不自动进入或播放下一本。

阶段 5 质量结果：

- `pnpm lint`：通过，0 error；107 条既有 warning，与阶段 4 基线相同。
- `npx tsc --noEmit`：通过。
- Vitest：102 个测试文件通过、3 个跳过；644 项测试通过、5 项跳过。沙箱内 Edge TTS 本机 WebSocket 测试因无法监听 `127.0.0.1` 返回 `EPERM`，在允许本地回环端口的同一完整命令中已通过。
- 集成测试：仓库没有独立 `integration` 脚本；完整 Vitest 已覆盖搜索/筛选纯逻辑、规则推荐、阅读器产品边界，以及既有 route、repository、TTS server、分享和生成任务边界。
- `pnpm build`：通过；生成 135 个静态页面和 100 条馆藏详情路径。
- 构建前已停止开发服务；构建后清理 `.next` 并恢复 `pnpm dev`，`http://localhost:3000` Ready。

阶段 5 浏览器验收：

- 桌面搜索“天空 为什么”只显示匹配的精选科普绘本，同时渲染独立的“我的私人绘本”分组；搜索时隐藏系列等常规首页模块，清空后恢复。
- 科普分类与“仅看适合睡前”组合可得到明确空结果；点击“重置筛选”恢复全部 100 本馆藏。
- 详情页规则推荐将《拜师学艺》标为“同系列下一本”，后续同系列内容按临近回目排序；没有自动导航或自动播放。
- 睡前模式固定全屏、锁定背景滚动、隐藏阅读方式和语言设置等次要控件，保留 58px 播放主按钮、44px 退出按钮和清晰的上一页/下一页；退出后恢复页面滚动。
- 390×844 Chrome：馆藏和详情页的 `viewport/clientWidth/documentWidth` 均为 390px，无横向溢出；筛选为两列，搜索框高 52px，收藏/睡前/退出按钮均至少 44px。
- 桌面和移动验收均无新增控制台错误；未请求麦克风权限，也未触发真实付费 TTS、生成或分享操作。

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
- 本地用户成品使用统一阅读器；精选/定制案例继续保留现有浏览器朗读，避免一次性改动所有预览变体。
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
