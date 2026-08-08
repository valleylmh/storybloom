import GrowthTimeline from "@/components/growth/GrowthTimeline";

interface Props {
  params: Promise<{ childKey: string }>;
}

export const metadata = {
  title: "成长时间轴 | StoryBloom",
};

export default async function MyGrowthTimelinePage({ params }: Props) {
  const { childKey } = await params;
  return (
    <GrowthTimeline childKey={childKey} embedded basePath="/me/growth" />
  );
}
