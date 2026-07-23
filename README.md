# StoryBloom — AI 儿童绘本生成器

> 输入一句话，免费生成完整 8 页中英双语绘本，并可订阅每日绘本灵感。

## 开源说明

StoryBloom 以 MIT 许可证开放应用代码。仓库只保留公开的 AI 生成样例，不应提交真实儿童照片、客户绘本、私聊二维码或生产密钥。部署者需要使用自己的域名、API 端点、Supabase、Resend 和图片服务凭据。

本项目依赖 Remotion。Remotion 不是 MIT 许可，个人与符合条件的小团队通常可以免费使用，其他组织可能需要商业许可证。启用视频功能前，请阅读 [Remotion License](https://www.remotion.dev/docs/license) 并确认你的使用资格；不需要视频时可设置 `NEXT_PUBLIC_STORY_VIDEO_ENABLED=0`。

安全问题请按 [SECURITY.md](SECURITY.md) 私下报告，参与开发请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。从现有私有仓库发布到 GitHub 的清理、检查和新仓库流程见 [docs/open-source-release.md](docs/open-source-release.md)。

## 当前产品方向

当前产品先以免费使用和邮件订阅增长为主：

- 首页保持极简：一句话即可开始生成，不要求先完成复杂表单。
- 生成完整故事和插图，而不是只给前两页预览。
- 直接在网页中阅读和生成朗读音频：中文、英文、中英文三种模式。
- 将当前绘本合成为一张 PNG 长图，方便分享给家人。
- 将完成的绘本在浏览器中合成为竖屏 MP4 视频，不依赖额外渲染服务器。
- 使用 Resend + Supabase 提供双重确认的邮件订阅，后续可发送每日绘本灵感。

## 模型调用说明

当前代码主要有三类生成模型调用：

- 文本模型：`src/lib/story-generator.ts`。通过部署者配置的 OpenAI 兼容端点调用文本模型；读取 `CPA_BASE_URL`、`CPA_API_KEY` 和 `STORY_TEXT_MODEL`。未配置或服务不可用时使用与用户主题一致的本地兜底故事。
- 图片模型：`src/lib/image-generator.ts`。普通角色按 `IMAGE_PROVIDER_ORDER` 使用 AGNES、DashScope、Cloudflare、Pollinations 或 Hugging Face；用户上传人物照片后改按 `IMAGE_TO_IMAGE_PROVIDER_ORDER` 使用支持参考图的 AGNES 与 CPA Nano Banana 2（默认上游模型 `gemini-3.1-flash-image`），并按配置顺序自动回退。图片请求按 provider 做限流等待，未配置且允许 demo 时使用本地 SVG 演示图。
- 音频：绘本网页朗读使用浏览器内置 `SpeechSynthesis`，不会调用付费 TTS，也不会在故事生成后自动准备音频。`src/app/api/audio/route.ts` 保留给需要真实 MP3 的带旁白视频，通过服务端 Edge TTS WebSocket 生成音频，不需要 DashScope TTS API key，结果优先写入 Supabase 私有 Storage。

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 15 App Router + TypeScript |
| 故事生成 | 自带 OpenAI 兼容端点，未配置时本地 fallback |
| 插图生成 | 阿里云百炼 DashScope，可本地 demo |
| 网页朗读 | 浏览器本机 SpeechSynthesis |
| 视频旁白 MP3 | Edge TTS WebSocket（按需，无 API key） |
| 分享图片 | Browser Canvas 合成长图 |
| 绘本视频 | Remotion Web Renderer + WebCodecs，浏览器本地输出 MP4 |
| 邮件订阅 | Resend + Supabase，双重确认与一键退订 |
| 限流 | Upstash Redis，可本地内存 fallback |

## 项目结构

```text
storybloom/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # 主页：表单、生成流程、预览入口
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── api/generate/route.ts     # POST: 生成故事 + 插图
│   ├── components/book/
│   │   ├── StoryForm.tsx             # 输入表单
│   │   └── BookPreview.tsx           # 完整预览、朗读、分享长图
│   ├── lib/
│   │   ├── story-generator.ts        # 文本生成
│   │   ├── image-generator.ts        # 插图生成
│   │   └── storage.ts                # Redis / 本地缓存 + 限流
│   └── types/index.ts
├── output/storybook-preview/         # 静态 HTML/PNG 示例输出
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

本地不配置 API key 也能跑通基础流程：文本会走 mock，插图会走 demo SVG，网页朗读使用当前设备的系统语音；带旁白视频会按需请求无需 API key 的 Edge TTS。要看真实文本或图片，需要配置相应 provider key；`DASHSCOPE_API_KEY` 只用于选择 DashScope 作为图片服务商时的插图生成。

## 绘本朗读音频

新生成的绘本不会自动请求云端 TTS。用户点击中文、英文或双语朗读时，前端按页面调用当前浏览器/操作系统提供的语音；音色取决于用户设备，不能导出为 MP3。精选绘本的中文朗读继续使用仓库中已生成的静态 MP3。

带旁白视频需要可解码的真实音频文件，因此仍会逐页调用 `/api/audio` 生成 MP3；选择“无旁白”不会调用 TTS。接口只允许已配置的模型与音色，并按客户端 IP 限制请求频率。

视频旁白固定使用 `edge-tts`，中文默认音色为 `zh-CN-XiaoxiaoNeural`，英文默认音色为 `en-US-AnaNeural`，输出为 24 kHz MP3。服务端使用当前 Chromium 握手参数、MUID Cookie 和 `Sec-MS-GEC`，遇到 403 时会按服务器时间修正时钟偏差后重试。可通过 `EDGE_TTS_TIMEOUT_MS` 和 `EDGE_TTS_MAX_ATTEMPTS` 调整超时与 1–2 次尝试次数；单次超时最多 28 秒，以留在 Vercel 60 秒函数时限内。该接口不会调用或回退到 Sambert、CosyVoice 等 DashScope 付费 TTS。

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

该命令会将 3 本精选绘本文字发送给 DashScope，并写入 `public/sample-books/audio`；执行前请确认这些正文允许发送给该服务。

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

Vercel 会根据 `vercel.json` 在每天 UTC 00:00（北京时间 08:00）请求
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

订阅用户可在 `/family` 建立可复用的家庭角色。参考照片保存在 Supabase 私有 Storage，AGNES 会先将照片转换为统一绘本形象；之后在首页极简模式选择角色，即可用一句话生成家庭专属绘本。照片不会发送给 Resend。

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
```

Vercel 的 `NEXT_PUBLIC_APP_URL` 也必须设置为正式域名（不要保留 `http://localhost:3000`）。如果线上 Magic Link 的 `redirect_to` 仍然是 localhost，说明 Supabase 没有匹配到允许的线上 Redirect URL，并回退到了 Site URL；保存 URL Configuration 后需要重新发送一封登录邮件，旧邮件中的地址不会更新。

本地开发时 Magic Link 会回到 `/family` 并恢复登录会话。儿童照片建议使用清晰、单人正面照；上传前浏览器会缩放、转成 WebP 并移除 EXIF，服务端与 Storage 仍按私密儿童资料处理。

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
     ├─ 文本模型或 mock → 生成 8 页故事 JSON
     ├─ 图片模型或 demo → 生成 8 张插图
     ├─ Redis 或本地文件缓存完整故事
     └─ 返回完整 8 页内容给前端
          │
          ▼
前端完整预览
          ├─ 浏览器 SpeechSynthesis → 中文 / 英文 / 中英文网页朗读
          ├─ POST /api/audio → 仅用于带旁白视频的 MP3
     ├─ Canvas 合成 PNG 分享长图
     ├─ Remotion Web Renderer → 720 × 1280 竖屏视频
     └─ 定制礼物版入口 → 小红书 / 闲鱼下单咨询
```

## 绘本视频

绘本视频功能在用户自己的绘本插图全部完成后启用，也可用于绘本馆中图片齐全的静态书籍。渲染代码在点击按钮后才会加载，不会改变现有故事生成、朗读或 PNG 分享流程。

- 默认输出 720 × 1280、24 FPS 的 H.264 MP4；浏览器不支持 MP4 编码时会尝试 WebM。
- 中文、英文和双语模式会逐页调用现有 `/api/audio`，无旁白模式不会调用 TTS。
- 推荐使用最新版 Chrome。最低支持范围取决于 WebCodecs：Chrome 94、Firefox 130、Safari 26。
- 可用 `NEXT_PUBLIC_STORY_VIDEO_ENABLED=0` 随时关闭入口，不影响其他功能。
- Remotion Web Renderer 会向 Remotion 发送许可计量事件，包括站点域名、IP、生产/开发环境和渲染结果，不包含绘本正文、插图或成片内容。正式上线前应在隐私说明中披露，并按团队规模配置 `NEXT_PUBLIC_REMOTION_LICENSE_KEY`。
- 绘本馆书籍使用稳定的 canonical URL，可直接通过系统分享或复制阅读链接；用户临时生成绘本的长期公开链接仍属于路线图任务 D，需要独立持久化。

当前 Remotion 依赖使用完全一致的固定版本。官方文档标注 Web Renderer 从 4.0.491 起稳定，但截至 2026-07-17 npm 最新版本仍为 4.0.490；公开生产启用前应升级到 4.0.491 或更高版本，并同时升级 `remotion` 与全部 `@remotion/*` 包。

## 后续建议

- 图片质量优先：先稳定角色一致性、构图、文字 prompt，再考虑付费。
- 音频质量升级：继续试听并调整默认旁白、语速与情感指令；精选静态音频更新时使用生成脚本显式重建。
- 分享体验：可继续增加单页图片、封面图、朋友圈比例图等导出格式。
