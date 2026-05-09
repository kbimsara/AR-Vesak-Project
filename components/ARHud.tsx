"use client";

interface ARHudProps {
  hasPlaced: boolean;
  animPaused: boolean;
  autoSpin: boolean;
  scale: number;
  onScaleDown: () => void;
  onScaleUp: () => void;
  onTogglePause: () => void;
  onToggleSpin: () => void;
  onRemove: () => void;
}

const PILL =
  "flex items-center justify-center rounded-full bg-black/70 backdrop-blur border border-yellow-400/40 text-yellow-300 text-xs font-medium transition active:scale-95 select-none";

export default function ARHud({
  hasPlaced,
  animPaused,
  autoSpin,
  scale,
  onScaleDown,
  onScaleUp,
  onTogglePause,
  onToggleSpin,
  onRemove,
}: ARHudProps) {
  if (!hasPlaced) return null;

  return (
    <>
      {/* Size + animation controls */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        <button
          onClick={onScaleDown}
          className={`${PILL} w-10 h-10 text-lg`}
          aria-label="Smaller"
        >
          −
        </button>

        <button
          onClick={onTogglePause}
          className={`${PILL} px-4 h-10 gap-1.5 ${animPaused ? "border-yellow-400 text-yellow-400" : ""}`}
          aria-label={animPaused ? "Play" : "Pause"}
        >
          {animPaused ? "▶" : "⏸"}
          <span>{animPaused ? "Play" : "Pause"}</span>
        </button>

        <button
          onClick={onScaleUp}
          className={`${PILL} w-10 h-10 text-lg`}
          aria-label="Bigger"
        >
          +
        </button>
      </div>

      {/* Spin + Remove row */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        <button
          onClick={onToggleSpin}
          className={`${PILL} px-4 h-9 gap-1.5 ${autoSpin ? "border-yellow-400 text-yellow-400" : ""}`}
          aria-label="Toggle auto-spin"
        >
          ↻ <span>{autoSpin ? "Spinning" : "Spin"}</span>
        </button>

        <div className="text-yellow-200/50 text-[11px] tabular-nums w-16 text-center">
          {(scale * 0.4).toFixed(2)} m
        </div>

        <button
          onClick={onRemove}
          className={`${PILL} px-4 h-9`}
          aria-label="Remove lantern"
        >
          ✕ Remove
        </button>
      </div>
    </>
  );
}
