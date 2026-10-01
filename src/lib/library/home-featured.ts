export type HomeFeaturedLibraryBook = {
  id: string;
  seriesId: "chengyu" | "xiyouji" | "haoqi";
  seriesTitle: string;
  title: string;
  subtitle: string;
  href: string;
  coverImage: string;
  accent: string;
};

// Keep this lightweight for the client homepage. A contract test verifies these
// entries against the canonical library catalog so the titles and routes cannot drift.
export const HOME_FEATURED_LIBRARY_BOOKS: HomeFeaturedLibraryBook[] = [
  {
    id: "shou-zhu-dai-tu",
    seriesId: "chengyu",
    seriesTitle: "成语故事",
    title: "守株待兔",
    subtitle: "等来等去的农夫",
    href: "/library/chengyu/shou-zhu-dai-tu",
    coverImage: "/library/chengyu/shou-zhu-dai-tu/1.webp",
    accent: "#b04a2f",
  },
  {
    id: "tian-kong-wei-shen-me-shi-lan-se",
    seriesId: "haoqi",
    seriesTitle: "好奇为什么",
    title: "天空为什么是蓝色的",
    subtitle: "阳光和空气的魔术",
    href: "/library/haoqi/tian-kong-wei-shen-me-shi-lan-se",
    coverImage: "/library/haoqi/tian-kong-wei-shen-me-shi-lan-se/1.webp",
    accent: "#b98346",
  },
  {
    id: "shi-hou-chu-shi",
    seriesId: "xiyouji",
    seriesTitle: "西游记",
    title: "石猴出世",
    subtitle: "花果山上蹦出的小猴王",
    href: "/library/xiyouji/shi-hou-chu-shi",
    coverImage: "/library/xiyouji/shi-hou-chu-shi/1.webp",
    accent: "#5c7560",
  },
];
