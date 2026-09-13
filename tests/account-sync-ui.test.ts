import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { groupGrowthRecordsByChild } from "@/lib/growth-records";

const requireModule = createRequire(import.meta.url);
function renderFile(file: string, account: Record<string, unknown>) {
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} as { default: ComponentType } };
  const load = (id: string): unknown => {
    if (id === "react" || id === "react/jsx-runtime") return requireModule(id);
    if (id === "next/link") return ({ children, href }: {children: string; href: string}) => createElement("a", { href }, children);
    if (id.includes("AccountSyncProvider")) return { useAccountSync: () => account };
    if (id.includes("useAuth")) return { useAuth: () => ({ session: {user: {id: "test"}}, supabase: {} }) };
    if (id.includes("AccountSyncStatus")) return () => createElement("p", {role: "status"}, "账号记录已同步");
    if (id.includes("growth-records")) return { groupGrowthRecordsByChild };
    if (id.endsWith(".css")) return new Proxy({}, { get: (_target, name) => String(name) });
    return {};
  };
  new Function("require", "module", "exports", compiled)(load, module, module.exports);
  return renderToStaticMarkup(createElement(module.exports.default));
}
const story = { storyId: "a", clientStoryId: "a", result: {coverTitle: "第一次种花", pages: [{imageUrl: "/flower.webp"}]} };
describe("unified account screens", () => {
  it("renders one book card with ordinary read/edit/delete actions", () => {
    const html = renderFile("src/components/account/UnifiedStoryLibrary.tsx", {stories: [story], loading: false});
    expect(html.match(/<article/g)).toHaveLength(1);
    expect(html).toContain("第一次种花");
    expect(html).toContain(">阅读<");
    expect(html).not.toContain("保存到本机并打开");
    expect(html).not.toContain("仅删除云端");
  });
  it("groups records into one child shelf and uses account routes", () => {
    const growth = { id: "a", childKey: "child-a", childName: "小雨", story: {...story.result, pages: []}, photos: [], occurredOn: "2026-09-13", updatedAt: "2026-09-13" };
    const html = renderFile("src/components/growth/UnifiedGrowthLibrary.tsx", {growth: [growth], loading: false});
    expect(html).toContain("/me/growth/child-a");
    expect(html).toContain("小雨的成长故事");
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain("两份独立副本");
  });
  it("does not present an empty archive while initial synchronization is loading", () => {
    const html = renderFile("src/components/growth/UnifiedGrowthLibrary.tsx", {growth: [], loading: true});
    expect(html).not.toContain("还没有成长记录");
  });
});
