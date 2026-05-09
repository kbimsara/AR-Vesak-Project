"use client";

interface AROverlayProps {
  onLaunch: () => void;
  /** "idle" = not yet started, "starting" = session requested, "running" = active */
  sessionState: "idle" | "starting" | "running";
  errorMessage: string | null;
}

export default function AROverlay({ onLaunch, sessionState, errorMessage }: AROverlayProps) {
  if (sessionState === "running") return null;

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-end pb-12 pointer-events-none">
      {/* Floating lantern icon */}
      <div className="mb-8 flex flex-col items-center gap-3 pointer-events-none">
        <div
          className="text-6xl animate-bounce"
          style={{ filter: "drop-shadow(0 0 16px rgba(251,191,36,0.7))" }}
        >
          🏮
        </div>
        <p className="text-white/70 text-sm text-center px-8 max-w-xs">
          Point your camera at a flat surface and tap to place the Vesak lantern
        </p>
      </div>

      {errorMessage && (
        <p className="text-red-300/80 text-xs text-center px-6 mb-4 max-w-xs">
          {errorMessage}
        </p>
      )}

      <button
        onClick={onLaunch}
        disabled={sessionState === "starting"}
        className="pointer-events-auto px-10 py-3.5 rounded-full bg-yellow-400 text-black font-semibold text-sm tracking-wide shadow-[0_0_24px_rgba(251,191,36,0.5)] active:scale-95 transition disabled:opacity-50 disabled:cursor-wait"
      >
        {sessionState === "starting" ? "Starting…" : "Launch AR"}
      </button>
    </div>
  );
}
