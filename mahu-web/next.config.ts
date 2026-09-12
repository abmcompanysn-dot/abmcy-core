import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.abmcy.com",
      },
    ],
  },
};

export default nextConfig;
