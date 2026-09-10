import type { Metadata, Viewport } from "next";
import AnalyticsConsentManager from "@/components/analytics/AnalyticsConsentManager";
import TawkToChat from "@/components/analytics/TawkToChat";
import FamilyPlatformNav from "@/components/layout/FamilyPlatformNav";
import Footer from "@/components/layout/Footer";
import { APP_METADATA_BASE } from "@/lib/site-url";
import WebAppRuntime from "@/components/pwa/WebAppRuntime";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  applicationName: "StoryBloom",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "StoryBloom" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  metadataBase: APP_METADATA_BASE,
  title: "StoryBloom | 把成长时刻留成家庭绘本",
  description:
    "记录孩子真实发生的一件小事，由家长确认事实后生成可朗读、可保存的家庭绘本；也支持从纯想象开始创作。",
  openGraph: {
    title: "StoryBloom | 把成长时刻留成家庭绘本",
    description: "记录一个真实时刻，确认事实，再把它变成以后还能翻开的家庭绘本。",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#fffdf8",
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
      <body data-clarity-mask="true">
        <Providers>
          {children}
          <FamilyPlatformNav />
          <Footer />
        </Providers>
        <WebAppRuntime />
        <AnalyticsConsentManager />
        <TawkToChat />
      </body>
    </html>
  );
}
