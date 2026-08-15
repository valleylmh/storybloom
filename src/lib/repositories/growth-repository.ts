import type {
  GrowthRecord,
  GrowthRecordDraft,
  GrowthRecordPhoto,
} from "@/lib/growth-records";
import type {
  GrowthMomentBundle,
  StorybookVersionCreateOptions,
} from "@/lib/growth-moments";
import type { GenerateResponse } from "@/types";

export interface GrowthRecordInput {
  clientRecordId: string;
  childProfileId?: string;
  savedStoryId?: string;
  /** Stable UUID allocated before the growth record upload starts. */
  preferredCloudId?: string;
  /** Stable UUID for the linked story when it is imported with the record. */
  preferredStoryCloudId?: string;
  /** Active local StorybookVersion id mirrored only after explicit import. */
  clientVersionId?: string;
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
  /** Advanced Moment operations remain optional; explicit cloud imports dual-write separately. */
  moments?: GrowthMomentRepository;
}

export interface GrowthMomentRepository {
  list(): Promise<GrowthMomentBundle[]>;
  get(id: string): Promise<GrowthMomentBundle | undefined>;
  addVersion(
    momentId: string,
    story: GenerateResponse,
    options?: StorybookVersionCreateOptions,
  ): Promise<GrowthMomentBundle>;
  selectVersion(momentId: string, versionId: string): Promise<GrowthMomentBundle>;
  removeVersion(momentId: string, versionId: string): Promise<GrowthMomentBundle>;
  clearOriginalAssets(momentId: string): Promise<GrowthMomentBundle>;
  removeMoment(momentId: string): Promise<void>;
  removeMoments(momentIds: readonly string[]): Promise<string[]>;
  clearAll(): Promise<void>;
}

export function createGrowthRecordInput(
  story: GenerateResponse,
  draft: GrowthRecordDraft,
  options: {
    clientRecordId?: string;
    childProfileId?: string;
    savedStoryId?: string;
    preferredCloudId?: string;
    preferredStoryCloudId?: string;
    clientVersionId?: string;
  } = {},
): GrowthRecordInput {
  return {
    clientRecordId: options.clientRecordId || story.storyId,
    childProfileId: options.childProfileId,
    savedStoryId: options.savedStoryId,
    preferredCloudId: options.preferredCloudId,
    preferredStoryCloudId: options.preferredStoryCloudId,
    clientVersionId: options.clientVersionId,
    story,
    draft,
  };
}
