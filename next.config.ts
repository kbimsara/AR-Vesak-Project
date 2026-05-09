import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Three.js addons that use browser APIs to be imported in client components
  transpilePackages: ["three"],
  // Note: COOP/COEP headers were removed — they are NOT required for WebXR
  // immersive-ar and `require-corp` actively breaks session start on Android
  // Chrome (the START AR button does nothing / no camera prompt).

  // Serve .usdz with the official MIME type so Safari's AR Quick Look will
  // intercept the link reliably. Some hosts default to application/octet-stream
  // which can cause Quick Look to download the file instead of opening AR.
  async headers() {
    return [
      {
        source: "/:path*\\.usdz",
        headers: [
          { key: "Content-Type", value: "model/vnd.usdz+zip" },
          // Allow cross-origin embedding if ever needed (e.g. from a CDN)
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
};

export default nextConfig;
