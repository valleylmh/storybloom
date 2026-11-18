/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // Keep search engines on the one canonical domain. /api stays reachable on
    // the Vercel domain because scheduled jobs call the deployment directly.
    return [{
      source: "/:path((?!api/).*)",
      has: [{ type: "host", value: "storybloom-gamma.vercel.app" }],
      destination: "https://storybloom.valleylmh.vip/:path",
      permanent: true,
    }];
  },
  async headers() {
    return [{ source: "/sw.js", headers: [
      { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
      { key: "Service-Worker-Allowed", value: "/" },
    ] }];
  },
  serverExternalPackages: ["puppeteer", "ws"],
  images: {
    // Serve source images directly so Vercel's transformation quota cannot break them.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "**.cloudflarestorage.com" },
    ],
  },
};

module.exports = nextConfig;
