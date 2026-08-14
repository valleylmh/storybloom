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
});
