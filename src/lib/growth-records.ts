import type {
  AgeGroup,
  GenerateResponse,
  GrowthStoryTreatment,
} from "@/types";
import { materializeTemporaryStoryImages } from "@/lib/client-images";
import {
  hasValidOptionalGrowthAssetMetadata,
  normalizeAndDedupeGrowthAssets,
  sumGrowthAssetDataUrlBytes,
  type GrowthAssetMimeType,
} from "@/lib/growth-asset-metadata";
import {
  assertGrowthStorageCapacity,
  estimateGrowthStorageCapacity,
  GrowthStorageError,
  toGrowthStorageError,
} from "@/lib/growth-storage-capacity";
import {
  addStorybookVersion,
  clearGrowthMomentOriginalAssets,
  createGrowthMoment,
  createStorybookVersion,
  isGrowthMoment,
  isStorybookVersion,
  migrateLegacyGrowthRecord,
  projectGrowthMomentBundle,
  removeStorybookVersion,
  selectActiveStorybookVersion,
  type GrowthMomentBundle,
  type StorybookVersion,
  type StorybookVersionCreateOptions,
} from "@/lib/growth-moments";

const DB_NAME = "storybloom-growth-records";
const DB_VERSION = 1;
const STORE_NAME = "records";
const MOMENT_ENVELOPE_PREFIX = "moment:";
const STORYBOOK_ENVELOPE_PREFIX = "storybook:";
const ENVELOPE_VERSION = 1 as const;

export const MAX_GROWTH_CONFIRMATION_LENGTH = 300;

export interface GrowthStoryContext {
  /** Reading level selected for this real-life moment. */
  readingStage?: AgeGroup;
  /** How closely the generated story should stay to the real event. */
  storyTreatment?: GrowthStoryTreatment;
  /** Facts explicitly confirmed by the parent or guardian. */
  parentFacts?: string;
  /** Imaginative additions explicitly allowed by the parent or guardian. */
  allowedImaginations?: string;
}

export interface GrowthRecordPhoto {
  id: string;
  name: string;
  dataUrl: string;
  mimeType?: GrowthAssetMimeType;
  byteSize?: number;
  checksumSha256?: string;
}

export interface GrowthRecordDraft extends GrowthStoryContext {
  version: 1;
  childKey: string;
  childName: string;
  childCharacterId?: string;
  childAvatarDataUrl?: string;
  occurredOn: string;
  note: string;
  idea: string;
  photos: GrowthRecordPhoto[];
}

export interface GrowthRecord extends GrowthStoryContext {
  id: string;
  /** Logical Moment id when this record is a compatibility projection. */
  momentId?: string;
  /** Selected StorybookVersion id used by legacy story-oriented screens. */
  activeStorybookVersionId?: string;
  /** Number of versions linked to the same real-life Moment. */
  storybookVersionCount?: number;
  /** Stable local id used for cloud upserts; absent on legacy IndexedDB rows. */
  clientRecordId?: string;
  storyId: string;
  childKey: string;
  childName: string;
  childCharacterId?: string;
  childAvatarDataUrl?: string;
  occurredOn: string;
  note: string;
  idea: string;
  photos: GrowthRecordPhoto[];
  story: GenerateResponse;
  createdAt: string;
  updatedAt: string;
}

export interface GrowthChildSummary {
  childKey: string;
  childName: string;
  avatarUrl?: string;
  coverUrl?: string;
  recordCount: number;
  latestOccurredOn: string;
}

interface GrowthMomentEnvelope {
  id: string;
  entityType: "growth-moment";
  envelopeVersion: typeof ENVELOPE_VERSION;
  moment: GrowthMomentBundle["moment"];
  activeStorybookVersionId?: string;
}

interface StorybookVersionEnvelope {
  id: string;
  entityType: "storybook-version";
  envelopeVersion: typeof ENVELOPE_VERSION;
  version: StorybookVersion;
}

interface GrowthStoreMutation {
  puts?: Array<GrowthRecord | GrowthMomentEnvelope | StorybookVersionEnvelope>;
  deletes?: string[];
}

function getMomentEnvelopeId(momentId: string) {
  return `${MOMENT_ENVELOPE_PREFIX}${momentId}`;
}

function getStorybookEnvelopeId(versionId: string) {
  return `${STORYBOOK_ENVELOPE_PREFIX}${versionId}`;
}

