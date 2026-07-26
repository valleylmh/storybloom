# StoryBloom 内容生产脚本

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
2. **人工审核文字**：直接编辑 JSON——中文节奏/字数（每页 ≤ 40 字）、英文自然度、教育性、结局温和化、`idiomMeaning`/`moral` 准确性。
3. **生成插图**：为 8 页分别生成插图。先用第 1 页建立角色、服装和材质锚点，后续页面复用同一参考图或等效的身份约束。每页最终 prompt = `imagePromptKit.globalStyle` + `imagePromptKit.characterConsistency` + 该页 `illustrationPrompt` + `imagePromptKit.negative`（流程同 [docs/sample-book-prompts/README.md](../docs/sample-book-prompts/README.md)）。无论使用哪种工具，都必须人工挑选并复核整本角色一致性。
4. **放置图片**：webp、单张 ≤ 300KB，放 `public/library/<seriesId>/<bookId>/<page>.webp`（1-8）。
5. **转正式数据**：把审核后的 `book` 对象搬进 `src/lib/library/<seriesId>.ts`：每页补 `imageUrl: "/library/<seriesId>/<bookId>/<n>.webp"` 与 `imageStatus: "complete"`；确认 `order`；移除 `comingSoon`。
6. **验证**：`npx tsc --noEmit` + `pnpm test`（`tests/library.test.ts` 会校验页数与双语完整性）。

草稿目录 `content-drafts/` 建议提交进 git，便于追溯审核修改。

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
