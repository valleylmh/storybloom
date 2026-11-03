# StoryBloom 内容生产脚本

## check-production-readiness.ts — 生产配置检查

在部署前检查 Reliable Generation 所需的生产环境基线：

```bash
npm run check:production
```

脚本只读取当前进程中的环境变量，不联网、不调用 provider 或 Supabase，也不会打印 secret 值。它报告的是 `configurationReady`；为兼容保留的 `ok` 只是同义字段，`productionVerified` 始终为 `false`。生产环境必须配置一组且仅一组完整的共享持久化配对：`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`，或 `KV_REST_API_URL` + `KV_REST_API_TOKEN`；缺失、混用或同时配置两组会返回失败。通过检查不等于生产部署或真实 provider 已验证，部署后仍需按根目录 README 的 smoke 清单人工验收。

`STORYBLOOM_PRODUCTION_JOBS_ENABLED` 默认关闭。开启后，检查脚本还会验证专用 worker secret、资产 principal HMAC secret、共享临时资产 backend/bucket 和可选 lease/claim/reclaim 数值范围，但仍不会连接 Redis 或 Supabase，也不会确认 worker、Cron、bucket 隐私和清理策略已经部署。当前没有独立的 worker/reclaim 命令可由本 README 承诺；只有相应 API/脚本真实接线并通过平台验收后，才应把它们加入部署计划。

启用 Supabase 临时资产后端前，还需手工执行 `supabase/migrations/202608130001_temporary_story_generation_assets.sql`。开关为 `1` 时，输出会列出 `manualVerificationChecks`：确认 bucket 私有性/MIME/大小限制，确认 anon/auth 无法直接访问，使用无敏感内容的 disposable 对象确认 service-role upload/download/delete，以及完成 worker 平台 smoke。检查脚本不会替代这些动作，也不会探测默认私有 bucket 是否真实存在。

## generate-library-book.ts — 绘本馆书籍草稿生成