function isGrowthMomentEnvelope(value: unknown): value is GrowthMomentEnvelope {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Partial<GrowthMomentEnvelope>;
  return (
    envelope.entityType === "growth-moment" &&
    envelope.envelopeVersion === ENVELOPE_VERSION &&
    isGrowthMoment(envelope.moment) &&
    envelope.id === getMomentEnvelopeId(envelope.moment.momentId) &&
    (envelope.activeStorybookVersionId === undefined ||
      (typeof envelope.activeStorybookVersionId === "string" &&
        envelope.activeStorybookVersionId.trim().length > 0))
  );
}

function isStorybookVersionEnvelope(
  value: unknown,
): value is StorybookVersionEnvelope {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Partial<StorybookVersionEnvelope>;
  return (
    envelope.entityType === "storybook-version" &&
    envelope.envelopeVersion === ENVELOPE_VERSION &&
    isStorybookVersion(envelope.version) &&
    envelope.id === getStorybookEnvelopeId(envelope.version.versionId)
  );
}

function getRecordMomentId(record: GrowthRecord) {
  return record.momentId || record.clientRecordId || record.id;
}

function sortGrowthMomentBundles(bundles: GrowthMomentBundle[]) {
  return [...bundles].sort((left, right) => {
    const occurredDiff = right.moment.occurredOn.localeCompare(
      left.moment.occurredOn,
    );
    return occurredDiff || right.moment.updatedAt.localeCompare(left.moment.updatedAt);
  });
}

/**
 * Builds the new domain view from one mixed legacy/shadow object store.
 * This stays pure so migration behavior can be regression-tested without a browser.
 */
export function buildGrowthMomentBundlesFromStoredValues(
  values: unknown[],
): GrowthMomentBundle[] {
  const bundles = new Map<string, GrowthMomentBundle>();

  values.filter(isGrowthMomentEnvelope).forEach((envelope) => {
    bundles.set(envelope.moment.momentId, {
      moment: envelope.moment,
      storybookVersions: [],
      ...(envelope.activeStorybookVersionId
        ? { activeStorybookVersionId: envelope.activeStorybookVersionId }
        : {}),
    });
  });

  values.filter(isStorybookVersionEnvelope).forEach((envelope) => {
    const bundle = bundles.get(envelope.version.momentId);
    if (!bundle) return;
    bundle.storybookVersions.push(envelope.version);
  });

  values.filter(isGrowthRecord).forEach((record) => {
    const migrated = migrateLegacyGrowthRecord(record);
    const momentId = migrated.moment.momentId;
    const existing = bundles.get(momentId);
    if (!existing) {
      bundles.set(momentId, migrated);
      return;
    }

    const legacyIsNewer =
      Date.parse(migrated.moment.updatedAt) >
      Date.parse(existing.moment.updatedAt);
    if (legacyIsNewer) {
      existing.moment = migrated.moment;
    }

    migrated.storybookVersions.forEach((version) => {
      const existingIndex = existing.storybookVersions.findIndex(
        (candidate) =>
          candidate.versionId === version.versionId ||
          candidate.storyId === version.storyId,
      );
      if (existingIndex < 0) {
        existing.storybookVersions.push(version);
      } else if (
        Date.parse(version.updatedAt) >
        Date.parse(existing.storybookVersions[existingIndex].updatedAt)
      ) {
        existing.storybookVersions[existingIndex] = version;
      }
    });
    if (legacyIsNewer || !existing.activeStorybookVersionId) {
      existing.activeStorybookVersionId = migrated.activeStorybookVersionId;
    }
  });

  return sortGrowthMomentBundles(
    Array.from(bundles.values()).map((bundle) => {
      const storybookVersions = [...bundle.storybookVersions].sort(
        (left, right) =>
          Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
          left.versionId.localeCompare(right.versionId),
      );
      const active = selectActiveStorybookVersion({
        ...bundle,
        storybookVersions,
      });
      return {
        moment: bundle.moment,
        storybookVersions,
        ...(active ? { activeStorybookVersionId: active.versionId } : {}),
      };
    }),
  );
}

function createMomentEnvelope(bundle: GrowthMomentBundle): GrowthMomentEnvelope {
  const active = selectActiveStorybookVersion(bundle);
  return {
    id: getMomentEnvelopeId(bundle.moment.momentId),
    entityType: "growth-moment",
    envelopeVersion: ENVELOPE_VERSION,
    moment: bundle.moment,
    ...(active ? { activeStorybookVersionId: active.versionId } : {}),
  };
}

function createStorybookEnvelope(
  version: StorybookVersion,
): StorybookVersionEnvelope {
  return {
    id: getStorybookEnvelopeId(version.versionId),
    entityType: "storybook-version",
    envelopeVersion: ENVELOPE_VERSION,
    version,
  };
}

