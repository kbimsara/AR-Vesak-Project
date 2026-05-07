"use client";

import { useEffect } from "react";

interface QuickLookLauncherProps {
  usdzUrl: string;
  posterUrl?: string;
  onReady?: () => void;
}

export default function QuickLookLauncher({
  usdzUrl,
  posterUrl,
  onReady,
}: QuickLookLauncherProps) {
  // Signal ready on mount — there is nothing async to wait for in this path.
  useEffect(() => {
    onReady?.();
  }, [onReady]);

  // Safari requires the <a rel="ar"> to contain exactly one <img> child.
  // Any extra DOM children inside the anchor disables Quick Look interception.
  return (
    <div className="relative w-full h-dvh flex flex-col items-center justify-center bg-black">
      <p className="text-white/70 text-sm mb-6 tracking-wide uppercase">
        Tap the lantern to view in AR
      </p>

      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        rel="ar"
        href={usdzUrl}
        className="block rounded-2xl overflow-hidden shadow-2xl shadow-yellow-500/20 border border-yellow-400/20 active:scale-95 transition-transform"
        style={{ width: 240, height: 240 }}
      >
        {/* Single <img> child required by Safari — no other children allowed */}
        <img
          src={posterUrl ?? usdzUrl}
          alt="Vesak Lantern — tap to place in AR"
          width={240}
          height={240}
          className="w-full h-full object-cover bg-yellow-900/30"
        />
      </a>

      <p className="text-white/40 text-xs mt-6 px-8 text-center leading-relaxed">
        iOS AR uses Apple&apos;s AR Quick Look — your device camera will open and
        you can place the lantern anywhere in the real world.
      </p>
    </div>
  );
}
