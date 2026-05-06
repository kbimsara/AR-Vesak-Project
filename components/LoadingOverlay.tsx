"use client";

interface LoadingOverlayProps {
  message?: string;
}

export default function LoadingOverlay({ message = "Loading…" }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 gap-6">
      {/* Vesak lantern spinner */}
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-yellow-500/20" />
        <div className="absolute inset-0 rounded-full border-4 border-t-yellow-400 animate-spin" />
        <div className="absolute inset-2 rounded-full border-2 border-t-orange-400 animate-spin [animation-duration:1.5s] [animation-direction:reverse]" />
      </div>
      <p className="text-white/80 text-sm tracking-wide">{message}</p>
      <p className="text-white/30 text-xs">AR Vesak Experience</p>
    </div>
  );
}
