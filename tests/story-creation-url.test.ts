import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import {
  legacyStoryCreationRedirect,
  readStoryCreationParameters,
  storyCreationHref,
  withStoryCreationMode,
} from "@/lib/story-creation-url";

const ORIGIN = "https://storybloom.valleylmh.vip";

describe("canonical creation links", () => {
  it("keeps bilingual inspiration presets out of the HTTP query and preserves text", () => {
    const idea = "孩子问：月亮为什么跟着我走？ & A new friend + a little hope #1";
    for (const locale of ["zh", "en"] as const) {
      const url = new URL(storyCreationHref({ locale, idea }), ORIGIN);
      expect(url.pathname).toBe(locale === "en" ? "/en" : "/");
      expect(url.search).toBe("");
      expect(readStoryCreationParameters(url).get("idea")).toBe(idea);
      expect(readStoryCreationParameters(url).get("mode")).toBe("minimal");
    }
  });

  it("preserves the selected library book in a shareable, reloadable fragment", () => {
    const url = new URL(storyCreationHref({ personalize: "chengyu/shou-zhu-dai-tu" }), ORIGIN);
    expect(url.search).toBe("");
    expect(readStoryCreationParameters(new URL(url.href)).get("personalize")).toBe("chengyu/shou-zhu-dai-tu");
  });

  it("permanently redirects legacy presets to the clean homepage without dropping them", () => {
    for (const path of ["/", "/en"]) {
      const source = new URL(path, ORIGIN);
      source.searchParams.set("mode", "minimal");
      source.searchParams.set("idea", "遇见小蜗牛 & a friend");
      source.searchParams.set("personalize", "haoqi/yue-liang-wei-shen-me-gen-zhe-wo-zou");
      const response = middleware(new NextRequest(source));
      expect(response.status).toBe(308);
      const target = new URL(response.headers.get("location")!);
      expect(target.origin).toBe(ORIGIN);
      expect(target.pathname).toBe(path);
      expect(target.search).toBe("");
      for (const [key, value] of source.searchParams) {
        expect(readStoryCreationParameters(target).get(key)).toBe(value);
      }
      // Fragments are not sent on the next HTTP request: it must not redirect again.
      target.hash = "";
      expect(middleware(new NextRequest(target)).status).toBe(200);
    }
  });

  it("also consolidates old preset links that omitted the mode", () => {
    const source = new URL("/?personalize=chengyu%2Fshou-zhu-dai-tu", ORIGIN);
    const target = legacyStoryCreationRedirect(source)!;
    expect(target.search).toBe("");
    expect(readStoryCreationParameters(target).get("personalize")).toBe("chengyu/shou-zhu-dai-tu");
    expect(readStoryCreationParameters(target).get("mode")).toBe("minimal");
  });

  it.each([
    "/", "/en", "/?mode=full", "/?mode=capture",
    "/?mode=minimal&book=saved-book", "/?mode=minimal&continue=previous-book",
    "/?mode=minimal&view=generating&taskId=active-task", "/?mode=minimal&growthVersion=existing",
    "/?mode=minimal&utm_source=newsletter", "/?code=auth-code",
    "/library?idea=hello", "/en/library?mode=minimal",
  ])("leaves saved work, account flows and unrelated routes intact: %s", (path) => {
    expect(legacyStoryCreationRedirect(new URL(path, ORIGIN))).toBeNull();
  });

  it("switches creation modes without restoring duplicate HTTP parameters", () => {
    const source = new URL(storyCreationHref({ idea: "A quiet adventure" }), ORIGIN);
    const capture = withStoryCreationMode(source, "capture");
    expect(readStoryCreationParameters(capture).get("mode")).toBeNull();
    const full = withStoryCreationMode(capture, "full");
    expect(readStoryCreationParameters(full).get("mode")).toBe("full");
    expect(readStoryCreationParameters(full).get("idea")).toBe("A quiet adventure");
    expect(full.search).toBe("");
  });

  it("continues to read legacy query URLs and their private story state", () => {
    const url = new URL("/?mode=minimal&book=saved-book&idea=Original#story-creation?idea=Fragment", ORIGIN);
    const parameters = readStoryCreationParameters(url);
    expect(parameters.get("book")).toBe("saved-book");
    expect(parameters.get("idea")).toBe("Original");
    expect(withStoryCreationMode(url, "full").searchParams.get("book")).toBe("saved-book");
  });
});
