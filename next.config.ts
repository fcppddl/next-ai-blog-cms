import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 生成独立产物，便于 Docker 多阶段构建与减小镜像体积
  output: "standalone",
};

export default nextConfig;
