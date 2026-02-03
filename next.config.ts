import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  // Silence Turbopack warning as we use next-pwa (webpack plugin)
  turbopack: {},
};

export default withPWA(nextConfig);
