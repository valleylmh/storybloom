import { getStoryProtagonist } from "@/lib/family-character-identity";
import type { FamilyCharacterInput, StoryInput, StoryPage } from "@/types";

const RELATIONSHIP_ALIASES = [
  ["爸爸", "父亲", "dad", "daddy", "father", "papa"],
  ["妈妈", "母亲", "妈咪", "mom", "mum", "mommy", "mummy", "mother", "mama"],
  ["爷爷", "祖父", "paternal grandfather", "grandpa", "grandfather", "granddad"],
  ["外公", "姥爷", "maternal grandfather", "grandpa", "grandfather", "granddad"],
  ["奶奶", "祖母", "paternal grandmother", "grandma", "grandmother", "granny"],
  ["外婆", "姥姥", "maternal grandmother", "grandma", "grandmother", "granny"],
  ["哥哥", "兄长", "older brother", "elder brother", "brother"],
  ["弟弟", "younger brother", "little brother", "brother"],
  ["姐姐", "older sister", "elder sister", "sister"],
  ["妹妹", "younger sister", "little sister", "sister"],
  ["叔叔", "paternal uncle", "uncle"],
  ["伯伯", "paternal uncle", "uncle"],
  ["舅舅", "maternal uncle", "uncle"],
  ["姑姑", "paternal aunt", "aunt", "auntie"],
  ["阿姨", "姨妈", "maternal aunt", "aunt", "auntie"],
] as const;

function getRelationshipAliases(relation: string): readonly string[] {
  const normalized = relation.trim().toLowerCase();
  const groups = RELATIONSHIP_ALIASES.filter((aliases) =>
    (aliases as readonly string[]).includes(normalized),
  );
  return groups.length ? [...new Set(groups.flat())] : [normalized];
}

function escapePattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasVisibleMention(text: string, alias: string) {
  if (!alias.trim()) return false;
  const pattern = escapePattern(alias.trim());
  const mention = /[a-z0-9]/i.test(alias)
    ? new RegExp(`(?:^|[^a-z0-9_])${pattern}(?=$|[^a-z0-9_])`, "i")
    : new RegExp(pattern, "i");
  const absent = new RegExp([
    `(?:想念|思念|不画|不含|没有出现的)\\s*(?:我的|他的|她的)?${pattern}`,
    `${pattern}.{0,12}(?:不在家|不在场|不在画面|不出镜|没有出场|未出场)`,
    `\\b(?:without|no|miss(?:es|ing)?|thinking (?:of|about))\\s+(?:(?:his|her|my|the|their)\\s+)?${pattern}`,
    `${pattern}\\s+(?:(?:is|stays?|remains?)\\s+)?(?:away|absent|off[- ]screen|not (?:shown|visible|present))\\b`,
  ].join("|"), "i");

  return text.split(/[。！？!?；;\n，,.]/).some((clause) => {
    if (!mention.test(clause)) return false;
    if (/^\s*(?:no|without)\b/i.test(clause)) return false;
    // A relative shown in a photo, video call, or thought bubble still needs their likeness.
    if (/照片|视频|屏幕|回忆画面|想象泡泡|\b(?:photo|video|screen|thought bubble)\b/i.test(clause)) return true;
    return !absent.test(clause);
  });
}

type PageCast = Pick<StoryPage, "zhText" | "enText" | "illustrationPrompt" | "castIds">;

export function resolveStoryFamilyCast(
  input: StoryInput,
  page: PageCast,
  options: { fromNarration?: boolean } = {},
) {
  const characters = input.familyCharacters ?? [];
  if (characters.length === 0) return [];
  const allowedIds = new Set(characters.map((character) => character.id));
  const cast = new Set(
    options.fromNarration ? [] : (page.castIds ?? []).filter((id) => allowedIds.has(id)),
  );
  const protagonist = getStoryProtagonist(input);
  if (protagonist) cast.add(protagonist.id);
  const narration = `${page.zhText || ""}\n${page.enText || ""}`;
  const scene = options.fromNarration ? narration : page.illustrationPrompt || "";
  const aliases = new Map<string, FamilyCharacterInput[]>();

  for (const character of characters) {
    for (const alias of new Set([character.name.trim().toLowerCase(), ...getRelationshipAliases(character.relation)])) {
      if (alias) aliases.set(alias, [...(aliases.get(alias) ?? []), character]);
    }
  }
  for (const [alias, candidates] of aliases) {
    if (!hasVisibleMention(scene, alias)) continue;
    if (candidates.length === 1) {
      cast.add(candidates[0].id);
      continue;
    }
    // A generic "Dad" must not arbitrarily select one of several saved fathers.
    const named = candidates.filter((character) =>
      !getRelationshipAliases(character.relation).includes(character.name.trim().toLowerCase()) &&
      hasVisibleMention(narration, character.name),
    );
    if (named.length === 1) cast.add(named[0].id);
  }
  if (["爸妈", "父母", "parents"].some((alias) => hasVisibleMention(scene, alias))) {
    for (const relation of ["爸爸", "妈妈"]) {
      const candidates = characters.filter((character) => getRelationshipAliases(character.relation).includes(relation));
      if (candidates.length === 1) cast.add(candidates[0].id);
    }
  }
  return [...cast];
}
