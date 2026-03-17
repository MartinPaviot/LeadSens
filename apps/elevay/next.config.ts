import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  transpilePackages: ["@leadsens/db"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
