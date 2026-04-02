import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { hostname: "yt3.ggpht.com" },
      { hostname: "i.ytimg.com" },
    ],
  },
};

export default nextConfig;
