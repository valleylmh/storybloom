# StoryBloom — 会说话的家庭故事书创作工具

> **让每个家庭都有一本会说话的专属故事书。**
>
> 输入名字、家庭片段或故事主题，生成完整 8 页中英双语绘本，并支持朗读、保存、分享与视频输出。

<p align="center">
  <a href="https://storybloom.valleylmh.vip"><strong>在线体验</strong></a>
  ·
  <a href="https://storybloom.valleylmh.vip/library"><strong>浏览绘本馆</strong></a>
  ·
  <a href="docs/assets/readme/story-video-demo.mp4"><strong>观看视频示例</strong></a>
  ·
  <a href="ROADMAP.md"><strong>查看路线图</strong></a>
</p>

## 产品愿景

StoryBloom 正从“一句话生成一本绘本”，逐步走向一个由孩子、家长与 AI 共同创造的长期故事世界。现在，它把孩子的兴趣、家人和日常想象变成可阅读、可朗读、可分享的专属绘本；未来，每一本故事可以在家长的选择和确认下，延续熟悉的角色、地点和共同阅读的记忆。

这里的“陪伴”不是让 AI 替代家长，也不是用模型给孩子打分。AI 是家长的创作助手；未来的成长档案只记录作品、阅读、兴趣和家长主动填写的事实，不对孩子作心理、情绪、性格或能力诊断。详细阶段与产品边界见 [ROADMAP.md](ROADMAP.md)。

## 效果展示

### 完整 8 页中英双语绘本

StoryBloom 会从一个主题生成连续故事、统一风格插图、中英双语正文和故事寓意。点击下面的图片可以进入正式阅读页。

<p align="center">
  <a href="https://storybloom.valleylmh.vip/library/xiyouji/shi-hou-chu-shi">
    <img src="docs/assets/readme/storybook-xiyouji.jpg" alt="《石猴出世》8 页中英双语绘本" width="100%" />
  </a>
  <br />
  <strong>《石猴出世》· 西游记儿童绘本</strong>
</p>

<table>
  <tr>
    <td width="50%" align="center">
      <a href="https://storybloom.valleylmh.vip/library/haoqi/tian-kong-wei-shen-me-shi-lan-se">
        <img src="docs/assets/readme/storybook-science.jpg" alt="《天空为什么是蓝色的？》儿童科普绘本" />
      </a>
      <br />
      <strong>《天空为什么是蓝色的？》· 儿童科普</strong>
    </td>
    <td width="50%" align="center">
      <a href="https://storybloom.valleylmh.vip/library/chengyu/shou-zhu-dai-tu">
        <img src="docs/assets/readme/storybook-idiom.jpg" alt="《守株待兔》成语绘本" />
      </a>
      <br />
      <strong>《守株待兔》· 成语故事</strong>
    </td>
  </tr>
</table>

### 绘本视频

在支持 WebCodecs 的浏览器中，StoryBloom 可以将 8 页插图、字幕和可选旁白在本地合成为 720 × 1280 竖屏视频，支持中文、English、双语和无旁白四种模式。

下面的 GIF 是使用仓库公开 AI 插图制作的 README 轻量动效预览；产品内生成的视频还会包含逐页字幕和可选旁白。点击预览可打开完整 MP4。

<p align="center">
  <a href="docs/assets/readme/story-video-demo.mp4">
    <img src="docs/assets/readme/story-video-preview.gif" alt="StoryBloom 绘本视频动态预览" width="320" />
  </a>
</p>

<p align="center">
  <a href="docs/assets/readme/story-video-demo.mp4">观看完整 MP4</a>
  ·
  <a href="https://storybloom.valleylmh.vip/library/xiyouji/shi-hou-chu-shi">在线生成绘本视频</a>
</p>

## 当前能力

- 从一句话生成完整 8 页中英双语故事，并按年龄段控制句式、冲突和情绪节奏。
- 使用角色描述、Character Bible、逐页出场角色和参考图约束跨页一致性。
- 异步逐页生成插图，支持多 Provider 配置、限流、自动回退、失败页重试和本地演示兜底。
- 支持网页阅读、中文／英文／双语系统朗读、PNG 长图、图片 ZIP 和公开阅读链接。
- 在浏览器本地生成带字幕和可选旁白的竖屏绘本视频。
- 提供家庭角色库、最近作品、公开绘本馆和每日绘本灵感。

## 工程亮点

