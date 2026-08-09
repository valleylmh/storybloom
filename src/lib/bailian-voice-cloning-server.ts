import "server-only";

import { FAMILY_VOICE_TARGET_MODEL } from "@/lib/family-voice";

const DEFAULT_ENDPOINT =
  "https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/customization";
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;

type JsonRecord = Record<string, unknown>;

export interface BailianVoiceCloningInput {
  sampleUrl: string;
  prefix: string;
}

export interface BailianVoiceCloningResult {
  voiceId: string;
  requestId?: string;
}

export interface BailianVoiceDeletionResult {
  requestId?: string;
  alreadyAbsent?: boolean;
}

export interface BailianVoiceDeletionOptions {
  allowListAbsenceConfirmation?: boolean;
}

export type BailianClonedVoiceStatus = "DEPLOYING" | "OK" | "UNDEPLOYED";

export interface BailianVoiceQueryResult {
  status: BailianClonedVoiceStatus;
  requestId?: string;
}

export class BailianVoiceCloningError extends Error {
  readonly status: number;
  readonly requestId?: string;
  readonly ambiguous: boolean;

  constructor(
    message: string,
    status = 502,
    options: ErrorOptions & { requestId?: string; ambiguous?: boolean } = {},
  ) {
    super(message, options);
    this.name = "BailianVoiceCloningError";
    this.status = status;
    this.requestId = options.requestId;
    this.ambiguous = options.ambiguous === true;
  }
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function readNonEmptyString(value: unknown, maximum = 512) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum || /[\u0000-\u001f]/.test(normalized)) {
    return null;
  }
  return normalized;
}

function readSafeIdentifier(value: unknown, maximum: number) {
  const normalized = readNonEmptyString(value, maximum);
  return normalized && /^[a-z0-9._:-]+$/i.test(normalized) ? normalized : null;
}

function readNestedRecord(record: JsonRecord | null, key: string) {
  return asRecord(record?.[key]);
}

export function extractBailianVoiceId(payload: unknown) {
  const root = asRecord(payload);
  const output = readNestedRecord(root, "output");
  const outputData = readNestedRecord(output, "data");
  const outputVoice = readNestedRecord(output, "voice");

  const candidates = [
    output?.voice_id,
    output?.voiceId,
    typeof output?.voice === "string" ? output.voice : null,
    outputVoice?.voice_id,
    outputVoice?.voiceId,
    outputVoice?.id,
    outputData?.voice_id,
    outputData?.voiceId,
    outputData?.voice,
    root?.voice_id,
    root?.voiceId,
  ];

  for (const candidate of candidates) {
    const voiceId = readSafeIdentifier(candidate, 300);
    if (voiceId) return voiceId;
  }
  return null;
}

function extractRequestId(payload: unknown) {
  const root = asRecord(payload);
  const output = readNestedRecord(root, "output");
  return (
    readSafeIdentifier(root?.request_id, 256) ||
    readSafeIdentifier(root?.requestId, 256) ||
    readSafeIdentifier(output?.request_id, 256) ||
    readSafeIdentifier(output?.requestId, 256) ||
    undefined
  );
}

function extractVoiceStatus(payload: unknown) {
  const root = asRecord(payload);
  const output = readNestedRecord(root, "output");
  const status = readNonEmptyString(output?.status, 32)?.toUpperCase();
  return status === "DEPLOYING" || status === "OK" || status === "UNDEPLOYED"
    ? status
    : null;
}

function extractVoiceList(payload: unknown) {
  const root = asRecord(payload);
  const output = readNestedRecord(root, "output");
  const voiceList = Array.isArray(output?.voice_list) ? output.voice_list : null;
  if (!voiceList) return null;
  return voiceList.flatMap((entry) => {
    const voiceId = readSafeIdentifier(asRecord(entry)?.voice_id, 300);
    return voiceId ? [voiceId] : [];
  });
}

function readPositiveInteger(name: string, fallback: number, maximum: number) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

function getApiKey() {
  const apiKey = process.env.DASHSCOPE_TOKEN_KEY?.trim();
  if (!apiKey) {
    throw new BailianVoiceCloningError(
      "百炼声音复刻服务尚未配置。",
      503,
    );
  }
  return apiKey;
}

function getEndpoint() {
  const configured = process.env.BAILIAN_VOICE_CLONING_ENDPOINT?.trim();
  let endpoint: URL;
  try {
    endpoint = new URL(configured || DEFAULT_ENDPOINT);
  } catch (error) {
    throw new BailianVoiceCloningError(
      "百炼声音复刻接口地址配置无效。",
      500,
      { cause: error },
    );
  }
  if (endpoint.protocol !== "https:") {
    throw new BailianVoiceCloningError(
      "百炼声音复刻接口必须使用 HTTPS。",
      500,
    );
  }
  return endpoint.toString();
}

