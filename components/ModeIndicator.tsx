"use client";

interface ModeIndicatorProps {
  mode: "ar" | "gps";
}

export default function ModeIndicator({ mode }: ModeIndicatorProps) {
  const isAR = mode === "ar";
  return (
    <div
      className={`
        absolute top-4 left-1/2 -translate-x-1/2 z-10
        flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
        backdrop-blur-md border transition-all duration-500
        ${isAR
          ? "bg-green-500/20 border-green-400/40 text-green-300"
          : "bg-yellow-500/20 border-yellow-400/40 text-yellow-300"
        }
      `}
    >
      <span
        className={`w-2 h-2 rounded-full animate-pulse ${
          isAR ? "bg-green-400" : "bg-yellow-400"
        }`}
      />
      {isAR ? "AR supported" : "AR not supported — GPS mode"}
    </div>
  );
}
