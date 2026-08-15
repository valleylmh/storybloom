import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
}

describe("family story platform navigation", () => {
  it("keeps the three primary destinations explicit", () => {
    const nav = source("../src/components/layout/FamilyPlatformNav.tsx");
    expect(nav).toContain('label: "绘本馆"');
    expect(nav).toContain('label: "创作"');
    expect(nav).toContain('label: "书架"');
    expect(nav).toContain("isReaderDetail(pathname)");
  });

  it("gives the home page equal reading and creation entry points", () => {
    const home = source("../src/app/page.tsx");
    expect(home).toContain("今晚读一本");
    expect(home).toContain("给孩子做一本");
    expect(home).toContain('href="/library"');
    expect(home).toContain('id="story-creation"');
  });

  it("requires an explicit action before account reading sync", () => {
    const sync = source(
      "../src/components/library/ReadingSyncControl.tsx",
    );
    expect(sync).toContain("不会因为登录自动上传");
    expect(sync).toContain("合并并开启同步");
    expect(sync).toContain("setReadingSyncEnabled(true)");
  });

  it("connects a library book to character selection and Anchor confirmation", () => {
    const detail = source(
      "../src/app/library/[seriesId]/[bookId]/page.tsx",
    );
    const creation = source(
      "../src/components/book/MinimalStoryEntry.tsx",
    );
    const preview = source("../src/components/book/BookPreview.tsx");
    expect(detail).toContain("personalize=");
    expect(detail).toContain("让孩子成为故事主角");
    expect(creation).toContain("确认孩子在这个故事里的形象");
    expect(creation).toContain("确认并生成专属版");
    expect(creation).toContain("sourceLibraryBookId");
    expect(preview).toContain("查看原始馆藏故事");
  });
});