为 `/library` 绘本馆生成单本书的**草稿 JSON**。公开内容生产边界见 [docs/feature-roadmap-tasks.md](../docs/feature-roadmap-tasks.md#b-绘本馆与内容生产)。

### 用法

```bash
pnpm library:generate <seriesId> <bookId> "<素材梗概>" [--order N] [--dry-run]
```

示例（成语故事）：

```bash
pnpm library:generate chengyu shou-zhu-dai-tu \
  "守株待兔：宋人耕田，一日兔走触株折颈而死，因释耒守株，冀复得兔，兔不可复得，田荒。出自《韩非子·五蠹》。" \
  --order 1
```

示例（唐诗入画，素材中应给出经过校对的完整原诗）：

```bash
pnpm library:generate tangshi jing-ye-si \
  "李白《静夜思》：床前明月光，疑是地上霜。举头望明月，低头思故乡。保留原文，以月光和思乡为意境导读。" \
  --order 2
```

- `--dry-run`：只打印 prompt，不调用 API（检查 prompt 内容用）。
- 需要 `.env.local` 中配置文本模型（`CPA_API_KEY` 等，与 `/api/generate` 相同）。脚本自己加载 `.env.local` / `.env`。
- 生成失败会**响亮报错退出**，绝不回退到模板内容（与线上生成链路的兜底行为刻意不同）。

### 产出格式

`content-drafts/<seriesId>/<bookId>.json`：

```jsonc
{
  "_draft": "UNREVIEWED DRAFT — ...",
  "book": { /* 与 src/types/library.ts 的 LibraryBook 结构一致（zod 校验过） */ },
  "imagePromptKit": {
    "globalStyle": "全系列统一风格 prompt",
    "characterConsistency": "主角外观锁定 prompt",
    "negative": "负面 prompt"
  }
}
```

### 审核与上线流程（人工环节，不可跳过）

1. **生成草稿**：运行脚本，得到 `content-drafts/<seriesId>/<bookId>.json`。
2. **人工审核文字**：直接编辑 JSON——中文节奏/字数、英文自然度、教育性、结局温和化、`idiomMeaning`/`moral` 准确性。唐诗还必须逐字核对 `poem.originalLines`，英文译意应为项目原创表达，不复制现成译本。
3. **生成插图**：按草稿中的完整页数逐页生成插图，不要求固定 8 页。先用第 1 页建立角色、服装和材质锚点，后续页面复用同一参考图或等效的身份约束。每页最终 prompt = `imagePromptKit.globalStyle` + `imagePromptKit.characterConsistency` + 该页 `illustrationPrompt` + `imagePromptKit.negative`（流程同 [docs/sample-book-prompts/README.md](../docs/sample-book-prompts/README.md)）。无论使用哪种工具，都必须人工挑选并复核整本角色一致性。
4. **放置图片**：WebP、单张 ≤ 300KB，按连续页码放 `public/library/<seriesId>/<bookId>/<page>.webp`。
5. **转正式数据**：把审核后的 `book` 对象搬进 `src/lib/library/<seriesId>.ts`：每页补 `imageUrl: "/library/<seriesId>/<bookId>/<n>.webp"` 与 `imageStatus: "complete"`；确认 `order`；移除 `comingSoon`。
6. **验证**：`npx tsc --noEmit` + `pnpm test`（`tests/library.test.ts` 会校验页数与双语完整性）。

草稿目录 `content-drafts/` 建议提交进 git，便于追溯审核修改。

## generate-library-draft-images.ts — 草稿插图批量生成

读取 `content-drafts/haoqi/*.json` 中已经人工审核的草稿，按 `order` 范围逐页调用现有图片 Provider，压缩成 1200×1200 WebP，并写入 `public/library/haoqi/<bookId>/<page>.webp`。已有非空图片会跳过，因此可在个别页面失败后用同一命令安全续跑。

```bash
node --env-file=.env --env-file=.env.local --import tsx \
  scripts/generate-library-draft-images.ts \
  --from 11 --to 30 --concurrency 4
```

脚本只完成初稿生成和文件规格压缩；上线前仍必须逐本制作联系表，检查人物数量与一致性、无文字/水印、儿童安全和科学画面，再替换不合格页面。

## generate-library-contact-sheets.ts — 插图联系表

将指定系列已生成的全部插图按每行 4 张拼成联系表，供发布前逐本视觉验收；页数与联系表行数从草稿自动读取，`--series` 默认为 `haoqi`：

```bash
node --import tsx scripts/generate-library-contact-sheets.ts \
  --series tangshi --from 1 --to 10
```

输出为 `content-drafts/<seriesId>/<bookId>/contact-sheet.jpg`。脚本只读取既有 WebP；页码不连续或缺页会报错，不会把不完整插图标记为已验收。

## 亲子成长新增十本

已确认的中文正文和分镜保存在 `content-drafts/qinzi/batch-07-16/books/`，双语生产稿位于 `content-drafts/qinzi/<bookId>.json`。本批 10 本，每本 18 页，分为亲子相处与学会新本领；正式资源继续使用历史路径 `public/library/sanzijing/`，保留阅读记录与旧书链接。

插画使用内置 imagegen，逐页生成；每本第 1 页作为人物与画风参考。`image-prompts.json` 保存初始提示词，各书页面的 `generationPrompt` 与 `generatedSource` 保存实际生成记录。新图片导入命令：

```bash
node --import tsx scripts/import-qinzi-batch-image.ts \
  --book sheng-zi-shua-de-yi-sheng --page 2 --source /absolute/path/to/generated.png
```

导入为 1200×1200、最多 300 KiB 的 WebP，默认拒绝覆盖；复核后替换本批图片可使用 `--replace`。中文旁白沿用百炼 TTS，运行前需确认已获准把本批正文发送给该服务：

```bash
node --conditions=react-server --import tsx scripts/generate-qinzi-batch-audio.ts
```

脚本要求计划已确认，复用内容寻址的逐页缓存，验证解码结果与非静音，写入本地 MP3 和 `content-drafts/qinzi/local-audio.json` 的逐页时间轴；不上传、不部署。

本批在百炼正文外发授权未确认时，使用 Mac 本机已经安装的中文语音提前生成旁白。该流程不读取服务凭据、不把正文发送到第三方，旁白清单记录 `generatedWith: macos-say-local`、语音和语速：

```bash
node --import tsx scripts/generate-qinzi-local-audio.ts
```

全部插画、音频及整本视觉验收完成后，才把本批 `comingSoon` 改为 false 并接入读者入口。

## 亲子成长第二批十本

第二批确认稿保存在 `content-drafts/qinzi/batch-17-26/books/`，对应系列第 17–26 本，共 180 页。`plan.json` 记录内容确认，`bilingual-manuscript.md` 保存逐页双语生产稿，`image-prompts.json` 保存每页独立提示词。

本地导入图片、生成整本联系图和 Mac 旁白时，显式选择第二批目录：

```bash
node --import tsx scripts/import-qinzi-batch-image.ts --batch batch-17-26 --book bu-he-biao-ge-bi-kuai --page 1 --source /absolute/path/to/generated.png
node --import tsx scripts/generate-qinzi-contact-sheets.ts --batch batch-17-26
node --import tsx scripts/generate-qinzi-local-audio.ts --batch batch-17-26
```

省略 `--batch` 时仍处理第一批 `batch-07-16`。第二批正文确认后开始生成资源，逐页图片、中文旁白及整本视觉复核全部完成后才启用读者入口。旁白沿用本机语音；本批没有新增第三方正文外发、上传或发布授权。

## import-library-image-grid.ts — 导入经审核的四格重绘图

将一张严格的 2×2 正方形联系图切分为四张正式 1200×1200 WebP。默认不会覆盖已有资源；只有逐页审核后才加 `--replace`：

```bash
node --import tsx scripts/import-library-image-grid.ts \
  --source /absolute/path/to/approved-grid.png \
  --book hai-lang-wei-shen-me-yi-xia-yi-xia \
  --pages 1,2,3,4 --replace
```

导入时会验证四格大小一致、重新编码到 300KB 以下；它不生成图片，也不会跳过视觉审核。`--pages` 中的 `0` 表示丢弃对应格子，便于只替换已判定不合格的页。

`build-library-image-grid-prompt.ts` 仅从审核过的草稿生成四格重绘 prompt；它不调用任何 provider：

```bash
node --import tsx scripts/build-library-image-grid-prompt.ts \
  --book hai-lang-wei-shen-me-yi-xia-yi-xia --pages 1,2,3,4
```

## wechat-publish-library-picture.mjs — 公众号图片消息草稿

读取绘本馆正式书目和 `public/library/<seriesId>/<bookId>/1-8.webp`，生成与网页“社交分享”弹窗一致的 1080×1440 逐页双语贴图，然后创建微信公众号 `newspic` 图片消息草稿。

```bash
# 查看可发布书目
pnpm wechat:library-picture -- --list

# 只生成本地预览，不访问微信接口
pnpm wechat:library-picture -- chengyu dui-niu-tan-qin --dry-run

# 上传 8 张永久图片素材并进入公众号草稿箱
pnpm wechat:library-picture -- chengyu dui-niu-tan-qin \
  --env-file ../../blog/.env
```

- 默认只创建草稿，不会直接发表。
- `--publish` 会在草稿创建成功后继续调用发布接口，请先人工验证至少一本。
- 每张图片底部叠加本页中英文；图片消息的文字内容同时列出全部页面的中英文。
- WebP 会转换为高质量 JPEG，第一张图作为微信图片消息封面。
- 永久素材 `media_id` 按图片内容哈希缓存在 `.wechat_picture_media.json`，避免重复上传；需要重新上传时使用 `--force-upload`。
- 密钥只从 `WECHAT_APPID`、`WECHAT_APPSECRET` 或 `--env-file` 读取，不写入仓库。

### 好奇为什么第 31–48 本（18–20 页）

`generate-library-book.ts` 支持 `--pages N`（8–64，默认仍为 8）。本批批准选题与科学边界在 `content-drafts/haoqi/batch-31-48/plan.json`。

中文音频沿用现有 Token Plan TTS、内容哈希缓存和逐页时间轴：

```bash
node --conditions=react-server --import tsx scripts/generate-haoqi-batch-audio.ts
```

只读取本批 18 本当前正文，写入各书本地 MP3 和 `content-drafts/haoqi/local-audio.json`，不上传、不部署。重复执行复用逐页缓存；正文变化会生成新的内容寻址文件。图片生成仍使用已有 `generate-library-draft-images.ts --from 31 --to 48`；本批优先保留逐页场景，避免供应商提示词截断丢失科学内容。

### 日常系列第 41–50 本（大班生活，180 页）

已确认范围在 `content-drafts/richang/batch-41-50/plan.json`；审校后的各书 JSON 是正文来源，`manuscript.md` 是其阅读副本。不要重跑初稿生成器覆盖生产稿；生成器会拒绝已有批次。`editorial-corrections.json` 记录文字修改与事实来源。

插画只用内置 imagegen。`image-prompts.json` 保留初始计划，`image-repairs.json` 记录返修任务、实际提示词和检查结果；每页 `generatedSource` 指向原始生图文件。早期仅记录场景的页面标注 `scene-only-legacy`，缩略记录标注 `partial-legacy`，不补造完整提示词。默认导入拒绝覆盖，已复核的替换使用 `--replace`，旧 WebP 自动保存在该书 `iterations/` 目录。

```bash
node scripts/import-richang-image.mjs BOOK_ID PAGE /absolute/path/to/generated.png 'FULL_ACTUAL_PROMPT'
node --conditions=react-server --import tsx scripts/generate-richang-batch-audio.ts --batch batch-41-50
node scripts/audit-richang-batch.mjs --batch batch-41-50
node --import tsx scripts/generate-library-contact-sheets.ts --series richang --from 41 --to 50
npx vitest run tests/richang-library.test.ts tests/library-book-audio.test.ts
npx tsc --noEmit
```

旁白已授权使用百炼 `qwen-audio-3.0-tts-plus` / `longanlingxin`，按最终中文和缓存增量生成。离线审计核验 180 张图片的尺寸、体积、哈希及 10 本当前旁白的正文哈希、解码、时长、逐页非静音；浏览器另验阅读、播放和移动端。`comingSoon: false` 仅表示本地目录已接入，不表示已经提交、上传或线上发布。

### 日常系列第 51 本《今天妈妈在校门口站岗》（周三值日生与家长志愿者，18 页）

单本批次目录为 `content-drafts/richang/batch-51-51/`（沿用 `batch-N-N` 命名，便于现有音频与审计脚本的 `--batch` 参数直接复用）。选题、文稿与分镜由 `create-richang-batch51-drafts.py` 一次写入；该生成器在文件或批次目录已存在时拒绝覆盖，后续修改请直接编辑审校后的 JSON。

```bash
python3 scripts/create-richang-batch51-drafts.py   # 仅在首次建稿时运行
node scripts/import-richang-image.mjs ma-ma-zai-xiao-men-kou-zhan-gang 1 /absolute/path/to/generated.png 'FULL_ACTUAL_PROMPT'
node --conditions=react-server --import tsx scripts/generate-richang-batch-audio.ts --batch batch-51-51
node scripts/audit-richang-batch.mjs --batch batch-51-51
npx vitest run tests/richang-library.test.ts
npx tsc --noEmit
```

插画由 Magpie 的 imagegen 生成（本机 Magpie 的 Image generation 指向 `codex/gpt-image-2`），原始 PNG 保存在 `output/imagegen/richang-51/`，导入时统一转为 1200×1200 WebP 并写入完整提示词。第 3 页与第 9 页按连续性返修过一次，最终稿为 `page-03-v2.png`、`page-09-v2.png`。第 51 本图片为 `full` 提示词记录，不属于第 41–50 本的 `scene-only-legacy` 例外。
