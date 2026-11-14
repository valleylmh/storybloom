import { describe, expect, it } from "vitest";
import {
  getDefaultFamilyCharacterAppearance,
  getFamilyCharacterAgeGuidance,
  getFamilyCharacterLifeStage,
  getStoryProtagonist,
  normalizeFamilyCharacterAppearance,
} from "@/lib/family-character-identity";

describe("family character identity", () => {
  it.each(["爸爸", "妈妈", "爷爷", "外婆", "Father", "Mother", "Grandpa"])(
    "preserves %s as an adult regardless of reading age",
    (relation) => {
      const appearance = getDefaultFamilyCharacterAppearance("家人", relation, "2-3");
      expect(getFamilyCharacterLifeStage(relation)).toBe("adult");
      expect(appearance).toContain("成年人");
      expect(appearance).not.toContain("2-3 岁");
      expect(getFamilyCharacterAgeGuidance({ name: "家人", relation })).toContain("ADULT IDENTITY LOCK");
    },
  );

  it("keeps reading-stage defaults for children and avoids applying them to pets or unknown roles", () => {
    expect(getDefaultFamilyCharacterAppearance("童童", "孩子", "6-8")).toContain("6-8 岁年龄感");
    expect(getDefaultFamilyCharacterAppearance("豆豆", "宠物", "4-5")).not.toContain("4-5 岁");
    expect(getDefaultFamilyCharacterAppearance("小林", "朋友", "4-5")).not.toContain("4-5 岁");
    expect(getFamilyCharacterAgeGuidance({ name: "童童", relation: "孩子" })).toBeNull();
  });

  it("repairs the legacy generated adult appearance without rewriting manually supplied facts", () => {
    const legacy = "童童爸，爸爸，4-5 岁年龄感，保持日常发型、脸型和显著特征，穿舒适简洁的绘本服装";
    const fixed = normalizeFamilyCharacterAppearance({ name: "童童爸", relation: "爸爸", appearance: legacy });
    expect(fixed).toContain("成年人");
    expect(fixed).not.toContain("4-5 岁");
    const manual = "38岁，戴黑框眼镜、短发、身材高大";
    expect(normalizeFamilyCharacterAppearance({ name: "童童爸", relation: "爸爸", appearance: manual })).toBe(manual);
  });

  it("resolves the explicitly selected adult before a different child's protagonist flag", () => {
    const father = { id: "dad", name: "童童爸", relation: "爸爸", appearance: "成年人" };
    expect(getStoryProtagonist({
      childName: "童童爸", protagonistFamilyCharacterId: "dad",
      familyCharacters: [{ id: "child", name: "童童", relation: "孩子", appearance: "五岁", isProtagonist: true }, father],
    })).toBe(father);
  });
});
