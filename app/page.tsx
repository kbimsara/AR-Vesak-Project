"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useXRSupport } from "@/hooks/useXRSupport";
import LoadingOverlay from "@/components/LoadingOverlay";
import ModeIndicator from "@/components/ModeIndicator";
import QuickLookLauncher from "@/components/QuickLookLauncher";

// Three.js scenes must be client-only (they touch window/document)
const ARScene = dynamic(() => import("@/components/ARScene"), { ssr: false });
const GPSScene = dynamic(() => import("@/components/GPSScene"), { ssr: false });

const MODEL_URL = "/models/lantern.glb";
const USDZ_URL = "/models/lantern.usdz";

export default function Home() {
  const xrSupport = useXRSupport();
  const [modelReady, setModelReady] = useState(false);

  const isChecking = xrSupport === "checking";
  const isWebXR = xrSupport === "supported";
  const isIOSAR = xrSupport === "ios-quicklook";
  const isGPS = xrSupport === "unsupported";

  const loadingMessage = isChecking
    ? "Checking AR support…"
    : isWebXR
    ? "Initialising AR…"
    : isIOSAR
    ? "Loading iOS AR…"
    : "Loading GPS experience…";

  const modeForIndicator = isWebXR ? "ar" : isIOSAR ? "ios-ar" : "gps";

  return (
    <main className="relative w-full h-dvh bg-black overflow-hidden">
      {/* Loading overlay — shown until mode is decided AND model is ready */}
      {(!modelReady || isChecking) && (
        <LoadingOverlay message={loadingMessage} />
      )}

      {/* Mode badge */}
      {!isChecking && <ModeIndicator mode={modeForIndicator} />}

      {/* WebXR scene — Android Chrome */}
      {!isChecking && isWebXR && (
        <ARScene modelUrl={MODEL_URL} onReady={() => setModelReady(true)} />
      )}

      {/* iOS AR Quick Look — iPhone / iPad */}
      {!isChecking && isIOSAR && (
        <QuickLookLauncher
          usdzUrl={USDZ_URL}
          onReady={() => setModelReady(true)}
        />
      )}

      {/* GPS fallback — desktop / unsupported devices */}
      {!isChecking && isGPS && (
        <GPSScene modelUrl={MODEL_URL} onReady={() => setModelReady(true)} />
      )}
    </main>
  );
}
