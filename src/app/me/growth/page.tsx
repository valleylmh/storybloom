import GrowthLibrary from "@/components/growth/GrowthLibrary";

export const metadata = {
  title: "成长记录 | StoryBloom",
};

export default function MyGrowthPage() {
  return <GrowthLibrary embedded basePath="/me/growth" />;
}
