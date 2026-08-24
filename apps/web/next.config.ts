import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@globe-chain/contracts", "@globe-chain/domain", "@globe-chain/db"]
};

export default nextConfig;
