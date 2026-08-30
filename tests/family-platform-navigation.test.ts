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
    expect(nav).toContain('label: "成长"');
    expect(nav).toContain('label: "书架"');
    expect(nav).toContain('href: "/#story-creation"');
    expect(nav).toContain("isReaderDetail(pathname)");
  });

  it("gives the home page equal reading and creation entry points", () => {
    const home = source("../src/app/page.tsx");
    const creation = source("../src/components/book/MinimalStoryEntry.tsx");
    expect(home).toContain("今晚读一本");
    expect(creation).toContain("把今天的小事，");
    expect(creation).toContain("写进故事里");
    expect(home).toContain("home-header-mode-toggle");
    expect(creation).toContain("生成绘本并保存为成长记录");
    expect(creation).toContain('role="switch"');
    expect(creation).not.toContain("minimal-home-growth-option");
    expect(home).toContain('href="/library"');
    expect(home).toContain("https://github.com/valleylmh/storybloom");
    expect(home).toContain('id="story-creation"');
    expect(home).not.toContain('href="/me/books"');
    expect(home).not.toContain("home-library-listen");
    expect(home).not.toContain("home-privacy-note");
  });

  it("keeps local and private-cloud guidance in My instead of the homepage", () => {
    const account = source("../src/components/account/AccountOverview.tsx");
    expect(account).toContain("本机与私有云分开管理");
    expect(account).toContain("登录不会自动上传");
    expect(account).toContain("只有你主动选择导入的内容");
  });

  it("shows an illustration or a book-cover placeholder for every recent work", () => {
    const library = source("../src/components/account/LocalStoryLibrary.tsx");
    expect(library).toContain(
      'page.imageStatus === "complete" && isUsableStoryCover(page.imageUrl)',
    );
    expect(library).toContain('!normalized.startsWith("data:image/svg+xml")');
    expect(library).toContain('className="history-cover"');
    expect(library).toContain("<img src={coverImage}");
    expect(library).toContain("<BookOpenText");
  });

  it("uses an in-app mobile-safe confirmation before deleting a recent work", () => {
    const library = source("../src/components/account/LocalStoryLibrary.tsx");
    const styles = source("../src/components/account/Account.module.css");
    expect(library).not.toContain("window.confirm");
    expect(library).toContain('role="alertdialog"');
    expect(library).toContain('aria-modal="true"');
    expect(library).toContain("localStoryRepository.remove(storyId)");
    expect(library).toContain("local-story-delete-not-persisted");
    expect(library).toContain("setDeleteError(copy.deleteError)");
    expect(styles).toContain(".deleteDialogBackdrop");
    expect(styles).toContain("touch-action: manipulation");
    expect(styles).toContain("env(safe-area-inset-bottom)");
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
