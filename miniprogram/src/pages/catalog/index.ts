import { filterBooks } from "../../core/catalog";
import { catalog } from "../../core/content";
Page({
  data: { series: catalog.series, books: catalog.books, query: "", seriesId: "", selectedTab: "series-all", count: catalog.books.length },
  onSearch(event: WechatMiniprogram.Input) {
    const query = event.detail.value;
    this.setData({ query, books: filterBooks(catalog.books, query, this.data.seriesId) });
  },
  selectSeries(event: WechatMiniprogram.TouchEvent) {
    const seriesId = String(event.currentTarget.dataset.id || "");
    this.setData({ seriesId, selectedTab: `series-${seriesId || "all"}`, books: filterBooks(catalog.books, this.data.query, seriesId) });
    wx.pageScrollTo({ scrollTop: 0, duration: 0 });
  },
  openBook(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id);
    const book = catalog.books.find(item => item.id === id);
    if (!book) return;
    wx.navigateTo({ url: `${book.readerPath || "/reader/index"}?id=${encodeURIComponent(id)}`, fail: () => wx.showToast({ title: "绘本加载失败，请重试", icon: "none" }) });
  },
});
