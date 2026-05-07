"use client";

interface ModeIndicatorProps {
  mode: "ar" | "ios-ar" | "gps";
}

const config = {
  ar: {
    dot: "bg-green-400",
    badge: "bg-green-500/20 border-green-400/40 text-green-300",
    label: "AR supported",
  },
  "ios-ar": {
    dot: "bg-blue-400",
    badge: "bg-blue-500/20 border-blue-400/40 text-blue-300",
    label: "iOS AR (Quick Look)",
  },
  gps: {
    dot: "bg-yellow-400",
    badge: "bg-yellow-500/20 border-yellow-400/40 text-yellow-300",
    label: "AR not supported — GPS mode",
  },
} as const;

export default function ModeIndicator({ mode }: ModeIndicatorProps) {
  const { dot, badge, label } = config[mode];
  return (
    <div
      className={`
        absolute top-4 left-1/2 -translate-x-1/2 z-10
        flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
        backdrop-blur-md border transition-all duration-500
        ${badge}
      `}
    >
      <span className={`w-2 h-2 rounded-full animate-pulse ${dot}`} />
      {label}
    </div>
  );
}
