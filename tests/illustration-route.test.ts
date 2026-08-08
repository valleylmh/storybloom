import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { GeneratedStory, StoryPage } from "@/types";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  allowIpRequest: vi.fn(),
  cacheStory: vi.fn(),
  getCachedStory: vi.fn(),
  getProviderForPage: vi.fn(() => "pollinations"),
  getImageToImageProviderForPage: vi.fn(() => "pollinations"),
  regeneratePage: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: mocks.after,
}));

vi.mock("@/lib/request-rate-limit", () => ({
  allowIpRequest: mocks.allowIpRequest,
}));

vi.mock("@/lib/storage", () => ({
  cacheStory: mocks.cacheStory,
  getCachedStory: mocks.getCachedStory,
}));

vi.mock("@/lib/image-generator", () => ({
  getProviderForPage: mocks.getProviderForPage,
  getImageToImageProviderForPage: mocks.getImageToImageProviderForPage,
  regeneratePage: mocks.regeneratePage,
}));

import { POST } from "@/app/api/illustration/route";

function createStory(page: StoryPage): GeneratedStory {
  return {
    id: "story-1",
    input: {
      childName: "童童",
      ageGroup: "4-5",
      theme: "custom",
      customTheme: "整理玩具",
      style: "fairytale",
      language: "zh-en",
    },
    coverTitle: "童童的整理冒险",
    pages: [page],
    createdAt: "2026-08-08T03:00:00.000Z",
    status: "generating_images",
    generationMode: "live",
  };
}

function createPage(overrides: Partial<StoryPage> = {}): StoryPage {
  return {
    page: 1,
    zhText: "童童开始整理玩具。",
    enText: "Tongtong started tidying toys.",
    illustrationPrompt: "A child tidying toys",
    imageStatus: "demo",
    ...overrides,
  };
}

function createRequest() {
  return new NextRequest("http://localhost/api/illustration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storyId: "story-1", page: 1 }),
  });
}

describe("illustration route request control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ILLUSTRATION_RATE_LIMIT_PER_STORY", "");
    mocks.allowIpRequest.mockResolvedValue(true);
    mocks.cacheStory.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reuses a recent pending job without spending rate-limit capacity", async () => {
    mocks.getCachedStory.mockResolvedValue(
      createStory(
        createPage({
          imageStatus: "pending",
          imageStartedAt: new Date(Date.now() - 30_000).toISOString(),
        }),
      ),
    );

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toMatchObject({ status: "accepted", reused: true });
    expect(mocks.allowIpRequest).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("uses a larger quota scoped to the current story for new jobs", async () => {
    mocks.getCachedStory.mockResolvedValue(createStory(createPage()));

    const response = await POST(createRequest());

    expect(response.status).toBe(202);
    expect(mocks.allowIpRequest).toHaveBeenCalledWith(
      expect.any(NextRequest),
      expect.objectContaining({
        limit: 64,
        prefix: "illustration",
        identifier: "story-1",
      }),
    );
    expect(mocks.after).toHaveBeenCalledTimes(1);
  });
});
