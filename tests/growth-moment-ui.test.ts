import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const timelineSource = readFileSync(
  new URL("../src/components/growth/GrowthTimeline.tsx", import.meta.url),
  "utf8",
);
const localRepositorySource = readFileSync(
  new URL("../src/lib/repositories/local-growth-repository.ts", import.meta.url),
  "utf8",
);
const cloudRepositorySource = readFileSync(
  new URL("../src/lib/repositories/cloud-growth-repository.ts", import.meta.url),
  "utf8",
);
const entrySource = readFileSync(
  new URL("../src/components/book/MinimalStoryEntry.tsx", import.meta.url),
  "utf8",
);
const controlsSource = readFileSync(
  new URL("../src/components/growth/GrowthArchiveControls.tsx", import.meta.url),
  "utf8",
);
const cloudControlsSource = readFileSync(
  new URL(
    "../src/components/growth/CloudGrowthArchiveControls.tsx",
    import.meta.url,
  ),
  "utf8",
);

describe("growth moment local UI contract", () => {
  it("exposes independent version, original-photo, and whole-Moment actions", () => {
    expect(timelineSource).toContain("删除当前版本");
    expect(timelineSource).toContain("删除现场照片");
    expect(timelineSource).toContain("删除整个时刻");
    expect(timelineSource).toContain("当前没有绘本版本");
  });

  it("wires Moment capabilities only into the local repository", () => {
    expect(localRepositorySource).toContain("moments: {");
    expect(localRepositorySource).toContain("selectVersion: selectLocalStorybookVersion");
    expect(cloudRepositorySource).not.toContain("moments:");
  });

  it("shows local capacity, deduplicates compressed photos, and refreshes after deletion", () => {
    expect(entrySource).toContain("normalizeAndDedupeGrowthAssets");
    expect(entrySource).toContain("estimateGrowthStorageCapacity");
    expect(timelineSource).toContain("refreshStorageCapacity");
    expect(timelineSource).toContain("本站本机空间");
  });

  it("keeps local export, retention preview, and complete deletion parent-controlled", () => {
    expect(controlsSource).toContain("createLocalGrowthArchiveZip");
    expect(controlsSource).toContain("createLocalGrowthRetentionPreview");
    expect(controlsSource).toContain("不会自动删除");
    expect(controlsSource).toContain("确认仅删除本机档案");
    expect(controlsSource).toContain("clearAll");
    expect(cloudRepositorySource).not.toContain("clearAll");
  });

  it("keeps private-cloud governance authenticated, scoped, and separate from local data", () => {
    expect(cloudControlsSource).toContain("/api/account/growth-archive/export");
    expect(cloudControlsSource).toContain(
      "DELETE_ALL_CLOUD_GROWTH_CONFIRMATION",
    );
    expect(cloudControlsSource).toContain("不会读取、上传或删除当前设备");
    expect(cloudControlsSource).toContain("普通绘本馆");
    expect(cloudControlsSource).toContain("不会自动删除");
    expect(cloudRepositorySource).not.toContain("moments:");
  });
});
