import { ShelfRepository } from "./storage";
import type { BookSummary } from "./types";
const repository = new ShelfRepository({ get: key => wx.getStorageSync(key), set: (key, state) => wx.setStorageSync(key, state) },
  () => wx.showToast({ title: "本机存储不可用，记录暂存本次使用", icon: "none" }));
export const readShelf = (books: BookSummary[]) => repository.read(books);
export const toggleFavorite = (books: BookSummary[], id: string) => repository.toggle(books, id);
export const saveProgress = (books: BookSummary[], id: string, index: number) => repository.progress(books, id, index);
