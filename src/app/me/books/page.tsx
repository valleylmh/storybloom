import BookshelfReadingSections from "@/components/account/BookshelfReadingSections";
import DeviceCloudStoryLibrary from "@/components/account/DeviceCloudStoryLibrary";
import ReadingSyncControl from "@/components/library/ReadingSyncControl";
import { getAllSeries, getSeriesBooks } from "@/lib/library";
import { createLibraryBookSummary } from "@/lib/library/catalog";

export const metadata = {
  title: "我的绘本 | StoryBloom",
};

export default function MyBooksPage() {
  const series = getAllSeries();
  const books = series.flatMap((item) =>
    getSeriesBooks(item.id)
      .filter((book) => !book.comingSoon)
      .map((book) => createLibraryBookSummary(item, book)),
  );

  return (
    <>
      <ReadingSyncControl />
      <BookshelfReadingSections books={books} />
      <section className="bookshelf-created-section" aria-label="我创作的绘本">
        <header>
          <p>家庭专属内容</p>
          <h2>我创作的</h2>
        </header>
        <DeviceCloudStoryLibrary />
      </section>
    </>
  );
}
