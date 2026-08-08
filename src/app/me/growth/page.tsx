import AccountGrowthLibrary from "@/components/growth/AccountGrowthLibrary";
import type { GrowthDataSource } from "@/components/growth/growth-source-model";

export const metadata = {
  title: "成长记录 | StoryBloom",
};

export default async function MyGrowthPage({
  searchParams,
}: {
  searchParams?: Promise<{ source?: string | string[] }>;
}) {
  const params = searchParams ? await searchParams : {};
  const rawSource = Array.isArray(params.source)
    ? params.source[0]
    : params.source;
  const requestedSource: GrowthDataSource | undefined =
    rawSource === "cloud" || rawSource === "local" ? rawSource : undefined;
  return <AccountGrowthLibrary requestedSource={requestedSource} />;
}
