"use client";

import { useEffect, useState } from "react";

interface StatusPillProps {
  message: string | null;
  /** Auto-dismiss delay in ms. Default 2500. Pass 0 to disable auto-dismiss. */
  duration?: number;
}

export default function StatusPill({ message, duration = 2500 }: StatusPillProps) {
  const [visible, setVisible] = useState(false);
  const [displayed, setDisplayed] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    setDisplayed(message);
    setVisible(true);

    if (duration <= 0) return;
    const t = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(t);
  }, [message, duration]);

  if (!displayed) return null;

  return (
    <div
      className={`absolute top-6 left-1/2 -translate-x-1/2 z-30 transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"
      }`}
    >
      <div className="bg-black/70 backdrop-blur border border-yellow-400/30 text-yellow-200 text-xs px-4 py-2 rounded-full whitespace-nowrap shadow-lg">
        {displayed}
      </div>
    </div>
  );
}
