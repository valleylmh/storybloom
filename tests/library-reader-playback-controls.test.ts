import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import ts from "typescript";
import type Reader from "../src/components/library/LibraryBookReader";

// The app preserves JSX for Next; compile this isolated render fixture for Node.
const compiled = ts.transpileModule(readFileSync("src/components/library/LibraryBookReader.tsx", "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const componentModule = { exports: {} as { default: typeof Reader } };
const requireModule = createRequire(import.meta.url);
const icon = () => createElement("svg");
new Function("require", "module", "exports", compiled)(
  (id: string) => id === "@phosphor-icons/react" ? { CaretLeft: icon, CaretRight: icon, X: icon } : requireModule(id),
  componentModule, componentModule.exports,
);
const LibraryBookReader = componentModule.exports.default;
import type { StoryPage } from "../src/types";

const pages: StoryPage[] = [1, 2].map(page => ({ page, zhText: "你好", enText: "Hello", imageStatus: "complete", imageUrl: "/test.webp" }));

describe("reader playback controls", () => {
  it("hides overlaid arrows during playback while retaining page tabs", () => {
    const html = renderToStaticMarkup(createElement(LibraryBookReader, { title: "测试", pages, accent: "#fff", playbackActive: true }));
    expect(html).toMatch(/class="book-nav-btn book-nav-prev" hidden=""/);
    expect(html).toMatch(/class="book-nav-btn book-nav-next" hidden=""/);
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="跳到第 2 页');
  });
  it("restores arrows when playback is inactive", () => {
    const html = renderToStaticMarkup(createElement(LibraryBookReader, { title: "测试", pages, accent: "#fff", playbackActive: false }));
    expect(html).not.toMatch(/class="book-nav-btn book-nav-(prev|next)" hidden/);
  });
  it("restarts from the first page only after controlled page and mode synchronize", () => {
    const source = readFileSync("src/components/library/LibraryNarrationToolbar.tsx", "utf8");
    const restart = source.split("const restartBook =")[1].split("const handlePrimaryAction")[0];
    expect(restart).toContain("cancelCurrentSession()");
    expect(restart).toContain("initialPositionConsumedRef.current = true");
    expect(restart).toContain("onPageIndexChange(0)");
    expect(source).toContain("!restartBookPendingRef.current || currentPageIndex !== 0 || !turnModeActive");
  });
  it("only offers published series books and resets the player when switching books", () => {
    const source = readFileSync("src/app/library/[seriesId]/[bookId]/page.tsx", "utf8");
    expect(source).toContain("seriesBooks.filter((item) => !item.comingSoon)");
    expect(source).toContain('key={`${series.id}/${book.id}`}');
  });
});
