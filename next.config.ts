import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Three.js addons that use browser APIs to be imported in client components
  transpilePackages: ["three"],
  // Note: COOP/COEP headers were removed — they are NOT required for WebXR
  // immersive-ar and `require-corp` actively breaks session start on Android
  // Chrome (the START AR button does nothing / no camera prompt).
};

export default nextConfig;
