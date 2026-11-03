import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { validBookAudio } from "../miniprogram/src/core/book-audio";
import { getLibraryChineseAudio } from "../src/lib/library-book-audio";
import { parseBuffer } from "music-metadata";

const ids = ["shan-dian-chu-zu-che-he-yu-tian-de-xiao-cheng-ke", "shan-dian-chu-zu-che-song-xiao-xiong-hui-jia", "da-zhong-pi-ka-song-xiao-shu-miao", "da-zhong-pi-ka-he-mu-ou-xi-de-da-ban-jia"];
ids.push(
  "shan-dian-chu-zu-che-song-wo-men-qu-zuo-chuan",
  "da-zhong-pi-ka-zuo-lun-chuan-mu-ou-xi-qu-xiao-dao",
  "xiao-qi-che-shang-gao-su-qu-kan-pao-che-la",
  "qi-che-kai-dao-tian-shang-qu-le-ma",
  "lv-deng-liang-le-wei-shen-me-hai-yao-deng-yi-deng",
  "xiao-qi-che-zhao-dao-le-ting-che-wei",
  "hong-se-pao-che-wei-shen-me-pa-de-di-di-de",
  "hong-se-pao-che-zen-me-zuo-shang-le-da-ka-che",
  "xiao-qi-che-de-deng-hui-shuo-hua-ma",
  "xiao-qi-che-zuan-jin-shan-li-le-ma",
  "lun-tai-shang-de-hua-wen-cang-zhe-shen-me-mi-mi",
  "xiao-qi-che-xi-zao-la",
);
it.each(ids)("serves every prepared Chinese page for %s", id => {
  const { book } = JSON.parse(readFileSync(`content-drafts/qiche/${id}.json`, "utf8"));
  const manifest = JSON.parse(readFileSync("miniprogram/chinese-audio-manifest.json", "utf8"));
  const audio = manifest[`qiche/${id}`];
  expect(validBookAudio(audio, book.pages.length)).toBe(true);
  expect(audio.contentHash).toBe(createHash("sha256").update(JSON.stringify({ version: 1, texts: book.pages.map((p: { zhText: string }) => p.zhText.trim()) })).digest("hex"));
  expect(getLibraryChineseAudio("qiche", id, book.pages)).toEqual(audio);
});

const scienceIds = [
  "wu-ren-ji-ba-kuai-di-song-shang-tian-le-ma",
  "gao-tie-xiao-fei-long-zen-yang-ping-wen-pao-de-kuai",
  "da-fei-ji-zai-pao-dao-shang-pai-dui-ma",
  "tian-shang-de-wei-xing-zen-me-gei-qi-che-yin-lu",
  "kong-zhong-chu-zu-che-zhen-de-neng-fei-qi-lai-ma",
];

const cityServiceIds = [
  "kuai-di-che-zen-me-zhao-dao-wo-de-bao-guo",
  "leng-cang-che-du-zi-li-cang-zhe-dong-tian-ma",
  "xiao-qi-che-zou-bu-dong-shui-lai-bang-bang-ta",
  "gong-jiao-che-zen-me-fang-xia-yi-zuo-xiao-qiao",
  "zhuang-man-gu-shi-de-qi-che-kai-dao-na-er-qu",
];
const localAudioCases = [
  ...scienceIds.map(id => ({ id, manifest: "qiche-43-47-audio.json" })),
  ...cityServiceIds.map(id => ({ id, manifest: "qiche-48-52-audio.json" })),
];

it.each(localAudioCases)("plays matching local Bailian narration and page timing for $id", async ({ id, manifest }) => {
  const { book } = JSON.parse(readFileSync(`content-drafts/qiche/${id}.json`, "utf8"));
  const local = JSON.parse(readFileSync("content-drafts/qiche/local-audio.json", "utf8"));
  const batch = JSON.parse(readFileSync(`content-drafts/qiche/${manifest}`, "utf8"));
  const audio = local[`qiche/${id}`];
  const hash = createHash("sha256").update(JSON.stringify({
    version: 1,
    texts: book.pages.map((page: { zhText: string }) => page.zhText.trim()),
  })).digest("hex");

  expect(audio.contentHash).toBe(hash);
  expect(audio.url).toBe(`/library/qiche/${id}/zh-${hash.slice(0, 16)}.mp3`);
  expect(validBookAudio({ ...audio, url: `https://local.invalid${audio.url}` }, book.pages.length)).toBe(true);
  expect(batch[`qiche/${id}`]).toEqual(audio);
  expect(getLibraryChineseAudio("qiche", id, book.pages)).toEqual(audio);
  const { format } = await parseBuffer(readFileSync(`public${audio.url}`));
  expect(format.codec).toBe("MPEG 2 Layer 3");
  expect(Math.abs(format.duration! - audio.duration)).toBeLessThan(0.1);
});

it("prefers the public traffic-light MP3 and retains the matching bundled backup", async () => {
  const id = "hong-lu-deng-wei-shen-me-hui-bian-se";
  const { book } = JSON.parse(readFileSync(`content-drafts/qiche/${id}.json`, "utf8"));
  const manifest = JSON.parse(readFileSync("miniprogram/chinese-audio-manifest.json", "utf8"));
  const original = manifest[`qiche/${id}`];
  const audio = getLibraryChineseAudio("qiche", id, book.pages)!;
  expect(audio).toEqual(original);
  expect(audio.url).toContain("/object/public/library-audio-public/");
  const bytes = readFileSync(`public/library/qiche/${id}/zh-${original.contentHash.slice(0, 16)}.mp3`);
  const { format } = await parseBuffer(bytes);
  expect(format.codec).toBe("MPEG 2 Layer 3");
  expect(Math.abs(format.duration! - audio.duration)).toBeLessThan(0.1);
});