export function createGrowthMomentShadowValues(
  input: GrowthMomentBundle,
): Array<GrowthMomentEnvelope | StorybookVersionEnvelope> {
  const bundle = normalizeGrowthMomentBundle(input);
  return [
    createMomentEnvelope(bundle),
    ...bundle.storybookVersions.map(createStorybookEnvelope),
  ];
}

function canUseIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function sortRecords(records: GrowthRecord[]) {
  return [...records].sort((a, b) => {
    const occurredDiff = b.occurredOn.localeCompare(a.occurredOn);
    return occurredDiff || b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function isValidGrowthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isGrowthRecordPhoto(value: unknown): value is GrowthRecordPhoto {
  if (!value || typeof value !== "object") return false;
  const photo = value as Partial<GrowthRecordPhoto>;
  return (
    typeof photo.id === "string" &&
    photo.id.trim().length > 0 &&
    typeof photo.name === "string" &&
    typeof photo.dataUrl === "string" &&
    photo.dataUrl.startsWith("data:image/") &&
    hasValidOptionalGrowthAssetMetadata(photo)
  );
}

function hasValidGrowthPhotos(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length <= 4 &&
    value.every(isGrowthRecordPhoto)
  );
}

function isOptionalGrowthConfirmation(value: unknown) {
  return (
    value === undefined ||
    (typeof value === "string" &&
      value.trim().length <= MAX_GROWTH_CONFIRMATION_LENGTH)
  );
}

function isOptionalGrowthRecordId(value: unknown) {
  return (
    value === undefined ||
    (typeof value === "string" && value.trim().length > 0 && value.length <= 200)
  );
}

function isOptionalStorybookVersionCount(value: unknown) {
  return (
    value === undefined ||
    (typeof value === "number" && Number.isInteger(value) && value >= 1)
  );
}

function normalizeGrowthConfirmation(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || undefined;
}

function isOptionalReadingStage(value: unknown): value is AgeGroup | undefined {
  return (
    value === undefined || value === "2-3" || value === "4-5" || value === "6-8"
  );
}

function isOptionalStoryTreatment(
  value: unknown,
): value is GrowthStoryTreatment | undefined {
  return (
    value === undefined ||
    value === "documentary" ||
    value === "warm-imagination" ||
    value === "fairytale"
  );
}

function getGrowthStoryContext(
  draft: GrowthStoryContext,
  existing?: GrowthStoryContext,
): GrowthStoryContext {
  const readingStage = draft.readingStage ?? existing?.readingStage;
  const storyTreatment = draft.storyTreatment ?? existing?.storyTreatment;
  const parentFacts = normalizeGrowthConfirmation(
    draft.parentFacts === undefined ? existing?.parentFacts : draft.parentFacts,
  );
  const allowedImaginations = normalizeGrowthConfirmation(
    draft.allowedImaginations === undefined
      ? existing?.allowedImaginations
      : draft.allowedImaginations,
  );

  return {
    ...(readingStage ? { readingStage } : {}),
    ...(storyTreatment ? { storyTreatment } : {}),
    ...(parentFacts ? { parentFacts } : {}),
    ...(allowedImaginations ? { allowedImaginations } : {}),
  };
}

export function isGrowthRecord(value: unknown): value is GrowthRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<GrowthRecord>;
  const story = record.story as Partial<GenerateResponse> | undefined;
  return (
    typeof record.id === "string" &&
    record.id.trim().length > 0 &&
    isOptionalGrowthRecordId(record.momentId) &&
    isOptionalGrowthRecordId(record.activeStorybookVersionId) &&
    isOptionalStorybookVersionCount(record.storybookVersionCount) &&
    typeof record.storyId === "string" &&
    record.storyId.trim().length > 0 &&
    typeof record.childKey === "string" &&
    record.childKey.trim().length > 0 &&
    typeof record.childName === "string" &&
    record.childName.trim().length > 0 &&
    typeof record.occurredOn === "string" &&
    isValidGrowthDate(record.occurredOn) &&
    typeof record.note === "string" &&
    typeof record.idea === "string" &&
    record.idea.trim().length > 0 &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string" &&
    typeof story?.storyId === "string" &&
    typeof story.coverTitle === "string" &&
    Array.isArray(story.pages) &&
    hasValidGrowthPhotos(record.photos) &&
    isOptionalReadingStage(record.readingStage) &&
    isOptionalStoryTreatment(record.storyTreatment) &&
    isOptionalGrowthConfirmation(record.parentFacts) &&
    isOptionalGrowthConfirmation(record.allowedImaginations)
  );
}

export function isGrowthRecordDraft(value: unknown): value is GrowthRecordDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<GrowthRecordDraft>;
  return (
    draft.version === 1 &&
    typeof draft.childKey === "string" &&
    draft.childKey.trim().length > 0 &&
    typeof draft.childName === "string" &&
    draft.childName.trim().length > 0 &&
    typeof draft.occurredOn === "string" &&
    isValidGrowthDate(draft.occurredOn) &&
    typeof draft.note === "string" &&
    draft.note.length <= 200 &&
    typeof draft.idea === "string" &&
    draft.idea.trim().length > 0 &&
    hasValidGrowthPhotos(draft.photos) &&
    isOptionalReadingStage(draft.readingStage) &&
    isOptionalStoryTreatment(draft.storyTreatment) &&
    isOptionalGrowthConfirmation(draft.parentFacts) &&
    isOptionalGrowthConfirmation(draft.allowedImaginations)
  );
}

