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
3. **生成插图**：为 8 页分别生成插图。先用第 1 页建立角色、服装和材质锚点，后续页面复用同一参考图或等效的身份约束。每页最终 prompt = `imagePromptKit.globalStyle` + `imagePromptKit.characterConsistency` + 该页 `illustrationPrompt` + `imagePromptKit.negative`（流程同 [docs/sample-book-prompts/README.md](../docs/sample-book-prompts/README.md)）。无论使用哪种工具，都必须人工挑选并复核整本角色一致性。
4. **放置图片**：webp、单张 ≤ 300KB，放 `public/library/<seriesId>/<bookId>/<page>.webp`（1-8）。
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

将指定系列已生成的 8 页插图拼成 4×2、1200×600 的联系表，供发布前逐本视觉验收；`--series` 默认为 `haoqi`：

```bash
node --import tsx scripts/generate-library-contact-sheets.ts \
  --series tangshi --from 1 --to 10
```

输出为 `content-drafts/<seriesId>/<bookId>/contact-sheet.jpg`。脚本只读取既有 WebP；缺页或不是完整 1–8 页会报错，不会把不完整插图标记为已验收。

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
