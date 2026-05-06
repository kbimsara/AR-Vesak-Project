"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useXRSupport } from "@/hooks/useXRSupport";
import LoadingOverlay from "@/components/LoadingOverlay";
import ModeIndicator from "@/components/ModeIndicator";

// Three.js scenes must be client-only (they touch window/document)
const ARScene = dynamic(() => import("@/components/ARScene"), { ssr: false });
const GPSScene = dynamic(() => import("@/components/GPSScene"), { ssr: false });

const MODEL_URL = "/models/lantern.glb";

export default function Home() {
  const xrSupport = useXRSupport();
  const [modelReady, setModelReady] = useState(false);

  const isChecking = xrSupport === "checking";
  const isAR = xrSupport === "supported";

  const loadingMessage = isChecking
    ? "Checking AR support…"
    : isAR
    ? "Initialising AR…"
    : "Loading GPS experience…";

  return (
    <main className="relative w-full h-dvh bg-black overflow-hidden">
      {/* Loading overlay — shown until mode is decided AND model is ready */}
      {(!modelReady || isChecking) && (
        <LoadingOverlay message={loadingMessage} />
      )}

      {/* Mode badge */}
      {!isChecking && <ModeIndicator mode={isAR ? "ar" : "gps"} />}

      {/* Scene — rendered once mode is decided */}
      {!isChecking && isAR && (
        <ARScene modelUrl={MODEL_URL} onReady={() => setModelReady(true)} />
      )}
      {!isChecking && !isAR && (
        <GPSScene modelUrl={MODEL_URL} onReady={() => setModelReady(true)} />
      )}
    </main>
  );
}
