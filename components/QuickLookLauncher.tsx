"use client";

import { useEffect, useState } from "react";

interface QuickLookLauncherProps {
  usdzUrl: string;
  posterUrl?: string;
  onReady?: () => void;
}

// Inline SVG poster — Safari requires the <a rel="ar"> to contain exactly
// one <img> child with a valid image src, or it won't intercept the tap and
// open Quick Look. Using the .usdz path as src (the previous behaviour)
// shows a broken-image icon and confuses users.
const POSTER_DATA_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'>
  <defs>
    <radialGradient id='glow' cx='50%' cy='50%' r='55%'>
      <stop offset='0' stop-color='#ffd56b'/>
      <stop offset='0.6' stop-color='#e3a73c'/>
      <stop offset='1' stop-color='#5a3010'/>
    </radialGradient>
    <linearGradient id='bg' x1='0' y1='0' x2='0' y2='1'>
      <stop offset='0' stop-color='#1a0a00'/>
      <stop offset='1' stop-color='#3a1500'/>
    </linearGradient>
  </defs>
  <rect width='240' height='240' fill='url(#bg)'/>
  <ellipse cx='120' cy='130' rx='58' ry='75' fill='url(#glow)'/>
  <rect x='115' y='38' width='10' height='28' fill='#7a4a10'/>
  <rect x='100' y='32' width='40' height='8' rx='2' fill='#7a4a10'/>
  <rect x='100' y='198' width='40' height='8' rx='2' fill='#7a4a10'/>
  <text x='120' y='228' font-family='-apple-system, sans-serif' font-size='13'
        fill='#ffd56b' text-anchor='middle' opacity='0.9'>Tap to view in AR</text>
</svg>`);

export default function QuickLookLauncher({
  usdzUrl,
  posterUrl,
  onReady,
}: QuickLookLauncherProps) {
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    onReady?.();
    // Detect Quick Look support — Safari iOS adds `ar` to <a rel> tokens
    if (typeof document !== "undefined") {
      const a = document.createElement("a");
      const relSupported =
        a.relList && typeof a.relList.supports === "function"
          ? a.relList.supports("ar")
          : false;
      setSupported(relSupported);
    }
  }, [onReady]);

  // Apple Quick Look hash parameters, appended to the href:
  //   #allowsContentScaling=1  → user can pinch to scale (default; explicit for clarity)
  //   #callToAction=Place      → button label inside Quick Look
  //   #canonicalWebPageURL=…   → optional, lets the share sheet link back here
  // These hash params do NOT affect the model fetch — Safari strips them
  // before the request — but they DO affect Quick Look's UX.
  const arHref = `${usdzUrl}#allowsContentScaling=1&callToAction=Place`;

  return (
    <div className="relative w-full h-dvh flex flex-col items-center justify-center bg-gradient-to-b from-black via-stone-950 to-black px-6">
      <p className="text-white/70 text-xs uppercase tracking-[0.2em] mb-8">
        iOS AR · Apple Quick Look
      </p>

      {/* Safari REQUIRES the anchor to contain exactly one <img> child. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        rel="ar"
        href={arHref}
        className="block rounded-2xl overflow-hidden shadow-2xl shadow-yellow-500/30 border border-yellow-400/30 active:scale-95 transition-transform"
        style={{ width: 260, height: 260 }}
      >
        {/* Single <img> child only — no other children allowed */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={posterUrl ?? POSTER_DATA_URI}
          alt="Vesak Lantern — tap to view in AR"
          width={260}
          height={260}
          className="w-full h-full object-cover"
        />
      </a>

      <p className="text-white/60 text-sm mt-8 text-center max-w-xs leading-relaxed">
        Tap the lantern. Your camera will open — point at the floor, and your
        iPhone will place the lantern in front of you.
      </p>

      {supported === false && (
        <div className="mt-6 text-amber-300/90 text-xs text-center max-w-xs leading-relaxed">
          Your browser doesn&apos;t look like Safari iOS. AR Quick Look only works
          in Safari (or apps that use SFSafariViewController).
        </div>
      )}

      <p className="text-white/30 text-[10px] mt-10 text-center max-w-xs">
        Placement, scale, and rotation are handled by Apple AR. Pinch to resize
        and drag to rotate inside the Quick Look viewer.
      </p>
    </div>
  );
}
