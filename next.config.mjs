import { resolve } from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [],
  turbopack: {
    root: resolve(".")
  }
};

export default nextConfig;
