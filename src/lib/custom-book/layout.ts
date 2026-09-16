export const BOOK_LAYOUTS = {
  panorama: {
    name: "全景跨页",
    description: "大画面叙事，文字落在自然留白",
    prompt:
      "Full-bleed panorama. Reserve calm negative space for the text at the requested vertical position on EACH physical page.",
  },
  sidebar: {
    name: "弧线叙事",
    description: "大幅插画与弧形留白，轻盈错落",
    prompt:
      "Contemporary editorial picture book. Place the main narrative and faces in the upper 65 percent. Lower edges flow into organic curved paper whitespace reserved for text on each physical page. No boxed captions.",
  },
  embrace: {
    name: "电影诗页",
    description: "全幅光影与渐隐文字，沉浸舒展",
    prompt:
      "Cinematic full-bleed picture book with luminous atmosphere. Keep subjects in the upper two thirds. Reserve TWO quiet lower text areas, one per physical page, fading naturally into pale mist in the bottom 30 percent. No panels or frames.",
  },
  minimal: {
    name: "画册留白",
    description: "宽边画框、细线与留白，安静精致",
    prompt:
      "Art-book editorial illustration with elegant balanced composition, for a large gallery image surrounded by generous warm paper margins. Keep subjects away from outer crop edges. Text will sit below the framed illustration, never inside it.",
  },
} as const;
export type BookLayout = keyof typeof BOOK_LAYOUTS;
export function layoutTextBox(
  layout: BookLayout,
  pageWidth: number,
  height: number,
  side: number,
) {
  const origin = side * pageWidth;
  if (layout === "sidebar")
    return { x: origin + pageWidth * .1, y: height * .76, width: pageWidth * .8, height: height * .24 - 40 };
  if (layout === "embrace")
    return { x: origin + pageWidth * .12, y: height * .73, width: pageWidth * .76, height: height * .27 - 40 };
  if (layout === "minimal")
    return { x: origin + pageWidth * .12, y: height * .74, width: pageWidth * .76, height: height * .26 - 40 };
  return { x: origin + 48, y: 48, width: pageWidth - 96, height: height - 96 };
}
