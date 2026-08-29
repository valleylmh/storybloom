export const ILLUSTRATION_HTTP_TIMEOUT_MS = 20_000;

export async function fetchIllustrationApi(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ILLUSTRATION_HTTP_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("插图请求超时，请重试。");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
