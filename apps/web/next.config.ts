import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@trustlayer/contracts"],
  poweredByHeader: false,
};

export default nextConfig;

