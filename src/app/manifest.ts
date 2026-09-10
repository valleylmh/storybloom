import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "StoryBloom 家庭绘本", short_name: "StoryBloom",
    description: "把成长时刻留成家庭绘本，随时打开亲子共读。",
    lang: "zh-CN", start_url: "/library", scope: "/", display: "standalone",
    background_color: "#fffdf8", theme_color: "#fffdf8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
