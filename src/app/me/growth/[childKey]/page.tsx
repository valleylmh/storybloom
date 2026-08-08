import AccountGrowthTimeline from "@/components/growth/AccountGrowthTimeline";
import type { GrowthDataSource } from "@/components/growth/growth-source-model";

interface Props {
  params: Promise<{ childKey: string }>;
  searchParams?: Promise<{ source?: string | string[] }>;
}

export const metadata = {
  title: "成长时间轴 | StoryBloom",
};

export default async function MyGrowthTimelinePage({ params, searchParams }: Props) {
  const { childKey } = await params;
  const query = searchParams ? await searchParams : {};
  const rawSource = Array.isArray(query.source)
    ? query.source[0]
    : query.source;
  const source: GrowthDataSource = rawSource === "cloud" ? "cloud" : "local";
  return <AccountGrowthTimeline childKey={childKey} source={source} />;
}
