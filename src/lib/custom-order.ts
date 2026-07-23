export type CustomOrderPlatform = {
  id: "xiaohongshu" | "xianyu";
  label: string;
  actionLabel: string;
  url: string;
  pendingLabel: string;
};

export const CUSTOM_ORDER_PLATFORMS: CustomOrderPlatform[] = [
  {
    id: "xiaohongshu",
    label: "小红书",
    actionLabel: "小红书下单/咨询",
    url: process.env.NEXT_PUBLIC_XIAOHONGSHU_ORDER_URL || "",
    pendingLabel: "小红书链接即将上线",
  },
  {
    id: "xianyu",
    label: "闲鱼",
    actionLabel: "闲鱼下单/咨询",
    url: process.env.NEXT_PUBLIC_XIANYU_ORDER_URL || "",
    pendingLabel: "闲鱼链接即将上线",
  },
];

export function hasCustomOrderUrl(platform: CustomOrderPlatform) {
  return platform.url.trim().length > 0;
}
