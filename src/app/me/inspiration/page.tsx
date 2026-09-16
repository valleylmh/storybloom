import TodayInspirationCard from "@/components/inspiration/TodayInspirationCard";
import { getTodayPublicDailyInspiration } from "@/lib/inspiration/public-daily-inspiration";

export const dynamic = "force-dynamic";
export const metadata = { title: "今日灵感 | StoryBloom" };
export default async function MyInspirationPage() {
  const inspiration = await getTodayPublicDailyInspiration();
  return <main><TodayInspirationCard inspiration={inspiration} /></main>;
}
