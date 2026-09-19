import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { validBookAudio } from "../miniprogram/src/core/book-audio";
import { getLibraryChineseAudio } from "../src/lib/library-book-audio";

const ids = ["shan-dian-chu-zu-che-he-yu-tian-de-xiao-cheng-ke", "shan-dian-chu-zu-che-song-xiao-xiong-hui-jia", "da-zhong-pi-ka-song-xiao-shu-miao", "da-zhong-pi-ka-he-mu-ou-xi-de-da-ban-jia"];
it.each(ids)("serves all 16 prepared Chinese pages for %s", id => {
  const { book } = JSON.parse(readFileSync(`content-drafts/qiche/${id}.json`, "utf8"));
  const manifest = JSON.parse(readFileSync("miniprogram/chinese-audio-manifest.json", "utf8"));
  const audio = manifest[`qiche/${id}`];
  expect(validBookAudio(audio, 16)).toBe(true);
  expect(audio.contentHash).toBe(createHash("sha256").update(JSON.stringify({ version: 1, texts: book.pages.map((p: { zhText: string }) => p.zhText.trim()) })).digest("hex"));
  expect(getLibraryChineseAudio("qiche", id, book.pages)).toEqual(audio);
});