export function normalizeGrowthRecordDraft(
  value: unknown,
): GrowthRecordDraft | undefined {
  if (!isGrowthRecordDraft(value)) return undefined;
  const {
    readingStage,
    storyTreatment,
    parentFacts,
    allowedImaginations,
    ...draft
  } = value;
  return {
    ...draft,
    ...getGrowthStoryContext({
      readingStage,
      storyTreatment,
      parentFacts,
      allowedImaginations,
    }),
  };
}

export function createGrowthRecord(
  story: GenerateResponse,
  draft: GrowthRecordDraft,
  existing?: GrowthRecord,
  now = new Date().toISOString(),
): GrowthRecord {
  return {
    id: existing?.id || story.storyId,
    clientRecordId: existing?.clientRecordId || existing?.id || story.storyId,
    storyId: story.storyId,
    childKey: draft.childKey,
    childName: draft.childName,
    childCharacterId: draft.childCharacterId,
    childAvatarDataUrl: draft.childAvatarDataUrl || existing?.childAvatarDataUrl,
    occurredOn: draft.occurredOn,
    note: draft.note,
    idea: draft.idea,
    photos: draft.photos,
    ...getGrowthStoryContext(draft, existing),
    story,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

export function getGrowthRecordCover(record: GrowthRecord) {
  return (
    record.photos[0]?.dataUrl ||
    record.story.pages.find((page) => page.imageUrl)?.imageUrl ||
    undefined
  );
}

export function groupGrowthRecordsByChild(records: GrowthRecord[]) {
  const children = new Map<string, GrowthChildSummary>();

  sortRecords(records).forEach((record) => {
    const existing = children.get(record.childKey);
    if (existing) {
      existing.recordCount += 1;
      if (!existing.avatarUrl && record.childAvatarDataUrl) {
        existing.avatarUrl = record.childAvatarDataUrl;
      }
      if (!existing.coverUrl) {
        existing.coverUrl = getGrowthRecordCover(record);
      }
      return;
    }

    children.set(record.childKey, {
      childKey: record.childKey,
      childName: record.childName,
      avatarUrl: record.childAvatarDataUrl,
      coverUrl: getGrowthRecordCover(record),
      recordCount: 1,
      latestOccurredOn: record.occurredOn,
    });
  });

  return Array.from(children.values()).sort((a, b) =>
    b.latestOccurredOn.localeCompare(a.latestOccurredOn),
  );
}

function openGrowthDb() {
  if (!canUseIndexedDb()) return Promise.resolve(null);

  return new Promise<IDBDatabase | null>((resolve, reject) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      request.onerror = () =>
        reject(
          toGrowthStorageError(
            request.error,
            "growth-storage-unavailable",
          ),
        );
      request.onblocked = () =>
        reject(new GrowthStorageError("growth-storage-unavailable"));
      request.onsuccess = () => resolve(request.result);
    } catch (error) {
      reject(toGrowthStorageError(error, "growth-storage-unavailable"));
    }
  });
}

function readAllStoredValues(db: IDBDatabase) {
  return new Promise<unknown[]>((resolve, reject) => {
    try {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
      request.onerror = () =>
        reject(
          toGrowthStorageError(
            request.error,
            "growth-storage-unavailable",
          ),
        );
      request.onsuccess = () =>
        resolve(Array.isArray(request.result) ? request.result : []);
    } catch (error) {
      reject(toGrowthStorageError(error, "growth-storage-unavailable"));
    }
  });
}

function mutateGrowthStore(db: IDBDatabase, mutation: GrowthStoreMutation) {
  return new Promise<void>((resolve, reject) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      Array.from(new Set(mutation.deletes || [])).forEach((id) => store.delete(id));
      (mutation.puts || []).forEach((value) => store.put(value));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(toGrowthStorageError(transaction.error));
      transaction.onabort = () =>
        reject(toGrowthStorageError(transaction.error));
    } catch (error) {
      reject(toGrowthStorageError(error));
    }
  });
}

