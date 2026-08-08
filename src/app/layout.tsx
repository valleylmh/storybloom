import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import ClarityAnalytics from "@/components/analytics/ClarityAnalytics";
import TawkToChat from "@/components/analytics/TawkToChat";
import Footer from "@/components/layout/Footer";
import { APP_METADATA_BASE } from "@/lib/site-url";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: APP_METADATA_BASE,
  title: "StoryBloom | 一句话生成一本儿童绘本",
  description:
    "写下一句话，免费生成完整儿童绘本；订阅每日绘本灵感、朗读与家庭分享内容。",
  openGraph: {
    title: "StoryBloom | 一句话生成一本儿童绘本",
    description: "一句话、一个场景、一天一本免费儿童绘本。",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <meta
          name="google-site-verification"
          content="q5VVkwXgzlXATGPVkfoAdsMnEVNXDytB0dVufv_eHy8"
        />
      </head>
      <body>
        <Providers>
          {children}
          <Footer />
        </Providers>
        <Analytics />
        <ClarityAnalytics />
        <TawkToChat />
      </body>
    </html>
  );
}