- **故事结构不是自由续写**：生成器使用年龄规则、固定 8 页 story beat 和镜头规划，要求每页推进情节并对应具体可视动作。
- **角色一致性贯穿文本与图片**：家庭角色先生成统一绘本形象；每页只传入实际出场人物的私有参考图，并锁定脸型、发型、年龄、服装主色和视觉风格。
- **图片生成与文本生成解耦**：`/api/generate` 先返回故事和待生成页面；前端再逐页启动 `/api/illustration`，轮询页面结果，单页失败不会丢失整本书。
- **按需使用音频成本**：普通网页朗读使用浏览器 `SpeechSynthesis`；只有需要真实音频文件的带旁白视频才按 2.5 → 3.1 的顺序调用 Gemini TTS，失败时回退 Edge TTS。
- **隐私默认收敛**：上传照片先在浏览器重编码并移除 EXIF；家庭照片进入私有 Storage；公开分享只保留阅读所需字段并提供删除令牌。
- **无 Key 也能本地体验**：文本、本地图像占位和浏览器朗读都有安全兜底，部署者可以按需接入自己的模型与基础设施。

## 开源说明

StoryBloom 以 MIT 许可证开放应用代码。仓库只保留公开的 AI 生成样例，不应提交真实儿童照片、客户绘本、私聊二维码或生产密钥。部署者需要使用自己的域名、API 端点、Supabase、Resend 和图片服务凭据。

线上演示站的免费额度是当前托管服务策略，不代表第三方模型、存储、邮件或带宽永久免费；自托管者需要自行承担所启用服务的费用。

