import type {
  GrowthRecord,
  GrowthRecordDraft,
  GrowthRecordPhoto,
} from "@/lib/growth-records";
import type { GenerateResponse } from "@/types";

export interface GrowthRecordInput {
  clientRecordId: string;
  childProfileId?: string;
  savedStoryId?: string;
  story: GenerateResponse;
  draft: GrowthRecordDraft;
}

export interface GrowthRecordPatch {
  occurredOn?: string;
  note?: string;
  idea?: string;
  savedStoryId?: string | null;
  story?: GenerateResponse;
  photos?: GrowthRecordPhoto[];
}

export interface GrowthRepository {
  list(): Promise<GrowthRecord[]>;
  getByChild(childId: string): Promise<GrowthRecord[]>;
  save(input: GrowthRecordInput): Promise<GrowthRecord>;
  update(id: string, patch: GrowthRecordPatch): Promise<GrowthRecord>;
  remove(id: string): Promise<void>;
}

export function createGrowthRecordInput(
  story: GenerateResponse,
  draft: GrowthRecordDraft,
  options: {
    clientRecordId?: string;
    childProfileId?: string;
    savedStoryId?: string;
  } = {},
): GrowthRecordInput {
  return {
    clientRecordId: options.clientRecordId || story.storyId,
    childProfileId: options.childProfileId,
    savedStoryId: options.savedStoryId,
    story,
    draft,
  };
}
