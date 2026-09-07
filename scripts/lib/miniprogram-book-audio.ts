import { createHash } from "node:crypto";
import type { Book } from "../../miniprogram/src/core/types";
export const bookAudioHash = (book: Book) => createHash("sha256").update(JSON.stringify({ version: 1, texts: book.pages.map(p => p.zh.trim()) })).digest("hex");
