# StoryBloom 内容生产脚本

## generate-library-book.ts — 绘本馆书籍草稿生成

为 `/library` 绘本馆（见 [docs/feature-roadmap-tasks.md](../docs/feature-roadmap-tasks.md) 任务 A2）生成单本书的**草稿 JSON**。

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
3. **生成插图**：8 页插图。由 Codex 执行时，必须调用内置生图工具，每页单独生成；先用第 1 页建立角色锚点，后续页面引用该图锁定人物与画风，不调用项目运行时的外部图片 API。每页最终 prompt = `imagePromptKit.globalStyle` + `imagePromptKit.characterConsistency` + 该页 `illustrationPrompt` + `imagePromptKit.negative`（流程同 [docs/sample-book-prompts/README.md](../docs/sample-book-prompts/README.md)）。人工挑选角色一致性最好的一组。
4. **放置图片**：webp、单张 ≤ 300KB，放 `public/library/<seriesId>/<bookId>/<page>.webp`（1-8）。
5. **转正式数据**：把审核后的 `book` 对象搬进 `src/lib/library/<seriesId>.ts`：每页补 `imageUrl: "/library/<seriesId>/<bookId>/<n>.webp"` 与 `imageStatus: "complete"`；确认 `order`；移除 `comingSoon`。
6. **验证**：`npx tsc --noEmit` + `npm test`（`tests/library.test.ts` 会校验页数与双语完整性）。

草稿目录 `content-drafts/` 建议提交进 git，便于追溯审核修改。
