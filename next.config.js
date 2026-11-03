/** @type {import('next').NextConfig} */
const nextConfig = {
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