本项目依赖 Remotion；其许可不包含在 StoryBloom 的 MIT 许可证中。启用视频功能前，请阅读 [Remotion License](https://www.remotion.dev/docs/license) 并确认当前用途符合条款；不需要视频时可设置 `NEXT_PUBLIC_STORY_VIDEO_ENABLED=0`。

安全问题请按 [SECURITY.md](SECURITY.md) 私下报告，参与开发请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。公开仓库不应包含真实儿童照片、客户绘本、联系人二维码、生产密钥或本地生成缓存。

## 模型调用说明

当前代码主要有三类生成模型调用：

- 文本模型：`src/lib/story-generator.ts`。通过部署者配置的 OpenAI 兼容端点调用文本模型；读取 `CPA_BASE_URL`、`CPA_API_KEY` 和 `STORY_TEXT_MODEL`。未配置或服务不可用时使用与用户主题一致的本地兜底故事。
- 图片模型：`src/lib/image-generator.ts`。普通角色按 `IMAGE_PROVIDER_ORDER` 使用 AGNES、DashScope、Cloudflare、Pollinations 或 Hugging Face；极简模式中确认并保存的照片角色会先由 CPA Nano Banana 2（默认上游模型 `gemini-3.1-flash-image`）生成统一设定稿，随后所有实际出现该角色的页面都固定使用 CPA，不回退到其他提供商。临时自定义参考图仍按 `IMAGE_TO_IMAGE_PROVIDER_ORDER` 工作。图片请求按 provider 做限流等待，未配置且允许 demo 时使用本地 SVG 演示图。
- 音频：绘本网页朗读使用浏览器内置 `SpeechSynthesis`，不会调用云端 TTS，也不会在故事生成后自动准备音频。`src/app/api/audio/route.ts` 保留给需要真实音频文件的带旁白视频；配置 `DASHSCOPE_TOKEN_KEY` 时优先使用 Token Plan 百炼 TTS，再依次回退 Gemini 2.5、Gemini 3.1 和 Edge TTS，结果优先写入 Supabase 私有 Storage。

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 15 App Router + TypeScript |
| 故事生成 | 部署者配置的 OpenAI 兼容端点，未配置或失败时使用本地 fallback |
| 插图生成 | AGNES、DashScope、Cloudflare、Pollinations、Hugging Face；家庭照片角色固定使用 CPA Nano Banana |
| 网页朗读 | 浏览器本机 SpeechSynthesis |
| 视频旁白音频 | Token Plan 百炼 TTS → Gemini 2.5 → Gemini 3.1 → Edge TTS |
| 导出与分享 | Browser Canvas 长图、图片 ZIP、Supabase 分享快照 |
| 绘本视频 | Remotion Web Renderer + WebCodecs，浏览器本地输出 MP4 |
| 邮件订阅 | Resend + Supabase，双重确认与一键退订 |
| 限流 | Upstash Redis，可本地内存 fallback |

## 项目结构

```text
storybloom/
├── src/
│   ├── app/
│   │   ├── page.tsx                         # 首页：极简/完整表单、最近作品、生成入口
│   │   ├── family/page.tsx                  # 家庭角色库
│   │   ├── library/                         # 静态绘本馆、系列页与阅读页
│   │   ├── s/[shareId]/page.tsx             # 用户绘本公开阅读页
│   │   └── api/
│   │       ├── generate/route.ts            # 文本生成、配额与故事缓存
│   │       ├── illustration/route.ts        # 逐页插图任务与轮询
│   │       ├── audio/route.ts               # 视频旁白 MP3
│   │       ├── share/route.ts               # 分享快照创建/删除
│   │       └── character-recognition/route.ts
│   ├── components/
│   │   ├── book/                            # 表单、生成预览、朗读与分享
│   │   ├── family/FamilyLibrary.tsx
│   │   ├── library/                         # 馆藏阅读器与工具
│   │   └── video/                           # 视频配置与 Remotion Composition
│   ├── lib/
│   │   ├── story-generator.ts               # 年龄规则、8 页结构与 Character Bible
│   │   ├── image-generator.ts               # 多 Provider 插图与参考图生成
│   │   ├── storage.ts                       # 故事缓存、临时参考图与生成配额
│   │   ├── client-history.ts                # 浏览器最近作品
│   │   ├── narration-audio-server.ts        # Gemini/Edge TTS 路由与私有音频缓存
│   │   ├── render-story-video.tsx           # 浏览器视频渲染与编码回退
│   │   ├── share-store.ts                   # 分享图片与快照持久化
│   │   └── library/                         # 馆藏系列与书籍数据
│   └── types/index.ts
├── public/library/                           # 已审核馆藏插图
├── public/sample-books/                      # 首页公开样例与静态音频
├── supabase/migrations/                      # 家庭角色、分享、音频与订阅数据层
├── tests/
├── ROADMAP.md
├── .env.example
└── package.json
```

## 快速启动

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

访问 `http://localhost:3000`。

本地不配置 API key 也能跑通基础流程：文本会使用与主题相关的本地 fallback，插图会先展示 demo SVG，网页朗读使用当前设备的系统语音；带旁白视频在没有任何 TTS key 时会按需使用无需 key 的 Edge TTS。要看真实文本或图片，需要配置相应 provider key；`DASHSCOPE_API_KEY` 仍只用于选择 DashScope 作为图片服务商，语音使用独立的 `DASHSCOPE_TOKEN_KEY`。

## 绘本朗读音频

新生成的绘本不会自动请求云端 TTS。用户点击中文、英文或双语朗读时，前端按页面调用当前浏览器/操作系统提供的语音；音色取决于用户设备，不能导出为 MP3。精选绘本的中文朗读继续使用仓库中已生成的静态 MP3。

带旁白视频需要可解码的真实音频文件，因此仍会逐页调用 `/api/audio`；选择“无旁白”不会调用 TTS。接口只允许已配置的模型与音色，并按客户端 IP 限制请求频率。

配置 `DASHSCOPE_TOKEN_KEY` 时，视频旁白首先使用 Token Plan 的 `qwen-audio-3.0-tts-plus`：中文默认音色 `longanlingxin`，英文默认音色 `longanlufeng`，输出为 24 kHz MP3。未配置、空字符串或设置 `TOKEN_PLAN_TTS_ENABLED=0` 时会完全跳过；请求失败时也不会阻断视频，而是进入原有 Gemini/Edge 回退链。可通过 `TOKEN_PLAN_TTS_VOICE_ZH`、`TOKEN_PLAN_TTS_VOICE_EN` 和 `TOKEN_PLAN_TTS_TIMEOUT_MS` 调整行为。服务端只接受可信的北京 OSS 音频地址，下载并验证 MP3 后再写入私有缓存，不会向前端暴露临时签名 URL。

配置 `GEMINI_API_KEY` 时，后续回退默认先使用价格更低的 `gemini-2.5-flash-preview-tts`，失败后尝试 `gemini-3.1-flash-tts-preview`：中文默认音色 `Leda`，英文默认音色 `Aoede`，Google 返回的 24 kHz、16-bit 单声道 PCM 会在服务端封装为 WAV。`GEMINI_API_KEY` 支持用英文逗号配置多个 key，例如 `key-1,key-2,key-3`；系统会去掉空格和重复项，并在每个 Gemini 模型内从左到右依次尝试全部 key。两个 Gemini 模型的全部 key 均失败时，系统自动回退到 `edge-tts`（中文 `zh-CN-XiaoxiaoNeural`、英文 `en-US-AnaNeural`、24 kHz MP3）。

首次启用持久化音频缓存时，在 Supabase 执行：

```text
supabase/migrations/202607190001_story_audio.sql
```

迁移会创建私有 `story-audio` bucket。迁移尚未执行或 Storage 临时不可用时，接口会自动回退为内联音频，不阻断视频旁白生成。

首页 3 本精选绘本使用一次生成、长期复用的静态中文 MP3。生成命令会读取现有静态正文，已有文件默认跳过：

```bash
npm run audio:generate-featured
# 需要重新生成时：
npm run audio:generate-featured -- --force
```

该命令会使用 Edge TTS 生成 3 本精选绘本的中文 MP3，并写入 `public/sample-books/audio`。可以先加 `--dry-run` 检查将要处理的书目，不写文件也不请求音频服务。

## 绘本分享链接
用户生成的绘本可以生成公开阅读链接（`/s/<shareId>`）。首次启用前，在 Supabase 执行：

```text
supabase/migrations/202607210001_shared_stories.sql
```

迁移会创建 `shared_stories` 表（RLS 开启且无策略，仅服务端 service-role 读写）与公开的 `story-shares` Storage bucket（分享页插图）。分享页 `noindex`，只渲染书名、孩子名字与正文，不包含表单里的其他个性化信息；创建时返回一次性 `deleteToken`，保存在浏览器本地，用于删除分享。

## 邮件订阅
1. 在 Supabase 依次执行：

```text
supabase/migrations/202607120001_newsletter_subscriptions.sql
supabase/migrations/202607130001_daily_story_inspirations.sql
```
2. 在 Resend 验证发件域名，创建 Topic，并配置 `.env.local`：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
RESEND_FROM_EMAIL=StoryBloom <hello@your-domain.com>
RESEND_TOPIC_ID=...
RESEND_WEBHOOK_SECRET=...
NEWSLETTER_ACTION_SECRET=...
CRON_SECRET=...
```

3. 将 Resend Webhook 指向 `/api/webhooks/resend`，订阅 bounce 和 complaint 事件。

订阅流程采用 double opt-in；Supabase 是订阅状态来源，Resend Contacts + Topic 仅作为发送与偏好镜像。

### 每日绘本灵感

部署在 Vercel 时，平台会根据 `vercel.json` 在每天 UTC 00:00（北京时间 08:00）请求
`/api/cron/daily-inspiration`。系统通过部署者配置的 OpenAI 兼容端点
调用文本模型，每天生成一份新的
中英双语灵感；密钥、模型或服务不可用时会自动使用内置精选灵感。当天内容只生成一次并写入
`daily_story_inspirations`，投递结果写入 `newsletter_deliveries`，重复触发不会重复发送。

首次部署前生成两个不同的随机密钥：

```bash
openssl rand -base64 32
openssl rand -base64 32
```

分别配置为 `NEWSLETTER_ACTION_SECRET` 和 `CRON_SECRET`。不要随意更换
`NEWSLETTER_ACTION_SECRET`，否则已发送邮件中的签名退订链接会失效。还可按需配置：

```bash
CPA_API_KEY=...
CPA_BASE_URL=https://your-provider.example/v1
CPA_TEXT_MODEL=gemini-3-flash
CPA_TEXT_TIMEOUT_MS=30000
NEWSLETTER_SEND_CONCURRENCY=5
```

Vercel Cron 在配置了 `CRON_SECRET` 后会自动携带 Bearer Authorization。需要手动验证时，
可以执行下面的请求；它会向当天尚未投递的全部已确认订阅者发送邮件：

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://你的正式域名/api/cron/daily-inspiration
```

如果部署到 Cloudflare，可使用 Cron Trigger 按相同时间请求这个地址，并携带
`Authorization: Bearer YOUR_CRON_SECRET` 或 `x-cron-secret` 请求头。

## 家庭角色库

已登录用户可在 `/family` 建立可复用的家庭角色。参考照片保存在 Supabase 私有 Storage，CPA Nano Banana 会先将照片转换为统一绘本形象；之后在首页极简模式选择角色，即可用一句话生成家庭专属绘本。极简入口也会在人物无法唯一匹配时请求确认姓名，并允许登录后保存供下次复用。照片不会发送给 Resend。

1. 在同一个 Supabase 项目继续执行 `supabase/migrations/202607120002_family_profiles.sql`。
2. 从 Supabase Project Settings → API 获取公开的 anon key（新项目也可能显示为 publishable key），配置其中一个：

```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# 或 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

3. 在 Supabase Authentication → URL Configuration 配置：

```text
Site URL: https://你的正式域名
Redirect URLs:
http://localhost:3000/family
https://你的正式域名/family
http://localhost:3000/auth/callback
https://你的正式域名/auth/callback
```

Vercel 的 `NEXT_PUBLIC_APP_URL` 也必须设置为正式域名（不要保留 `http://localhost:3000`）。如果线上 Magic Link 的 `redirect_to` 仍然是 localhost，说明 Supabase 没有匹配到允许的线上 Redirect URL，并回退到了 Site URL；保存 URL Configuration 后需要重新发送一封登录邮件，旧邮件中的地址不会更新。

新的 Magic Link 会先回到 `/auth/callback` 恢复登录会话，再通过只允许本站相对路径的 `next` 参数返回发起登录的页面；直接回到 `/family` 的地址仅为旧链接兼容保留。本地开发时也需要允许 `http://localhost:3000/auth/callback`。儿童照片建议使用清晰、单人正面照；上传前必须明确勾选本人或监护人授权，浏览器随后会缩放、转成 WebP 并移除 EXIF，服务端与 Storage 仍按私密儿童资料处理。

定制入口默认展示“链接即将上线”。拿到平台链接后，在 `.env.local` 中配置：

```bash
NEXT_PUBLIC_XIAOHONGSHU_ORDER_URL=https://...
NEXT_PUBLIC_XIANYU_ORDER_URL=https://...
```

## 核心生成流程

```text
用户提交表单
     │
     ▼
POST /api/generate
     │
     ├─ 校验参数、Turnstile 与每日免费额度
     ├─ 文本模型或本地 fallback → 生成 8 页故事 JSON
     ├─ 写入故事缓存，页面先返回 demo / pending 状态
     └─ 返回 storyId、正文与待生成页面
          │
          ▼
BookPreview 逐页启动插图（最多 4 个并发）
          │
          ├─ POST /api/illustration → 202 Accepted
          │        └─ Next.js after() 后台调用图片 Provider
          └─ GET /api/illustration → 轮询单页状态并更新最近作品
                   │
                   ▼
             完整阅读与导出
                   ├─ 浏览器 SpeechSynthesis → 网页朗读
                   ├─ Canvas / ZIP → 分享长图与逐页图片
                   ├─ POST /api/share → Supabase 公开阅读快照
                   └─ POST /api/audio + Remotion Web Renderer
                        → 带旁白或无旁白的竖屏视频
```

## 绘本视频

绘本视频功能在用户自己的绘本插图全部完成后启用，也可用于绘本馆中图片齐全的静态书籍。渲染代码在点击按钮后才会加载，不会改变现有故事生成、朗读或 PNG 分享流程。

- 默认输出 720 × 1280、24 FPS 的 H.264 MP4；浏览器不支持 MP4 编码时会尝试 WebM。
- 中文、英文和双语模式会逐页调用现有 `/api/audio`，无旁白模式不会调用 TTS。
- 推荐使用最新版 Chrome。是否可输出 MP4 取决于浏览器、系统和实际可用编码器；渲染器会按 H.264 硬件、H.264 软件、VP8/WebM 的顺序回退。
- 可用 `NEXT_PUBLIC_STORY_VIDEO_ENABLED=0` 随时关闭入口，不影响其他功能。
- Remotion 有独立许可条款和使用要求；正式启用前请核对官方文档，并按适用范围配置 `NEXT_PUBLIC_REMOTION_LICENSE_KEY`。
- 绘本馆书籍使用稳定 canonical URL；用户生成绘本可通过 `/api/share` 创建持久公开阅读链接，并使用本地保存的一次性 `deleteToken` 删除。

当前 Remotion 及全部 `@remotion/*` 依赖使用完全一致的固定版本。升级时应整组升级，并重新验证目标浏览器的实际编码能力。

## 下一阶段

- **近期**：自助 PDF / 家庭打印版、亲子共读小问题、结构化 Character Bible 和独立安全检查。
- **中期**：阅读进度、收藏与家长可控的成长档案；只记录客观事实和家长确认的信息。
- **长期**：让熟悉的角色、地点和故事线跨多本绘本延续，并支持安全、有限的共同创作选择。

完整路线、验收边界和儿童隐私原则见 [ROADMAP.md](ROADMAP.md) 与 [docs/feature-roadmap-tasks.md](docs/feature-roadmap-tasks.md)。
