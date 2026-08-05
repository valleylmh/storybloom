import GrowthTimeline from "@/components/growth/GrowthTimeline";

interface Props {
  params: Promise<{ childKey: string }>;
}

export const metadata = {
  title: "成长时间轴 | StoryBloom",
  description: "按时间查看孩子的成长时刻、现场照片和专属绘本。",
};

export default async function GrowthTimelinePage({ params }: Props) {
  const { childKey } = await params;
  return <GrowthTimeline childKey={childKey} />;
}