function findGrowthMomentBundle(
  bundles: GrowthMomentBundle[],
  id: string,
) {
  return bundles.find(
    (bundle) =>
      bundle.moment.momentId === id ||
      bundle.moment.clientMomentId === id ||
      bundle.storybookVersions.some(
        (version) => version.versionId === id || version.storyId === id,
      ),
  );
}

function normalizeGrowthMomentBundle(
  bundle: GrowthMomentBundle,
): GrowthMomentBundle {
  if (!isGrowthMoment(bundle.moment)) {
    throw new Error("growth-moment-invalid");
  }
  if (
    !bundle.storybookVersions.every(
      (version) =>
        isStorybookVersion(version) &&
        version.momentId === bundle.moment.momentId,
    )
  ) {
    throw new Error("growth-storybook-version-invalid");
  }
  const active = selectActiveStorybookVersion(bundle);
  return {
    moment: bundle.moment,
    storybookVersions: bundle.storybookVersions,
    ...(active ? { activeStorybookVersionId: active.versionId } : {}),
  };
}

export async function prepareGrowthMomentBundleForStorage(
  input: GrowthMomentBundle,
  options: { verifyExisting?: boolean } = {},
) {
  const bundle = normalizeGrowthMomentBundle(input);
  const normalizedAssets = await normalizeAndDedupeGrowthAssets(
    bundle.moment.originalAssets,
    { verifyExisting: options.verifyExisting },
  );
  if (!normalizedAssets.changed) return bundle;
  return {
    ...bundle,
    moment: {
      ...bundle.moment,
      originalAssets: normalizedAssets.assets,
    },
  };
}

function getStoredMomentPhotoBytes(storedValues: unknown[], momentId: string) {
  let total = 0;
  storedValues.filter(isGrowthMomentEnvelope).forEach((envelope) => {
    if (envelope.moment.momentId === momentId) {
      total += sumGrowthAssetDataUrlBytes(envelope.moment.originalAssets);
    }
  });
  storedValues.filter(isGrowthRecord).forEach((record) => {
    if (getRecordMomentId(record) === momentId) {
      total += sumGrowthAssetDataUrlBytes(record.photos);
    }
  });
  return total;
}

function getNextMomentPhotoBytes(bundle: GrowthMomentBundle) {
  const momentBytes = sumGrowthAssetDataUrlBytes(bundle.moment.originalAssets);
  return projectGrowthMomentBundle(bundle) ? momentBytes * 2 : momentBytes;
}

function hasSameGrowthPhotos(
  left: readonly GrowthRecordPhoto[],
  right: readonly GrowthRecordPhoto[],
) {
  return (
    left.length === right.length &&
    left.every((photo, index) => {
      const candidate = right[index];
      return (
        candidate?.id === photo.id &&
        candidate.name === photo.name &&
        candidate.dataUrl === photo.dataUrl &&
        candidate.mimeType === photo.mimeType &&
        candidate.byteSize === photo.byteSize &&
        candidate.checksumSha256 === photo.checksumSha256
      );
    })
  );
}

function createBundleMutation(
  storedValues: unknown[],
  input: GrowthMomentBundle,
): { bundle: GrowthMomentBundle; mutation: GrowthStoreMutation } {
  const bundle = normalizeGrowthMomentBundle(input);
  const momentId = bundle.moment.momentId;
  const nextVersionEnvelopeIds = new Set(
    bundle.storybookVersions.map((version) =>
      getStorybookEnvelopeId(version.versionId),
    ),
  );
  const deletes = new Set<string>();

  storedValues.filter(isStorybookVersionEnvelope).forEach((envelope) => {
    if (
      envelope.version.momentId === momentId &&
      !nextVersionEnvelopeIds.has(envelope.id)
    ) {
      deletes.add(envelope.id);
    }
  });
  storedValues.filter(isGrowthRecord).forEach((record) => {
    if (getRecordMomentId(record) === momentId) deletes.add(record.id);
  });

  const projection = projectGrowthMomentBundle(bundle);
  const puts: GrowthStoreMutation["puts"] = [
    ...createGrowthMomentShadowValues(bundle),
    ...(projection ? [projection] : []),
  ];
  return { bundle, mutation: { puts, deletes: Array.from(deletes) } };
}

