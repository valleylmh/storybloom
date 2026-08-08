type StoryGenerationRequestInput = {
  payload: Record<string, unknown>;
  accessToken?: string;
  refreshAccessToken?: () => Promise<string | null>;
  fetcher?: typeof fetch;
};

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
