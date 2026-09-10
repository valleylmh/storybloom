import { shelfBooks } from "../../core/catalog";
import { catalog } from "../../core/content";
import { readShelf, toggleFavorite } from "../../core/device";
import type { BookSummary } from "../../core/types";
type ShelfRow = BookSummary & { favorite: boolean; pageNumber: number };
Page({
  onShareAppMessage() { return { title: "一起听故事 · 绘本馆", path: "/pages/catalog/index" }; },

  data: { tab: "recent" as "recent" | "favorites", books: [] as ShelfRow[] },
  onShow() { this.refresh(); },
  refresh() {
    const state = readShelf(catalog.books);
    this.setData({ books: shelfBooks(catalog.books, state, this.data.tab).map(book => ({ ...book, favorite: Boolean(state.favorites[book.id]), pageNumber: state.progress[book.id] ? state.progress[book.id].pageIndex + 1 : 0 })) });
  },
  changeTab(event: WechatMiniprogram.TouchEvent) {
    this.setData({ tab: event.currentTarget.dataset.tab === "favorites" ? "favorites" : "recent" });
    this.refresh();
  },
  toggle(event: WechatMiniprogram.TouchEvent) {
    toggleFavorite(catalog.books, String(event.currentTarget.dataset.id));
    this.refresh();
  },
  openBook(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id);
    const book = catalog.books.find(item => item.id === id);
    if (!book) return;
    wx.navigateTo({ url: `${book.readerPath || "/reader/index"}?id=${encodeURIComponent(id)}`, fail: () => wx.showToast({ title: "绘本加载失败，请重试", icon: "none" }) });
  },
  browse() { wx.switchTab({ url: "/pages/catalog/index" }); },
});
