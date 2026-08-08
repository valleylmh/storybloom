export type AgeGroup = "2-3" | "4-5" | "6-8";
export type StoryTheme =
  | "courage"
  | "friendship"
  | "nature"
  | "family"
  | "fear"
  | "creativity"
  | "custom";
export type IllustrationStyle = "watercolor" | "cartoon" | "fairytale";
export type Language = "zh-en" | "en-zh" | "zh" | "en";
export type GenerationMode = "live" | "demo";
export type StoryStatus =
  | "pending"
  | "generating_text"
  | "generating_images"
  | "complete"
  | "failed";
export type ImageStatus = "pending" | "complete" | "demo" | "failed";
export type ImageProvider =
  | "dashscope"
  | "cloudflare"
  | "pollinations"
  | "huggingface"
  | "agnes"
  | "cpa";
export type ImageAttemptStatus = "success" | "failed";
export type SampleImageModel = "gpt-image-2" | "nano-banana";

export interface SampleImageAssets {
  placeholder: string;
  variants: Record<SampleImageModel, string>;
}

export interface ImageAttemptMetric {
  provider: ImageProvider;
  status: ImageAttemptStatus;
  durationMs: number;
  startedAt: string;
  completedAt: string;
  error?: string;
}

export interface FamilyCharacterInput {
  id: string;
  name: string;
  relation: string;
  appearance: string;
  /** @deprecated Use the role-specific reference paths below when available. */
  referenceAssetPath?: string;
  sourceReferenceAssetPath?: string;
  canonicalReferenceAssetPath?: string;
  storyReferenceToken?: string;
  isProtagonist?: boolean;
}

export interface StoryCharacterVisualLock {
  id: string;
  name: string;
  identityLock: string;
  outfitLock: string;
  referenceGuidance: string;
}

export interface StoryVisualBible {
  version: 1;
  seriesStyleLock: string;
  paletteLock: string;
  continuityPolicy: string;
  characters: StoryCharacterVisualLock[];
}

export interface StoryInput {
  childName: string;
  narrativePerspective?: "third-person" | "first-person";
  protagonistFamilyCharacterId?: string;
  ageGroup: AgeGroup;
  favoriteToy?: string;
  favoriteFood?: string;
  bestFriend?: string;
  otherDetails?: string;
  theme: StoryTheme;
  customTheme?: string;
  style: IllustrationStyle;
  language: Language;
  characterReferenceId?: string;
  characterReferenceLabel?: string;
  characterReferencePrompt?: string;
  customCharacterReferenceToken?: string;
  characterDescription?: string;
  dedication?: string;
  familyCharacters?: FamilyCharacterInput[];
  visualBible?: StoryVisualBible;
}

export interface StoryPage {
  page: number;
  zhText: string;
  enText: string;
  illustrationPrompt: string;
  castIds?: string[];
  imageUrl?: string;
  imageStatus?: ImageStatus;
  imageError?: string;
  imagePlannedProvider?: ImageProvider;
  imageProvider?: ImageProvider;
  imageStartedAt?: string;
  imageCompletedAt?: string;
  imageDurationMs?: number;
  imageAttempts?: ImageAttemptMetric[];
  sampleImage?: SampleImageAssets;
}

export interface GeneratedStory {
  id: string;
  input: StoryInput;
  pages: StoryPage[];
  coverTitle: string;
  createdAt: string;
  status: StoryStatus;
  generationMode: GenerationMode;
}

export interface NarrationAudioAsset {
  url: string;
  model: string;
  voice: string;
  format: "mp3" | "wav" | "pcm";
}

export interface GenerateResponse {
  storyId: string;
  input: StoryInput;
  coverTitle: string;
  pages: StoryPage[];
  totalPages: number;
  generationMode: GenerationMode;
  freeChanceLabel: string;
  imagesPending?: boolean;
  narrationAudio?: NarrationAudioAsset;
}

export interface GenerateErrorResponse {
  error: string;
  stage?: Extract<StoryStatus, "generating_text" | "generating_images" | "failed">;
  failedPages?: number[];
  imageErrors?: Array<{ page: number; error: string }>;
  retryable?: boolean;
}