function validateInput(input: BailianVoiceCloningInput) {
  if (!/^[a-z0-9]{1,10}$/.test(input.prefix)) {
    throw new BailianVoiceCloningError("百炼声音复刻前缀无效。", 500);
  }
  let sampleUrl: URL;
  try {
    sampleUrl = new URL(input.sampleUrl);
  } catch (error) {
    throw new BailianVoiceCloningError("声音样本临时地址无效。", 500, {
      cause: error,
    });
  }
  if (sampleUrl.protocol !== "https:") {
    throw new BailianVoiceCloningError("声音样本临时地址必须使用 HTTPS。", 500);
  }
}

function safeProviderError(payload: unknown, responseStatus: number) {
  const root = asRecord(payload);
  const safeCode = readSafeIdentifier(root?.code, 64);
  return safeCode
    ? `百炼声音复刻请求失败（${safeCode}）。`
    : `百炼声音复刻请求失败（HTTP ${responseStatus}）。`;
}

function getStoryBloomVoicePrefix(voiceId: string) {
  return voiceId.match(/(?:^|-)(sb[a-z0-9]{8})(?:-|$)/i)?.[1]?.toLowerCase();
}

async function requestCustomization(
  body: JsonRecord,
  signal: AbortSignal,
) {
  const response = await fetch(getEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
  const payload = await response.json().catch(() => null);
  return { response, payload, requestId: extractRequestId(payload) };
}

async function isBailianVoiceAbsent(
  voiceId: string,
  signal: AbortSignal,
) {
  const prefix = getStoryBloomVoicePrefix(voiceId);
  if (!prefix) return false;
  const firstVoiceIds = await listBailianClonedVoiceIdsWithSignal(
    prefix,
    signal,
  );
  if (!firstVoiceIds || firstVoiceIds.includes(voiceId)) return false;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      resolve,
      readPositiveInteger(
        "BAILIAN_VOICE_ABSENCE_RECHECK_MS",
        1_000,
        5_000,
      ),
    );
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(signal.reason || new Error("aborted"));
      },
      { once: true },
    );
  });
  const secondVoiceIds = await listBailianClonedVoiceIdsWithSignal(
    prefix,
    signal,
  );
  return secondVoiceIds ? !secondVoiceIds.includes(voiceId) : false;
}

async function listBailianClonedVoiceIdsWithSignal(
  prefix: string,
  signal: AbortSignal,
) {
  const pageSize = 10;
  const allVoiceIds: string[] = [];
  // The provider currently caps one account at 1,000 cloned voices. Keep the
  // loop above that bound so an exact absence check cannot silently truncate.
  for (let pageIndex = 0; pageIndex < 110; pageIndex += 1) {
    const { response, payload } = await requestCustomization(
      {
        model: "voice-enrollment",
        input: {
          action: "list_voice",
          prefix,
          page_size: pageSize,
          page_index: pageIndex,
        },
      },
      signal,
    );
    if (!response.ok) return null;
    const voiceIds = extractVoiceList(payload);
    if (!voiceIds) return null;
    allVoiceIds.push(...voiceIds);
    if (voiceIds.length < pageSize) {
      return Array.from(new Set(allVoiceIds));
    }
  }
  return null;
}

