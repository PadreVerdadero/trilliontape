import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client"],
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "cursor",
    "172.30.0.2",
    "*.localhost",
    "*.cursor.com",
    "*.cursor.sh",
    "*.cursorusercontent.com",
    "*.trycloudflare.com",
  ],
};

export default nextConfig;
