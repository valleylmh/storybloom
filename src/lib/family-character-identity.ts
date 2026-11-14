import type { AgeGroup, FamilyCharacterInput, StoryInput } from "@/types";

type CharacterLifeStage = "adult" | "child" | "pet" | "unspecified";

export function getFamilyCharacterLifeStage(relationship: string): CharacterLifeStage {
  const role = relationship.trim().toLowerCase();
  if (/^(?:爸爸|妈妈|父亲|母亲|爷爷|奶奶|外公|外婆|姥爷|姥姥|祖父|祖母|叔叔|伯伯|舅舅|姑姑|阿姨|姨妈|dad|daddy|father|mom|mum|mommy|mother|grandpa|grandma|grandfather|grandmother|uncle|aunt)$/.test(role)) {
    return "adult";
  }
  if (/^(?:孩子|儿童|小孩|小朋友|宝宝|儿子|女儿|child|kid|baby|son|daughter)$/.test(role)) return "child";
  if (/^(?:宠物|pet)$/.test(role)) return "pet";
  return "unspecified";
}

export function getDefaultFamilyCharacterAppearance(
  name: string,
  relationship: string,
  readingAgeGroup: AgeGroup = "4-5",
) {
  const stage = getFamilyCharacterLifeStage(relationship);
  const ageDescription = stage === "adult"
    ? "保留本人实际的成年人年龄感、身高、体型和身体比例"
    : stage === "child"
      ? `${readingAgeGroup} 岁年龄感`
      : stage === "pet"
        ? "保留宠物实际年龄感与体型"
        : "保留本人实际年龄感、身高、体型和身体比例";
  return `${name || "主角"}，${relationship || "人物"}，${ageDescription}，保持日常发型、脸型和显著特征，穿舒适简洁的绘本服装`;
}

export function normalizeFamilyCharacterAppearance(
  character: Pick<FamilyCharacterInput, "name" | "relation" | "appearance">,
) {
  const appearance = character.appearance.trim();
  if (getFamilyCharacterLifeStage(character.relation) !== "adult") return appearance;
  // Repair only the old generated default; keep manually supplied appearance facts intact.
  const legacyPrefix = `${character.name}，${character.relation}，`;
  const legacySuffix = /^(?:2-3|4-5|6-8) 岁年龄感，保持日常发型、脸型和显著特征，穿舒适简洁的绘本服装$/;
  if (appearance.startsWith(legacyPrefix) && legacySuffix.test(appearance.slice(legacyPrefix.length))) {
    return getDefaultFamilyCharacterAppearance(character.name, character.relation);
  }
  return appearance;
}

export function getStoryProtagonist(input: Pick<StoryInput, "familyCharacters" | "protagonistFamilyCharacterId" | "childName">) {
  return input.familyCharacters?.find((character) => character.id === input.protagonistFamilyCharacterId)
    || input.familyCharacters?.find((character) => character.isProtagonist)
    || input.familyCharacters?.find((character) => character.name.trim() === input.childName.trim());
}

export function getFamilyCharacterAgeGuidance(
  character: Pick<FamilyCharacterInput, "name" | "relation">,
) {
  if (getFamilyCharacterLifeStage(character.relation) !== "adult") return null;
  return `ADULT IDENTITY LOCK: ${character.name} (${character.relation}) is an adult. Preserve the person's actual adult age, mature facial proportions, adult height, build, and body proportions from the original photo or confirmed description. Do not turn this person into a child, toddler, young boy, or young girl. A cartoon style or a young reading audience never changes the person's age. If a cartoon reference has childlike proportions, the original adult identity and this age lock take priority.`;
}
