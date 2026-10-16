import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@journey/shared", "@journey/job-tools"],
};

export default nextConfig;
