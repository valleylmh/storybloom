import { describe, expect, it } from "vitest";
import { resolveStoryFamilyCast } from "@/lib/story-family-cast";
import { rebuildStoryPagesFromOutline } from "@/lib/story-outline-server";
import { buildStoryVisualBible } from "@/lib/story-visual-bible";
import type { FamilyCharacterInput, StoryInput, StoryPage } from "@/types";

const family: FamilyCharacterInput[] = [
  { id: "child", name: "童童", relation: "孩子", appearance: "五岁短发孩子", isProtagonist: true },
  { id: "dad", name: "童童爸", relation: "爸爸", appearance: "戴眼镜的成年爸爸", sourceReferenceAssetPath: "user/dad/source.webp" },
  { id: "mom", name: "童童妈", relation: "妈妈", appearance: "长发成年妈妈", canonicalReferenceAssetPath: "user/mom/canonical.png" },
  { id: "grandma", name: "奶奶", relation: "奶奶", appearance: "白发奶奶" },
];
const input: StoryInput = {
  childName: "童童", protagonistFamilyCharacterId: "child", ageGroup: "4-5",
  theme: "custom", customTheme: "和家人一起做早餐", style: "fairytale", language: "zh-en", familyCharacters: family,
};
const page: StoryPage = {
  page: 1, zhText: "我和爸爸妈妈做早餐。", enText: "I make breakfast with Dad and Mom.",
  illustrationPrompt: "", castIds: ["child"],
};

describe("saved family cast matching", () => {
  it.each([
    "童童在厨房和爸爸、妈妈一起做早餐。",
    "Tongtong and Father prepare breakfast while Mother holds the plates.",
    "童童和爸妈在厨房做早餐。",
    "A child makes breakfast with his parents.",
  ])("reuses the saved parents when the scene says %s", (illustrationPrompt) => {
    expect(resolveStoryFamilyCast(input, { ...page, illustrationPrompt })).toEqual(["child", "dad", "mom"]);
  });

  it("keeps relatives out of a solo scene even when narration mentions them", () => {
    expect(resolveStoryFamilyCast(input, {
      ...page, illustrationPrompt: "Tongtong plays alone in his room.",
      zhText: "爸爸妈妈不在家，我自己玩积木。", enText: "I miss Dad and Mom.",
    })).toEqual(["child"]);
    expect(resolveStoryFamilyCast(input, {
      ...page, illustrationPrompt: "Tongtong plays alone; Dad is away; Mom is not visible.",
    })).toEqual(["child"]);
    expect(resolveStoryFamilyCast(input, {
      ...page, illustrationPrompt: "Tongtong plays alone. No Dad or Mom in the image.",
    })).toEqual(["child"]);
  });

  it("uses a saved likeness for a relative visible on a video call", () => {
    expect(resolveStoryFamilyCast(input, {
      ...page, illustrationPrompt: "Tongtong waves to Dad on a video call screen.",
    })).toEqual(["child", "dad"]);
  });

  it("does not substitute a father for a grandfather or a mother for a grandmother", () => {
    const extendedInput = { ...input, familyCharacters: [...family,
      { id: "grandpa", name: "爷爷", relation: "爷爷", appearance: "白发爷爷" },
    ] };
    expect(resolveStoryFamilyCast(extendedInput, {
      ...page, illustrationPrompt: "Grandfather and Grandmother read with Tongtong.",
    })).toEqual(["child", "grandma", "grandpa"]);
  });

  it("does not guess between two saved fathers unless a name disambiguates them", () => {
    const twoFathers = { ...input, familyCharacters: [...family,
      { id: "other-dad", name: "小满爸", relation: "爸爸", appearance: "短发爸爸" },
    ] };
    const scene = { ...page, zhText: "我在花园玩。", enText: "I play in the garden.", illustrationPrompt: "A child plants flowers with Dad." };
    expect(resolveStoryFamilyCast(twoFathers, scene)).toEqual(["child"]);
    expect(resolveStoryFamilyCast(twoFathers, { ...scene, zhText: "童童爸陪我种花。" })).toEqual(["child", "dad"]);
  });

  it("matches a saved person by name without inventing an unsaved id", () => {
    const withTeacher = { ...input, familyCharacters: [...family,
      { id: "teacher", name: "陈老师", relation: "老师", appearance: "短发老师" },
    ] };
    expect(resolveStoryFamilyCast(withTeacher, {
      ...page, castIds: ["child", "invented"], illustrationPrompt: "童童请陈老师帮忙搭积木。",
    })).toEqual(["child", "teacher"]);
  });
});

describe("family cast after outline edits", () => {
  it("replaces old companions and their visual locks when the parent changes the page text", () => {
    const original = { ...page, illustrationPrompt: "Mother reads with Tongtong.", castIds: ["child", "mom"] };
    const [result] = rebuildStoryPagesFromOutline({ ...input, visualBible: buildStoryVisualBible(input) }, [original], [{
      page: 1, zhText: "我和爸爸在厨房做早餐。", enText: "I make breakfast with Dad in the kitchen.",
    }]);
    expect(result.castIds).toEqual(["child", "dad"]);
    expect(result.illustrationPrompt).toContain("童童爸 (爸爸, id=dad)");
    expect(result.illustrationPrompt).not.toContain("童童妈");
    expect(original.castIds).toEqual(["child", "mom"]);
  });

  it("removes an old companion when the new text only mentions an absent parent", () => {
    const [result] = rebuildStoryPagesFromOutline(input, [{ ...page, castIds: ["child", "mom"] }], [{
      page: 1, zhText: "爸爸不在家，我自己玩积木。", enText: "I miss Dad. I play with blocks alone.",
    }]);
    expect(result.castIds).toEqual(["child"]);
  });
});
