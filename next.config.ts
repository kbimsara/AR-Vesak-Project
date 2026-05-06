import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Three.js addons that use browser APIs to be imported in client components
  transpilePackages: ["three"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Required for WebXR in some browsers
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