async function persistGrowthMomentBundle(
  db: IDBDatabase,
  storedValues: unknown[],
  input: GrowthMomentBundle,
) {
  const prepared = await prepareGrowthMomentBundleForStorage(input, {
    verifyExisting: true,
  });
  const existingPhotoBytes = getStoredMomentPhotoBytes(
    storedValues,
    prepared.moment.momentId,
  );
  const additionalPhotoBytes = Math.max(
    0,
    getNextMomentPhotoBytes(prepared) - existingPhotoBytes,
  );
  if (additionalPhotoBytes > 0) {
    assertGrowthStorageCapacity(
      await estimateGrowthStorageCapacity(),
      additionalPhotoBytes,
    );
  }
  const { bundle, mutation } = createBundleMutation(storedValues, prepared);
  await mutateGrowthStore(db, mutation);
  return bundle;
}

export async function listGrowthMomentBundles() {
  const db = await openGrowthDb();
  if (!db) {
    if (typeof window !== "undefined") {
      throw new GrowthStorageError("growth-storage-unavailable");
    }
    return [];
  }
  try {
    const storedValues = await readAllStoredValues(db);
    const rawBundles = buildGrowthMomentBundlesFromStoredValues(storedValues);
    const bundles = await Promise.all(
      rawBundles.map((bundle) => prepareGrowthMomentBundleForStorage(bundle)),
    );
    const metadataChangedMomentIds = new Set(
      bundles.flatMap((bundle, index) =>
        bundle === rawBundles[index] ? [] : [bundle.moment.momentId],
      ),
    );

    const momentEnvelopes = new Map(
      storedValues
        .filter(isGrowthMomentEnvelope)
        .map((value) => [value.id, value] as const),
    );
    const storybookEnvelopes = new Map(
      storedValues
        .filter(isStorybookVersionEnvelope)
        .map((value) => [value.id, value] as const),
    );
    const growthRecordProjections = new Map(
      storedValues
        .filter(isGrowthRecord)
        .map((value) => [value.id, value] as const),
    );
    const migrationPuts: GrowthStoreMutation["puts"] = [];
    bundles.forEach((bundle) => {
      const forceAssetMetadataUpdate = metadataChangedMomentIds.has(
        bundle.moment.momentId,
      );
      const momentEnvelope = createMomentEnvelope(bundle);
      const storedMomentEnvelope = momentEnvelopes.get(momentEnvelope.id);
      if (
        forceAssetMetadataUpdate ||
        !storedMomentEnvelope ||
        storedMomentEnvelope.moment.updatedAt !== bundle.moment.updatedAt ||
        storedMomentEnvelope.activeStorybookVersionId !==
          momentEnvelope.activeStorybookVersionId
      ) {
        migrationPuts.push(momentEnvelope);
      }
      bundle.storybookVersions.forEach((version) => {
        const envelope = createStorybookEnvelope(version);
        const storedEnvelope = storybookEnvelopes.get(envelope.id);
        if (
          !storedEnvelope ||
          storedEnvelope.version.updatedAt !== version.updatedAt
        ) {
          migrationPuts.push(envelope);
        }
      });
      const projection = projectGrowthMomentBundle(bundle);
      const storedProjection = projection
        ? growthRecordProjections.get(projection.id)
        : undefined;
      if (
        projection &&
        (forceAssetMetadataUpdate ||
          !storedProjection ||
          !hasSameGrowthPhotos(storedProjection.photos, projection.photos))
      ) {
        migrationPuts.push(projection);
      }
    });
    if (migrationPuts.length > 0) {
      try {
        await mutateGrowthStore(db, { puts: migrationPuts });
      } catch {
        // Metadata/shadow backfill is best-effort; validated local records remain readable.
      }
    }
    return bundles;
  } finally {
    db.close();
  }
}

export async function getGrowthMomentBundle(id: string) {
  return findGrowthMomentBundle(await listGrowthMomentBundles(), id);
}

export async function saveGrowthMomentBundle(input: GrowthMomentBundle) {
  const db = await openGrowthDb();
  if (!db) throw new GrowthStorageError("growth-storage-unavailable");
  try {
    const storedValues = await readAllStoredValues(db);
    return await persistGrowthMomentBundle(db, storedValues, input);
  } finally {
    db.close();
  }
}

export async function listGrowthRecords() {
  const records = (await listGrowthMomentBundles())
    .map(projectGrowthMomentBundle)
    .filter((record): record is GrowthRecord => Boolean(record));
  return sortRecords(records);
}

