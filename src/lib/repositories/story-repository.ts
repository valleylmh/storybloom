import type {
  StoryHistoryRecord,
  StoryHistoryStatus,
} from "@/lib/client-history";
import type { GenerateResponse } from "@/types";

export interface StoryAssetEntry {
  page: number | "cover";
  storagePath: string;
  mimeType: "image/webp";
}

export interface StoryAssetManifest {
  version: 1;
  pages: StoryAssetEntry[];
}

export interface SavedStory extends StoryHistoryRecord {
  id: string;
  clientStoryId: string;
  childProfileId?: string;
  assetManifest: StoryAssetManifest;
}

export interface StorySaveInput {
  result: GenerateResponse;
  childProfileId?: string | null;
  status?: StoryHistoryStatus;
  /** Stable UUID allocated by the import controller before any asset upload. */
  preferredCloudId?: string;
}

export interface StoryPatch {
  result?: GenerateResponse;
  childProfileId?: string | null;
  status?: StoryHistoryStatus;
}

export interface StoryRepository {
  list(): Promise<SavedStory[]>;
  get(id: string): Promise<SavedStory | undefined>;
  save(input: StorySaveInput): Promise<SavedStory>;
  update(id: string, patch: StoryPatch): Promise<SavedStory>;
  remove(id: string): Promise<void>;
}
