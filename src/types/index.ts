import type { GenerationErrorClass } from "@/lib/generation-error";

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
export type GrowthStoryTreatment =
  | "documentary"
  | "warm-imagination"
  | "fairytale";
export type GenerationMode = "live" | "demo";
export type StoryStatus =
  | "pending"
  | "generating_text"
  | "reviewing_outline"
  | "generating_images"
  | "partially_failed"
  | "complete"
  | "failed"
  | "unrecoverable";
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

export interface LibraryStoryBeat {
  page: number;
  narrativeBeat: string;
  scene: string;
}

export interface LibraryStorySpec {
  version: 1;
  sourceLibraryBookId: string;
  sourceTitle: string;
  sourceSeriesId: string;
  sourceSeriesTitle: string;
  sourceSeriesOrder?: number;
  category: string;
  ageGroup: AgeGroup;
  theme: string;
  tone: string;
  storyBeats: LibraryStoryBeat[];
  replaceableRoles: string[];
  tags: string[];
}

export interface PersonalizationAnchorConfirmation {
  version: 1;
  displayName: string;
  relationship: string;
  appearance: string;
  referenceType: "canonical" | "source" | "text";
  characterId?: string;
  storyReferenceToken?: string;
  confirmedAt: string;
}

export type PersonalizationAnchorStatus =
  | "pending"
  | "preview"
  | "confirmed"
  | "failed";

export interface PersonalizationDraft {
  id: string;
  userId?: string;
  anonymousId?: string;
  sourceLibraryBookId: string;
  sourceTitle: string;
  selectedCharacterIds: string[];
  selectedStyle: IllustrationStyle;
  storySettings: {
    prompt: string;
    ageGroup: AgeGroup;
  };
  anchorStatus: PersonalizationAnchorStatus;
  anchor?: PersonalizationAnchorConfirmation;
  generationJobId?: string;
  generatedStoryId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SampleImageAssets {
  placeholder: string;
  variants: Record<SampleImageModel, string>;
}

export interface ImageAttemptMetric {
  provider: ImageProvider;
  model?: string;
  status: ImageAttemptStatus;
  requestAttempt?: number;
  retry?: boolean;
  qualityStatus?: IllustrationQualityStatus;
  durationMs: number;
  startedAt: string;
  completedAt: string;
  error?: string;
  errorClass?: GenerationErrorClass;
}

export type IllustrationQualityStatus = "passed" | "warning" | "demo";
export type IllustrationQualityWarning =
  | "low-resolution"
  | "low-detail"
  | "low-sharpness";

export interface IllustrationQualityReport {
  version: 1;
  status: IllustrationQualityStatus;
  width: number;
  height: number;
  format: string;
  bytes: number;
  entropy?: number;
  sharpness?: number;
  warnings?: IllustrationQualityWarning[];
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
  /** Parent-confirmed facts for a real family moment. */
  parentFacts?: string;
  /** Imaginative additions explicitly allowed by the parent. */
  allowedImaginations?: string;
  /** How closely a growth story should stay to the real event. */
  storyTreatment?: GrowthStoryTreatment;
  style: IllustrationStyle;
  language: Language;
  characterReferenceId?: string;
  characterReferenceLabel?: string;
  characterReferencePrompt?: string;
  customCharacterReferenceToken?: string;
  characterDescription?: string;
  dedication?: string;
  sourceLibraryBookId?: string;
  personalizationDraftId?: string;
  personalizationAnchor?: PersonalizationAnchorConfirmation;
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
  /** Opaque server-side claim used to reject late or duplicate workers. */
  imageAttemptId?: string;
  /**
   * Marks a page as owned by the durable generation queue. This remains true
   * when enqueue acknowledgement is ambiguous and no job id is available yet.
   */
  imageDurableJob?: boolean;
  /** Opaque durable job pointer used only for authoritative status polling. */
  imageJobId?: string;
  imageCompletedAt?: string;
  imageDurationMs?: number;
  imageRequestCount?: number;
  imageRetryCount?: number;
  imageAttempts?: ImageAttemptMetric[];
  imageQuality?: IllustrationQualityReport;
  sampleImage?: SampleImageAssets;
}

export interface GeneratedStory {
  id: string;
  /** Opaque HMAC-derived principal ids allowed to access this cached story. */
  generationPrincipalIds?: string[];
  /** Internal durable text publication identity; omitted from public responses. */
  textGenerationJobId?: string;
  textGenerationJobAttempt?: number;
  input: StoryInput;
  pages: StoryPage[];
  coverTitle: string;
  createdAt: string;
  /** Optional for backward compatibility with snapshots created before CAS. */
  updatedAt?: string;
  /** Monotonic server-side revision for atomic shared-cache mutations. */
  revision?: number;
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
  /** Remaining daily free generations after reserving this generation. */
  freeGenerationsRemaining?: number;
  freeGenerationsLimit?: number;
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
