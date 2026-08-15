import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/library/personalization/route";
import {
  getLibraryPersonalizationContext,
  getLibraryStorySpecByContentId,
} from "@/lib/library/personalization";

describe("library story personalization", () => {
  it("builds a bounded StorySpec from the maintained library source", () => {
    const spec = getLibraryStorySpecByContentId(
      "xiyouji/shi-hou-chu-shi",
    );

    expect(spec).toMatchObject({
      version: 1,
      sourceLibraryBookId: "xiyouji/shi-hou-chu-shi",
      sourceTitle: "石猴出世",
      sourceSeriesTitle: "西游记",
      sourceSeriesOrder: 1,
      ageGroup: "4-5",
    });
    expect(spec?.storyBeats).toHaveLength(8);
    expect(spec?.storyBeats[0].narrativeBeat).toContain("花果山");
    expect(spec?.replaceableRoles).toContain("孩子主角");
  });

  it("does not invent a context for unknown or malformed content ids", () => {
    expect(getLibraryStorySpecByContentId("missing/book")).toBeNull();
    expect(getLibraryStorySpecByContentId("xiyouji/../../secret")).toBeNull();
  });

  it("serves only public StorySpec data to the creation flow", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/library/personalization?book=chengyu/shou-zhu-dai-tu",
      ),
    );
    const body = (await response.json()) as ReturnType<
      typeof getLibraryPersonalizationContext
    >;

    expect(response.status).toBe(200);
    expect(body?.storySpec.sourceTitle).toBe("守株待兔");
    expect(body?.suggestedPrompt).toContain("用我家的角色重新讲");
    expect(response.headers.get("cache-control")).toContain("max-age=300");
  });
});