export async function upsertGrowthRecord(
  story: GenerateResponse,
  draft: GrowthRecordDraft,
) {
  const durableStory = await materializeTemporaryStoryImages(story);
  const bundles = await listGrowthMomentBundles();
  const existingBundle = bundles.find((bundle) =>
    bundle.storybookVersions.some((version) => version.storyId === story.storyId),
  );
  if (!existingBundle) {
    const record = createGrowthRecord(durableStory, draft);
    const bundle = migrateLegacyGrowthRecord(record);
    const saved = await saveGrowthMomentBundle(bundle);
    const projection = projectGrowthMomentBundle(saved);
    if (!projection) throw new Error("growth-storybook-version-missing");
    return projection;
  }

  const now = new Date().toISOString();
  const previousVersion = existingBundle.storybookVersions.find(
    (version) => version.storyId === story.storyId,
  );
  const nextMoment = createGrowthMoment(draft, {
    momentId: existingBundle.moment.momentId,
    clientMomentId: existingBundle.moment.clientMomentId,
    confirmedTags: existingBundle.moment.confirmedTags,
    now,
  });
  const version = createStorybookVersion(
    existingBundle.moment.momentId,
    durableStory,
    {
      versionId: previousVersion?.versionId,
      storyTreatment: draft.storyTreatment || previousVersion?.storyTreatment,
      characterReferenceId:
        draft.childCharacterId || previousVersion?.characterReferenceId,
      promptVersion: previousVersion?.promptVersion,
      textModel: previousVersion?.textModel,
      characterBibleVersion: previousVersion?.characterBibleVersion,
      source: previousVersion?.source || "generated",
      createdAt: previousVersion?.createdAt || now,
      updatedAt: now,
    },
  );
  const saved = await saveGrowthMomentBundle(
    addStorybookVersion(
      {
        ...existingBundle,
        moment: {
          ...nextMoment,
          createdAt: existingBundle.moment.createdAt,
          ...(nextMoment.childAvatarDataUrl
            ? {}
            : existingBundle.moment.childAvatarDataUrl
              ? { childAvatarDataUrl: existingBundle.moment.childAvatarDataUrl }
              : {}),
        },
      },
      version,
    ),
  );
  const projection = projectGrowthMomentBundle(saved);
  if (!projection) throw new Error("growth-storybook-version-missing");
  return projection;
}

export async function updateGrowthRecordStory(story: GenerateResponse) {
  const bundles = await listGrowthMomentBundles();
  const bundle = bundles.find((candidate) =>
    candidate.storybookVersions.some((version) => version.storyId === story.storyId),
  );
  if (!bundle) return undefined;
  const existing = bundle.storybookVersions.find(
    (version) => version.storyId === story.storyId,
  );
  if (!existing) return undefined;
  const durableStory = await materializeTemporaryStoryImages(story);
  const now = new Date().toISOString();
  const nextVersion = createStorybookVersion(bundle.moment.momentId, durableStory, {
    versionId: existing.versionId,
    storyTreatment: existing.storyTreatment,
    characterReferenceId: existing.characterReferenceId,
    promptVersion: existing.promptVersion,
    textModel: existing.textModel,
    characterBibleVersion: existing.characterBibleVersion,
    source: existing.source,
    createdAt: existing.createdAt,
    updatedAt: now,
  });
  const saved = await saveGrowthMomentBundle({
    ...bundle,
    moment: {
      ...bundle.moment,
      updatedAt: now,
    },
    storybookVersions: bundle.storybookVersions.map((version) =>
      version.versionId === existing.versionId ? nextVersion : version,
    ),
  });
  return projectGrowthMomentBundle(saved) || undefined;
}

export async function addLocalStorybookVersion(
  momentId: string,
  story: GenerateResponse,
  options: StorybookVersionCreateOptions = {},
) {
  const bundle = await getGrowthMomentBundle(momentId);
  if (!bundle) throw new Error("growth-moment-not-found");
  const durableStory = await materializeTemporaryStoryImages(story);
  return saveGrowthMomentBundle(
    addStorybookVersion(
      bundle,
      createStorybookVersion(bundle.moment.momentId, durableStory, options),
    ),
  );
}

export async function selectLocalStorybookVersion(
  momentId: string,
  versionId: string,
) {
  const bundle = await getGrowthMomentBundle(momentId);
  if (!bundle) throw new Error("growth-moment-not-found");
  if (!bundle.storybookVersions.some((version) => version.versionId === versionId)) {
    throw new Error("growth-storybook-version-not-found");
  }
  return saveGrowthMomentBundle({
    ...bundle,
    activeStorybookVersionId: versionId,
  });
}

export async function removeLocalStorybookVersion(
  momentId: string,
  versionId: string,
) {
  const bundle = await getGrowthMomentBundle(momentId);
  if (!bundle) throw new Error("growth-moment-not-found");
  if (!bundle.storybookVersions.some((version) => version.versionId === versionId)) {
    throw new Error("growth-storybook-version-not-found");
  }
  return saveGrowthMomentBundle(removeStorybookVersion(bundle, versionId));
}

