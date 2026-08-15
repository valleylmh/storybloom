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
- **按需使用音频成本**：绘本馆朗读由用户点击后逐页请求云端音频，优先使用 Token Plan 百炼 TTS；翻页模式会高亮当前文字并在读完后自动翻页。普通生成预览仍使用浏览器 `SpeechSynthesis`。
- **隐私默认收敛**：上传照片先在浏览器重编码并移除 EXIF；家庭照片进入私有 Storage；公开分享只保留阅读所需字段并提供删除令牌。
- **无 Key 也能本地体验**：文本、本地图像占位和浏览器朗读都有安全兜底，部署者可以按需接入自己的模型与基础设施。

## 开源说明

StoryBloom 以 MIT 许可证开放应用代码。仓库只保留公开的 AI 生成样例，不应提交真实儿童照片、家庭声音录音、客户绘本、私聊二维码或生产密钥。部署者需要使用自己的域名、API 端点、Supabase、Resend 和图片服务凭据。

线上演示站的免费额度是当前托管服务策略，不代表第三方模型、存储、邮件或带宽永久免费；自托管者需要自行承担所启用服务的费用。

本项目依赖 Remotion；其许可不包含在 StoryBloom 的 MIT 许可证中。启用视频功能前，请阅读 [Remotion License](https://www.remotion.dev/docs/license) 并确认当前用途符合条款；不需要视频时可设置 `NEXT_PUBLIC_STORY_VIDEO_ENABLED=0`。

安全问题请按 [SECURITY.md](SECURITY.md) 私下报告，参与开发请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。公开仓库不应包含真实儿童照片、家庭声音录音、客户绘本、联系人二维码、生产密钥或本地生成缓存。

## 模型调用说明

当前代码主要有三类生成模型调用：

- 文本模型：`src/lib/story-generator.ts`。通过部署者配置的 OpenAI 兼容端点调用文本模型；读取 `CPA_BASE_URL`、`CPA_API_KEY` 和 `STORY_TEXT_MODEL`。未配置或服务不可用时使用与用户主题一致的本地兜底故事。
- 图片模型：`src/lib/image-generator.ts`。普通角色按 `IMAGE_PROVIDER_ORDER` 使用 AGNES、DashScope、Cloudflare、Pollinations 或 Hugging Face；极简模式中确认并保存的照片角色会先由 CPA Nano Banana 2（默认上游模型 `gemini-3.1-flash-image`）生成统一设定稿，随后所有实际出现该角色的页面都固定使用 CPA，不回退到其他提供商。临时自定义参考图仍按 `IMAGE_TO_IMAGE_PROVIDER_ORDER` 工作。图片请求按 provider 做限流等待，未配置且允许 demo 时使用本地 SVG 演示图。
- 音频：普通生成预览使用浏览器内置 `SpeechSynthesis`；绘本馆在用户点击朗读后调用 `src/app/api/audio/route.ts`，配置 `DASHSCOPE_TOKEN_KEY` 时优先使用 Token Plan 百炼 TTS，失败后直接回退 Edge；未配置 Token Plan 时保留 Gemini 2.5 → Gemini 3.1 → Edge 路由。带旁白视频复用同一音频接口。家庭真人声音默认关闭；显式启用后固定使用百炼 `qwen-audio-3.0-tts-plus`，不会静默替换成其他音色。

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 15 App Router + TypeScript |
| 故事生成 | 部署者配置的 OpenAI 兼容端点，未配置或失败时使用本地 fallback |
| 插图生成 | AGNES、DashScope、Cloudflare、Pollinations、Hugging Face；家庭照片角色固定使用 CPA Nano Banana |
| 网页朗读 | 绘本馆优先 Token Plan 百炼 TTS；普通生成预览使用浏览器本机 SpeechSynthesis |
| 视频旁白音频 | Token Plan 百炼 TTS（失败直达 Edge）；未配置时 Gemini 2.5 → Gemini 3.1 → Edge；家庭真人声音默认关闭，启用后固定百炼 |
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

本地不配置 API key 也能跑通基础流程：文本会使用与主题相关的本地 fallback，插图会先展示 demo SVG，普通生成预览朗读使用当前设备的系统语音；绘本馆朗读和带旁白视频会按需使用无需 key 的 Edge TTS。要看真实文本或图片，需要配置相应 provider key。普通 Token Plan 绘本馆朗读与视频旁白使用独立的 `DASHSCOPE_TOKEN_KEY`；显式启用声音复刻后使用标准 `DASHSCOPE_API_KEY`，也可通过 `BAILIAN_VOICE_CLONING_API_KEY` 单独覆盖。

## Production Readiness v1

Reliable Generation 的生产部署必须使用跨实例可访问的共享持久化。部署前在与目标环境相同的变量集合中运行：

```bash
npm run check:production
```

这个检查只读取本地环境变量，不联网、不调用模型或 Supabase，也不会输出任何 secret 的值；它只报告 **configuration readiness（配置就绪）**。JSON 中的 `configurationReady`（以及为兼容旧调用保留的 `ok`）不代表 `productionVerified`；脚本始终把后者报告为 `false`，直至部署者在目标平台完成并记录人工验收。生产环境必须配置一组且仅一组完整的共享存储凭据：`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`，或 `KV_REST_API_URL` + `KV_REST_API_TOKEN`。不完整、混用或同时填写两组都会被拒绝。Supabase 公钥可使用现有的 `NEXT_PUBLIC_SUPABASE_ANON_KEY`，也可使用 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。

Vercel 的多实例运行环境如果没有共享 Redis/KV，异步文本任务、刷新恢复和跨实例幂等都不可靠；生产检查应拒绝这种配置。仅依赖进程内存或实例本地文件不能作为生产持久化。部署到 Cloudflare 时，需要在 Cloudflare 侧自行绑定并验证共享存储（例如通过 Worker/平台变量提供上述完整配对）；仓库中的 `vercel.json` 只描述 Vercel Cron，在 Cloudflare 上不适用，定时任务需另行配置 Cloudflare Cron Trigger。

部署完成后，再按下面的 smoke 清单逐项操作并记录结果；本节只定义验收动作，不会替你发起线上请求：

- 在部署平台确认生产变量已保存，并再次运行 `npm run check:production`。
- 匿名创建一本绘本，在文本生成进行中刷新页面，确认 task ID、真实状态和恢复入口仍在。
- 完成 8 页大纲审阅与确认，确认确认前不显示插画预览，确认后逐页生成状态可见。
- 制造或等待一页插画失败，确认只有用户点击该页的“重试”才会再次提交，其余页面不被重复提交。
- 在另一实例或另一浏览器继续同一任务，确认文本任务、故事快照和插画状态来自共享存储。
- 登录并检查家庭照片/声音流程：没有明确监护人同意时，不上传或自动同步本地资料。
- 检查平台日志与告警，确认能定位任务失败、耗时和 provider 状态，且日志不含请求正文、凭据或儿童媒体。
- 若启用邮件灵感，在目标平台按其方式配置并手动验证 Cron；Cloudflare 不使用 `vercel.json` 中的 Cron 声明。

### Production Jobs & Assets（默认关闭）

仓库正在为文本与插画任务建立带幂等键、worker lease、重试上限和过期 lease reclaim 的基础层，但生产入口默认关闭：

```bash
STORYBLOOM_PRODUCTION_JOBS_ENABLED=0
```

只有 worker/reclaim API、定时触发和共享临时图片字节存储都已部署并完成 smoke 后，才可改为 `1`。启用时 `npm run check:production` 还会要求：

- 独立的服务端 `GENERATION_WORKER_SECRET` 与 `STORYBLOOM_ASSET_PRINCIPAL_SECRET`，均至少 32 个字符；不要彼此复用，也不要与 `CRON_SECRET`、Provider key 或 Supabase key 复用。后者只用于把登录用户 ID 或默认匿名 cookie `storybloom_asset_session` 派生为 opaque principal；cookie/用户标识原值不得写入 job、资产 metadata 或日志。
- 唯一完整的 Upstash/KV 配对，用于队列、幂等键和 lease 状态。
- `STORYBLOOM_TEMP_ASSET_BACKEND=supabase` 与一个已创建、保持私有的 `STORYBLOOM_TEMP_ASSET_BUCKET`（代码默认名为 `story-generation-assets`）。
- Supabase URL、公开 key 与 service-role key 的既有生产基线。

共享临时资产首次启用前，需要在目标 Supabase 项目手工执行：

```text
supabase/migrations/202608130001_temporary_story_generation_assets.sql
```

该迁移创建最大 16 MiB、只允许 JPEG/PNG/WebP 的私有 `story-generation-assets` bucket，且故意不创建浏览器可用的 Storage policy；读写与清理只能通过 service-role 和鉴权后的 `/api/story-assets/<assetId>` 应用路由完成。若自定义 `STORYBLOOM_TEMP_ASSET_BUCKET`，还需要在 Supabase 中建立同名、等效限制的私有 bucket；现有迁移只创建默认名称。

在目标 Supabase 项目中，必须逐项记录下面的 bucket 验收结果；`npm run check:production` 只会把这些项目列为 `manualVerificationChecks`，不会替你执行：

- 查询 bucket 配置，确认目标名称存在、`public=false`、`file_size_limit=16777216`，且 MIME allowlist 恰为 JPEG/PNG/WebP。
- 使用 anon key 与已登录普通用户会话分别验证：不能直接 list/upload/download/update/delete `storage.objects`；“请求被拒绝”才是成功结果。
- 使用仅在受控服务端持有的 service-role key 和一个无儿童信息的随机测试对象，验证 upload → download（字节一致）→ delete 全流程；测试后不得遗留对象，也不要把 key、signed URL 或对象正文写入日志。
- 确认应用鉴权路由仍将不存在与无权限统一为 404，并验证其他匿名会话不能读取该测试资产。

上述 probe 全部通过，只能证明 bucket 契约；仍需完成 worker/Cron、lease reclaim、失败重试、stale attempt fence 和过期/孤儿清理 smoke，才可把 `STORYBLOOM_PRODUCTION_JOBS_ENABLED` 从 `0` 改为 `1`。

`GENERATION_WORKER_LEASE_MS`、`GENERATION_WORKER_CLAIM_LIMIT`、`GENERATION_RECLAIM_LIMIT`、`STORYBLOOM_TEMP_ASSET_TTL_SECONDS`、`STORYBLOOM_TEMP_ASSET_MAX_BYTES`、`STORYBLOOM_TEMP_ASSET_ORPHAN_GRACE_SECONDS` 和 `STORYBLOOM_TEMP_ASSET_SWEEP_LIMIT` 可按负载调整；它们不是提高可靠性的替代品。worker 在单个文本或插画 executor 运行期间会自动续租（按 lease 的三分之一、最长 60 秒一次），但最终写入仍必须通过当前 lease 与 task/page attempt fence；平台强制终止后仍要等待 lease 过期并由下一轮 reclaim 接管。`local-file` 模式把图片字节写入实例文件系统，即使 Redis 保存 metadata，也仍不是 Vercel/Cloudflare 多实例生产后端；生产必须由 capabilities 同时确认私有共享 bytes 与 Redis metadata 已就绪。

Vercel 需要在 `vercel.json` 中显式配置实际存在且鉴权的 worker/reclaim 路由；目前文件里只有每日灵感 Cron，不能宣称 generation reclaim 已启用。Cloudflare 不读取 `vercel.json`，需分别配置 Cron Trigger 或 Queue consumer、环境变量和 secrets；当前共享字节后端仍是 Supabase 私有 Storage，不应写成已经接入 Cloudflare R2。还需验证 OpenNext/Node runtime 的实际行为。两边都必须测试：两个 worker 不会同时 claim 同一 job、worker 被中断后 lease 能被 reclaim、旧 lease/旧插画 attempt 晚到会被忽略、达到重试上限进入明确失败，以及临时图片不能被其他匿名会话读取且过期/孤儿对象会被清理。

这套任务队列和临时资产基础层不等于长期绘本归档。登录后的 `story-archive` 仍只在用户明确选择上传/同步时使用；登录本身不会上传本地故事、成长照片或声音。这里的 readiness 是配置判断，不会联网确认 bucket 存在、是否私有、迁移是否部署、Cron 是否触发或 worker 是否实际运行，因此在完成真实平台验收前不能宣称 Production Jobs & Assets 已生产验证。

## 绘本朗读音频

新生成的绘本不会自动请求云端 TTS。普通生成预览中的中文、英文或双语朗读继续调用当前浏览器/操作系统提供的语音；绘本馆则只在用户点击后逐页请求音频，优先使用 Token Plan 百炼 TTS。翻页阅读会预取下一页音频，当前页播放时高亮对应语言文字，播放结束后自动翻页；切换到平铺查看会停止这次连续朗读。精选绘本的中文朗读继续使用仓库中已生成的静态 MP3。

带旁白视频需要可解码的真实音频文件，因此仍会逐页调用 `/api/audio`；选择“无旁白”不会调用 TTS。接口只允许已配置的模型与音色，并按客户端 IP 限制请求频率。

配置 `DASHSCOPE_TOKEN_KEY` 时，视频旁白首先使用 Token Plan 的 `qwen-audio-3.0-tts-plus`：中文默认音色 `longanlingxin`，英文默认音色 `longanlufeng`，输出为 24 kHz MP3。未配置、空字符串或设置 `TOKEN_PLAN_TTS_ENABLED=0` 时会完全跳过；普通 Token Plan 请求失败时直接回退 Edge。可通过 `TOKEN_PLAN_TTS_VOICE_ZH`、`TOKEN_PLAN_TTS_VOICE_EN` 和 `TOKEN_PLAN_TTS_TIMEOUT_MS` 调整行为。服务端只接受可信的北京 OSS 音频地址，下载并验证 MP3 后再写入私有缓存，不会向前端暴露临时签名 URL。

仅当 `NEXT_PUBLIC_FAMILY_VOICE_CLONING_ENABLED=1` 时，绑定真人声音的家庭角色才会进入专用视频旁白路径。视频逐页请求只提交 `familyCharacterId` 和登录令牌；服务端从私有 `family_character_voices` 表读取 `voice_id`，强制传给 `qwen-audio-3.0-tts-plus`。客户端不能提交任意 `voice_id`，响应也只返回安全标签。没有克隆声音或开关关闭时继续沿用原有视频旁白。家庭真人声音失败时会明确报错，不会回退为其他人物或系统音色；重新录制期间旧的已就绪声音仍可使用，生成结果跳过长期 `story-audio` 持久化缓存。

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

已登录用户可在 `/family` 建立可复用的家庭角色。参考照片保存在 Supabase 私有 Storage，CPA Nano Banana 会先将照片转换为统一绘本形象。声音复刻默认关闭；只有部署者显式设置 `NEXT_PUBLIC_FAMILY_VOICE_CLONING_ENABLED=1` 并重新构建/部署后，人物角色才会显示录音入口并允许调用付费模型。启用后，浏览器通过 Web Audio 采集 10–60 秒单声道 PCM 并编码为 16-bit WAV，再上传到私有 `family-voice-samples` bucket；服务端会校验真实媒体容器、时长、采样率与 10MB 上限，签发 10 分钟临时 URL，再调用百炼 `voice-enrollment / create_voice`，固定绑定到 `qwen-audio-3.0-tts-plus`。创建返回 `voice_id` 后仍会通过 `query_voice` 等待状态进入 `OK`，`DEPLOYING` 保持审核中，`UNDEPLOYED` 会恢复旧声音或提示重新录制。关闭开关时不会创建音色，也不会在视频旁白中使用已绑定的真人声音；删除既有声音和账户数据清理仍然可用。网络响应中断留下的未引用上传会在 3 分钟安全窗口后自动对账清理。照片与声音都不会发送给 Resend，也不会进入公开分享快照。

1. 在同一个 Supabase 项目依次执行：

```text
supabase/migrations/202607120002_family_profiles.sql
supabase/migrations/202608090003_family_character_voices.sql
supabase/migrations/202608090004_family_character_voice_lifecycle.sql
```

`202608090003` 新增 `family_character_voices` 和私有 `family-voice-samples` bucket；`202608090004` 是必须继续执行的生命周期升级：收紧为 WAV/MP3/M4A 与 10MB、加入私有样本清理队列和账户删除锁、阻止客户端绕过 provider 撤销直接级联删除角色，并把声音外键改为 `ON DELETE RESTRICT`。如果旧版 `202608090003` 已经手工部署，只需继续执行 `202608090004`，不要期待 Supabase 重跑旧迁移。`voice_id`、并发 claim token、旧音色/样本清理队列与恢复快照只有 service-role 可读写。用户可单独撤回真人声音；重新录制、删除角色和删除账户都会先按阿里云[声音复刻 HTTP API](https://help.aliyun.com/zh/model-studio/voice-clone-design-http-api)调用 `delete_voice`，确认私有样本已删除后才移除本地绑定。

百炼没有承诺 `delete_voice` 幂等，也没有为当前接口定义“已不存在”的稳定错误码。因此新加入撤销队列的音色不会在同一次请求里仅凭短时 `list_voice` 缺席就视为已删除；失败状态会保留为可重试 tombstone，经过至少 15 分钟的第二观察窗后，后续请求才允许用完整列表缺席完成对账。这样既避免刚创建的音色因最终一致性成为孤儿，也让确实没有产生远端副作用的超时请求最终可以完成声音、角色或账户删除。
2. 从 Supabase Project Settings → API 获取公开的 anon key（新项目也可能显示为 publishable key），配置其中一个：

```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# 或 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

3. 为声音复刻配置标准百炼 API Key；浏览器不能接触这些服务端密钥。Token Plan 的 `DASHSCOPE_TOKEN_KEY` 不能用于 `voice-enrollment`：

```bash
NEXT_PUBLIC_FAMILY_VOICE_CLONING_ENABLED=1
DASHSCOPE_API_KEY=...
# 可选：与图片等 DashScope 调用分开配置
BAILIAN_VOICE_CLONING_API_KEY=...
BAILIAN_VOICE_CLONING_ENDPOINT=https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization
BAILIAN_VOICE_CLONING_TIMEOUT_MS=30000
FAMILY_VOICE_ENROLLMENT_RATE_LIMIT_PER_HOUR=12
```

4. 在 Supabase Authentication → URL Configuration 配置：

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

## 本地成长时刻与绘本版本

本地成长档案已将家长确认的真实时刻、备注和现场照片保存为 `GrowthMoment`，把每次 AI 绘本结果保存为独立 `StorybookVersion`。同一个时刻可以从时间轴再次发起创作，复用只读事实与现场照片，并为新版本单独选择阅读阶段、故事处理方式、插画风格和角色引用；生成任务恢复后仍会幂等归属原 Moment。同一个时刻的版本可分别切换或删除，也可单独清除现场照片；删除最后一个版本不会删除真实时刻。现场照片在浏览器重编码为 WebP 后记录 MIME、压缩后字节数和 SHA-256，同一 Moment 内按实际内容去重；界面使用当前站点的 `navigator.storage.estimate()` 显示容量快照和预警，不申请 persistent storage 权限。成长书架提供浏览器端 ZIP 导出、保存字段与用途说明、保留期限偏好及到期预览；保留期限不会自动删除内容，删除到期时刻或全部本机档案都需要家长再次确认。既有 IndexedDB `GrowthRecord` 会在本机幂等迁移、按需补齐照片元数据并保留兼容投影，登录不会触发上传。

私有云成长档案提供独立治理代码路径：登录后可读取摘要、生成成长档案专用 ZIP、保存不自动执行的保留期限偏好，并在二次确认后只删除私有云成长档案。真实项目已经部署 GrowthMoment schema，并完成 RLS、私有 Storage、双账户隔离和合成数据双写验收；家长主动导入时仍保存兼容 `growth_records`，同时镜像到 `growth_moments`、`growth_moment_assets` 与 `storybook_versions`。登录、扫描和查看不会触发本机上传，删除成长档案也不会删除普通绘本馆、家庭角色、真实声音或公开分享。同一账户两台真实设备的最终 UI 闭环仍待确认，数据边界、部署顺序和验收记录见 [docs/growth-moments-v1.md](docs/growth-moments-v1.md) 与 [部署验收清单](docs/cloud-growth-archive-deployment-checklist.md)。

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
                   ├─ 浏览器 SpeechSynthesis → 普通生成预览朗读
                   ├─ POST /api/audio → 绘本馆百炼优先朗读
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
