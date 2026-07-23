/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["puppeteer", "ws"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "**.cloudflarestorage.com" },
    ],
  },
};

module.exports = nextConfig;