export async function clearLocalMomentAssets(momentId: string) {
  const bundle = await getGrowthMomentBundle(momentId);
  if (!bundle) throw new Error("growth-moment-not-found");
  return saveGrowthMomentBundle(clearGrowthMomentOriginalAssets(bundle));
}

export async function updateGrowthRecordDetails(
  storyId: string,
  details: { occurredOn: string; note: string },
) {
  return patchGrowthRecord(storyId, details);
}

export async function patchGrowthRecord(
  id: string,
  patch: {
    occurredOn?: string;
    note?: string;
    idea?: string;
    photos?: GrowthRecordPhoto[];
    story?: GenerateResponse;
  },
) {
  if (patch.occurredOn !== undefined && !isValidGrowthDate(patch.occurredOn)) {
    throw new Error("growth-date-invalid");
  }
  if (patch.photos !== undefined && !hasValidGrowthPhotos(patch.photos)) {
    throw new Error("growth-photos-invalid");
  }
  const bundles = await listGrowthMomentBundles();
  const existing = findGrowthMomentBundle(bundles, id);
  if (!existing) throw new Error("growth-record-not-found");

  const now = new Date().toISOString();
  let storybookVersions = existing.storybookVersions;
  let activeStorybookVersionId = existing.activeStorybookVersionId;
  if (patch.story) {
    const durableStory = await materializeTemporaryStoryImages(patch.story);
    const active =
      existing.storybookVersions.find(
        (version) => version.storyId === durableStory.storyId,
      ) || selectActiveStorybookVersion(existing);
    const nextVersion = createStorybookVersion(
      existing.moment.momentId,
      durableStory,
      {
        versionId: active?.versionId,
        storyTreatment: active?.storyTreatment,
        characterReferenceId: active?.characterReferenceId,
        promptVersion: active?.promptVersion,
        textModel: active?.textModel,
        characterBibleVersion: active?.characterBibleVersion,
        source: active?.source || "generated",
        createdAt: active?.createdAt || now,
        updatedAt: now,
      },
    );
    storybookVersions = active
      ? existing.storybookVersions.map((version) =>
          version.versionId === active.versionId ? nextVersion : version,
        )
      : [...existing.storybookVersions, nextVersion];
    activeStorybookVersionId = nextVersion.versionId;
  }

  const saved = await saveGrowthMomentBundle({
    moment: {
      ...existing.moment,
      ...(patch.occurredOn !== undefined
        ? { occurredOn: patch.occurredOn }
        : {}),
      ...(patch.note !== undefined ? { parentNote: patch.note } : {}),
      ...(patch.idea !== undefined ? { sourceIdea: patch.idea } : {}),
      ...(patch.photos !== undefined
        ? {
            originalAssets: patch.photos.map((photo) => ({
              assetId: photo.id,
              kind: "photo" as const,
              name: photo.name,
              dataUrl: photo.dataUrl,
              ...(photo.mimeType ? { mimeType: photo.mimeType } : {}),
              ...(photo.byteSize !== undefined
                ? { byteSize: photo.byteSize }
                : {}),
              ...(photo.checksumSha256
                ? { checksumSha256: photo.checksumSha256 }
                : {}),
            })),
          }
        : {}),
      updatedAt: now,
    },
    storybookVersions,
    ...(activeStorybookVersionId ? { activeStorybookVersionId } : {}),
  });
  const projection = projectGrowthMomentBundle(saved);
  if (!projection) throw new Error("growth-storybook-version-missing");
  return projection;
}

export async function deleteLocalGrowthMoment(id: string) {
  const db = await openGrowthDb();
  if (!db) throw new GrowthStorageError("growth-storage-unavailable");
  try {
    const storedValues = await readAllStoredValues(db);
    const bundle = findGrowthMomentBundle(
      buildGrowthMomentBundlesFromStoredValues(storedValues),
      id,
    );
    if (!bundle) return true;
    const momentId = bundle.moment.momentId;
    const deletes = [
      getMomentEnvelopeId(momentId),
      ...bundle.storybookVersions.map((version) =>
        getStorybookEnvelopeId(version.versionId),
      ),
      ...storedValues
        .filter(isGrowthRecord)
        .filter((record) => getRecordMomentId(record) === momentId)
        .map((record) => record.id),
    ];
    await mutateGrowthStore(db, { deletes });
    return true;
  } finally {
    db.close();
  }
}

export async function deleteGrowthRecord(id: string) {
  return deleteLocalGrowthMoment(id);
}
