import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { validBookAudio } from "../miniprogram/src/core/book-audio";
import { getLibraryChineseAudio } from "../src/lib/library-book-audio";
import { parseBuffer } from "music-metadata";

const ids = ["shan-dian-chu-zu-che-he-yu-tian-de-xiao-cheng-ke", "shan-dian-chu-zu-che-song-xiao-xiong-hui-jia", "da-zhong-pi-ka-song-xiao-shu-miao", "da-zhong-pi-ka-he-mu-ou-xi-de-da-ban-jia"];
ids.push("shan-dian-chu-zu-che-song-wo-men-qu-zuo-chuan", "da-zhong-pi-ka-zuo-lun-chuan-mu-ou-xi-qu-xiao-dao");
it.each(ids)("serves every prepared Chinese page for %s", id => {
  const { book } = JSON.parse(readFileSync(`content-drafts/qiche/${id}.json`, "utf8"));
  const manifest = JSON.parse(readFileSync("miniprogram/chinese-audio-manifest.json", "utf8"));
  const audio = manifest[`qiche/${id}`];
  expect(validBookAudio(audio, book.pages.length)).toBe(true);
  expect(audio.contentHash).toBe(createHash("sha256").update(JSON.stringify({ version: 1, texts: book.pages.map((p: { zhText: string }) => p.zhText.trim()) })).digest("hex"));
  expect(getLibraryChineseAudio("qiche", id, book.pages)).toEqual(audio);
});

it("serves the traffic-light book from a valid bundled MP3 with unchanged page timing", async () => {
  const id = "hong-lu-deng-wei-shen-me-hui-bian-se";
  const { book } = JSON.parse(readFileSync(`content-drafts/qiche/${id}.json`, "utf8"));
  const manifest = JSON.parse(readFileSync("miniprogram/chinese-audio-manifest.json", "utf8"));
  const original = manifest[`qiche/${id}`];
  const audio = getLibraryChineseAudio("qiche", id, book.pages)!;
  expect(audio).toEqual({ ...original, url: `/library/qiche/${id}/zh-${original.contentHash.slice(0, 16)}.mp3` });
  const bytes = readFileSync(`public${audio.url}`);
  const { format } = await parseBuffer(bytes);
  expect(format.codec).toBe("MPEG 2 Layer 3");
  expect(Math.abs(format.duration! - audio.duration)).toBeLessThan(0.1);
});
