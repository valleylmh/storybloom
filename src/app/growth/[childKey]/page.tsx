import GrowthTimeline from "@/components/growth/GrowthTimeline";
import { normalizeGrowthTimelineId } from "@/lib/growth-timeline-route";

interface Props {
  params: Promise<{ childKey: string }>;
  searchParams?: Promise<{ moment?: string | string[] }>;
}

export const metadata = {
  title: "成长时间轴 | StoryBloom",
  description: "按时间查看孩子的成长时刻、现场照片和专属绘本。",
};

export default async function GrowthTimelinePage({ params, searchParams }: Props) {
  const { childKey } = await params;
  const query = searchParams ? await searchParams : {};
  const rawMomentId = Array.isArray(query.moment)
    ? query.moment[0]
    : query.moment;
  const momentId = normalizeGrowthTimelineId(rawMomentId);
  return <GrowthTimeline childKey={childKey} momentId={momentId} />;
}
