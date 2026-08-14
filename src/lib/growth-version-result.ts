import type { GrowthRecordDraft } from "@/lib/growth-records";
import type { GrowthMomentRepository } from "@/lib/repositories/growth-repository";
import type { GenerateResponse } from "@/types";

type GrowthVersionDestinationRepository = Pick<
  GrowthMomentRepository,
  "get" | "addVersion"
>;

export async function appendGeneratedStorybookVersion(input: {
  repository: GrowthVersionDestinationRepository;
  targetMomentId: string;
  growthRecordDraft: GrowthRecordDraft;
  result: GenerateResponse;
}) {
  const target = await input.repository.get(input.targetMomentId);
  if (!target) throw new Error("growth-version-target-not-found");
  if (target.moment.childKey !== input.growthRecordDraft.childKey) {
    throw new Error("growth-version-target-mismatch");
  }

  return input.repository.addVersion(input.targetMomentId, input.result, {
    storyTreatment: input.growthRecordDraft.storyTreatment,
    characterReferenceId: input.growthRecordDraft.childCharacterId,
    source: "generated",
  });
}
