export const MAX_FAMILY_CHARACTER_GENERATIONS = 5;

export function normalizeFamilyCharacterGenerationCount(value: unknown) {
  const count = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(count)) return 0;
  return Math.min(
    MAX_FAMILY_CHARACTER_GENERATIONS,
    Math.max(0, Math.trunc(count)),
  );
}

export function getRemainingFamilyCharacterGenerations(value: unknown) {
  return Math.max(
    0,
    MAX_FAMILY_CHARACTER_GENERATIONS -
      normalizeFamilyCharacterGenerationCount(value),
  );
}

export function canGenerateFamilyCharacter(value: unknown) {
  return getRemainingFamilyCharacterGenerations(value) > 0;
}