export async function listBailianClonedVoiceIds(prefixInput: string) {
  const prefix = prefixInput.trim().toLowerCase();
  if (!/^[a-z0-9]{1,10}$/.test(prefix)) {
    throw new BailianVoiceCloningError("百炼声音复刻前缀无效。", 500);
  }
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    readPositiveInteger(
      "BAILIAN_VOICE_CLONING_TIMEOUT_MS",
      DEFAULT_TIMEOUT_MS,
      MAX_TIMEOUT_MS,
    ),
  );
  try {
    const voiceIds = await listBailianClonedVoiceIdsWithSignal(
      prefix,
      controller.signal,
    );
    if (!voiceIds) {
      throw new BailianVoiceCloningError(
        "百炼声音列表暂时无法读取。",
        502,
      );
    }
    return voiceIds;
  } catch (error) {
    if (error instanceof BailianVoiceCloningError) throw error;
    if (controller.signal.aborted) {
      throw new BailianVoiceCloningError("百炼声音列表查询超时。", 504, {
        cause: error,
      });
    }
    throw new BailianVoiceCloningError("百炼声音列表暂时无法读取。", 502, {
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function discoverBailianClonedVoiceIdsSince(
  prefix: string,
  beforeVoiceIds: string[],
) {
  const before = new Set(beforeVoiceIds);
  const discover = async () =>
    (await listBailianClonedVoiceIds(prefix)).filter(
      (voiceId) => !before.has(voiceId),
    );
  const first = await discover();
  if (first.length > 0) return Array.from(new Set(first));
  await new Promise((resolve) =>
    setTimeout(
      resolve,
      readPositiveInteger(
        "BAILIAN_VOICE_ABSENCE_RECHECK_MS",
        1_000,
        5_000,
      ),
    ),
  );
  return Array.from(new Set(await discover()));
}

export async function createBailianClonedVoice(
  input: BailianVoiceCloningInput,
): Promise<BailianVoiceCloningResult> {
  validateInput(input);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    readPositiveInteger(
      "BAILIAN_VOICE_CLONING_TIMEOUT_MS",
      DEFAULT_TIMEOUT_MS,
      MAX_TIMEOUT_MS,
    ),
  );

  try {
    const { response, payload, requestId } = await requestCustomization(
      {
        model: "voice-enrollment",
        input: {
          action: "create_voice",
          target_model: FAMILY_VOICE_TARGET_MODEL,
          prefix: input.prefix,
          url: input.sampleUrl,
        },
      },
      controller.signal,
    );
    if (!response.ok) {
      throw new BailianVoiceCloningError(
        safeProviderError(payload, response.status),
        502,
        {
          requestId,
          // A 5xx response can be emitted after the provider accepted the
          // enrollment side effect. Reconcile it through list_voice instead
          // of assuming that no voice was created.
          ambiguous: response.status >= 500,
        },
      );
    }

    const voiceId = extractBailianVoiceId(payload);
    if (!voiceId) {
      throw new BailianVoiceCloningError(
        "百炼声音复刻没有返回有效的声音标识。",
        502,
        { requestId, ambiguous: true },
      );
    }

    return { voiceId, requestId };
  } catch (error) {
    if (error instanceof BailianVoiceCloningError) throw error;
    if (controller.signal.aborted) {
      throw new BailianVoiceCloningError("百炼声音复刻请求超时。", 504, {
        cause: error,
        ambiguous: true,
      });
    }
    throw new BailianVoiceCloningError("百炼声音复刻服务暂时不可用。", 502, {
      cause: error,
      ambiguous: true,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function queryBailianClonedVoice(
  voiceIdInput: string,
): Promise<BailianVoiceQueryResult> {
  const voiceId = readSafeIdentifier(voiceIdInput, 300);
  if (!voiceId) {
    throw new BailianVoiceCloningError("百炼声音标识无效。", 500);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    readPositiveInteger(
      "BAILIAN_VOICE_CLONING_TIMEOUT_MS",
      DEFAULT_TIMEOUT_MS,
      MAX_TIMEOUT_MS,
    ),
  );

  try {
    const { response, payload, requestId } = await requestCustomization(
      {
        model: "voice-enrollment",
        input: {
          action: "query_voice",
          voice_id: voiceId,
        },
      },
      controller.signal,
    );
    if (!response.ok) {
      throw new BailianVoiceCloningError(
        safeProviderError(payload, response.status),
        502,
        { requestId },
      );
    }
    const status = extractVoiceStatus(payload);
    if (!status) {
      throw new BailianVoiceCloningError(
        "百炼声音状态响应无效。",
        502,
        { requestId },
      );
    }
    return { status, requestId };
  } catch (error) {
    if (error instanceof BailianVoiceCloningError) throw error;
    if (controller.signal.aborted) {
      throw new BailianVoiceCloningError("百炼声音状态查询超时。", 504, {
        cause: error,
      });
    }
    throw new BailianVoiceCloningError("百炼声音状态暂时无法查询。", 502, {
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function deleteBailianClonedVoice(
  voiceIdInput: string,
  options: BailianVoiceDeletionOptions = {},
): Promise<BailianVoiceDeletionResult> {
  const voiceId = readSafeIdentifier(voiceIdInput, 300);
  if (!voiceId) {
    throw new BailianVoiceCloningError("百炼声音标识无效。", 500);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    readPositiveInteger(
      "BAILIAN_VOICE_CLONING_TIMEOUT_MS",
      DEFAULT_TIMEOUT_MS,
      MAX_TIMEOUT_MS,
    ),
  );

  try {
    const { response, payload, requestId } = await requestCustomization(
      {
        model: "voice-enrollment",
        input: {
          action: "delete_voice",
          voice_id: voiceId,
        },
      },
      controller.signal,
    );
    if (!response.ok) {
      if (
        options.allowListAbsenceConfirmation &&
        (await isBailianVoiceAbsent(voiceId, controller.signal))
      ) {
        return { requestId, alreadyAbsent: true };
      }
      throw new BailianVoiceCloningError(
        safeProviderError(payload, response.status),
        502,
        { requestId },
      );
    }
    return { requestId };
  } catch (error) {
    if (error instanceof BailianVoiceCloningError) throw error;
    if (controller.signal.aborted) {
      throw new BailianVoiceCloningError("百炼声音删除请求超时。", 504, {
        cause: error,
      });
    }
    throw new BailianVoiceCloningError("百炼声音删除服务暂时不可用。", 502, {
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}
