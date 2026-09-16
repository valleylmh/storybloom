import BookshelfShareManager from "@/components/account/BookshelfShareManager";
import UnifiedStoryLibrary from "@/components/account/UnifiedStoryLibrary";
export const metadata = { title: "我的绘本 | StoryBloom" };
export default function MyBooksPage() {
  return <><UnifiedStoryLibrary /><details className="growth-sync-details"><summary>管理已分享的链接</summary><BookshelfShareManager /></details></>;
}
