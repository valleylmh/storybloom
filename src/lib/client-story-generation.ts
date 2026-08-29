import type { StoryPage } from "@/types";

type StoryGenerationRequestInput = {
  payload: Record<string, unknown>;
  accessToken?: string;
  refreshAccessToken?: () => Promise<string | null>;
  fetcher?: typeof fetch;
};

type StoryGenerationTaskRequestInput = {
  taskId: string;
  fetcher?: typeof fetch;
};

type StoryOutlineConfirmationInput = {
  taskId: string;
  storyId: string;
  pages: StoryPage[];
  fetcher?: typeof fetch;
};

export const STORY_GENERATION_TASK_HTTP_TIMEOUT_MS = 20_000;

export function prepareStoryGenerationRequest(
  formData: Record<string, unknown>,
) {
  const {
    supabaseAccessToken,
    growthRecordDraft,
    targetMomentId,
    ...payload
  } = formData;

  return {
    payload,
    accessToken:
      typeof supabaseAccessToken === "string"
        ? supabaseAccessToken
        : undefined,
    growthRecordDraft,
    targetMomentId,
  };
}

function hasSelectedFamilyCharacters(payload: Record<string, unknown>) {
  return (
    Array.isArray(payload.familyCharacterIds) &&
    payload.familyCharacterIds.length > 0
  );
}

export async function requestStoryGeneration({
  payload,
  accessToken,
  refreshAccessToken,
  fetcher = fetch,
}: StoryGenerationRequestInput) {
  const send = (token?: string) =>
    fetcher("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

  let response = await send(accessToken);
  if (
    response.status !== 401 ||
    !hasSelectedFamilyCharacters(payload) ||
    !refreshAccessToken
  ) {
    return response;
  }

  const refreshedToken = await refreshAccessToken().catch(() => null);
  if (!refreshedToken) {
    return response;
  }

  response = await send(refreshedToken);
  return response;
}

export async function requestStoryGenerationTask({
  taskId,
  fetcher = fetch,
}: StoryGenerationTaskRequestInput) {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    STORY_GENERATION_TASK_HTTP_TIMEOUT_MS,
  );

  try {
    return await fetcher(`/api/generate?taskId=${encodeURIComponent(taskId)}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("故事任务查询超时，正在重试。");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function confirmStoryOutline({
  taskId,
  storyId,
  pages,
  fetcher = fetch,
}: StoryOutlineConfirmationInput) {
  return fetcher("/api/generate", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      taskId,
      storyId,
      pages: pages.map(({ page, zhText, enText }) => ({
        page,
        zhText,
        enText,
      })),
    }),
  });
}
