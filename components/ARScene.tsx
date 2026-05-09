"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import * as THREE from "three";
import { createRenderer } from "@/lib/three/createRenderer";
import { createReticle } from "@/lib/three/createReticle";
import { loadModel } from "@/lib/three/loadModel";

interface ARSceneProps {
  modelUrl: string;
  onReady?: () => void;
  /** Fired when WebXR claims support but `requestSession` actually fails. */
  onUnsupported?: (reason: string) => void;
}

// Real-world height the placed lantern should appear (metres).
// loadModel normalises the model to a 0.4 m bounding box, so a scale of
// 4 puts it at ~1.6 m — chest/head height in a real room.
const PLACED_SCALE = 4;

export default function ARScene({ modelUrl, onReady, onUnsupported }: ARSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const placedListRef = useRef<THREE.Group[]>([]);

  const [sessionState, setSessionState] = useState<"idle" | "starting" | "running">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [placedCount, setPlacedCount] = useState(0);

  const cleanup = useRef<(() => void) | null>(null);

  const init = useCallback(async () => {
    if (!mountRef.current || !canvasRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(1, 3, 2);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.01,
      20
    );

    const renderer = createRenderer(canvasRef.current);
    renderer.xr.enabled = true;
    rendererRef.current = renderer;

    const reticle = createReticle();
    scene.add(reticle);

    let modelTemplate: THREE.Group;
    try {
      modelTemplate = await loadModel(modelUrl);
    } catch (err) {
      console.error("[ARScene] Failed to load model", err);
      setErrorMessage(
        `Model failed to load: ${err instanceof Error ? err.message : "unknown"}`
      );
      onReady?.(); // unlock the UI so the button is visible
      return;
    }
    onReady?.();

    let hitTestSource: XRHitTestSource | null = null;
    let hitTestSourceRequested = false;

    const controller = renderer.xr.getController(0);
    controller.addEventListener("select", () => {
      if (!reticle.visible) return;

      const model = modelTemplate.clone();
      model.scale.setScalar(PLACED_SCALE);

      // Position from reticle, but keep upright (don't copy rotation so the
      // lantern always stands vertically regardless of surface orientation)
      const pos = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
      model.position.copy(pos);

      // Face the camera on the horizontal plane
      const camPos = new THREE.Vector3();
      camera.getWorldPosition(camPos);
      const toCam = new THREE.Vector3().subVectors(camPos, pos).setY(0);
      if (toCam.lengthSq() > 1e-6) {
        toCam.normalize();
        model.rotation.y = Math.atan2(toCam.x, toCam.z);
      }

      scene.add(model);
      placedListRef.current.push(model);
      setPlacedCount((n) => n + 1);
    });
    scene.add(controller);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    renderer.setAnimationLoop(async (_, frame) => {
      // Idle rotation only on placed lanterns
      for (const m of placedListRef.current) m.rotation.y += 0.005;

      if (frame) {
        const session = renderer.xr.getSession()!;
        const referenceSpace = renderer.xr.getReferenceSpace()!;

        if (!hitTestSourceRequested) {
          hitTestSourceRequested = true;
          try {
            const viewerSpace = await session.requestReferenceSpace("viewer");
            if (session.requestHitTestSource) {
              const src = await session.requestHitTestSource({ space: viewerSpace });
              hitTestSource = src ?? null;
            }
          } catch {
            // hit-test unavailable — reticle just won't show
          }

          session.addEventListener("end", () => {
            hitTestSourceRequested = false;
            hitTestSource = null;
            setSessionState("idle");
          });
        }

        if (hitTestSource) {
          const results = frame.getHitTestResults(hitTestSource);
          if (results.length > 0) {
            const hit = results[0];
            const pose = hit.getPose(referenceSpace);
            if (pose) {
              reticle.visible = true;
              reticle.matrix.fromArray(pose.transform.matrix);
            }
          } else {
            reticle.visible = false;
          }
        }
      }

      renderer.render(scene, camera);
    });

    cleanup.current = () => {
      renderer.setAnimationLoop(null);
      renderer.xr.getSession()?.end().catch(() => {});
      renderer.dispose();
      window.removeEventListener("resize", onResize);
      rendererRef.current = null;
    };
  }, [modelUrl, onReady]);

  useEffect(() => {
    init();
    return () => cleanup.current?.();
  }, [init]);

  const handleStartAR = useCallback(async () => {
    if (!navigator.xr) {
      setErrorMessage("WebXR not available in this browser");
      return;
    }
    const renderer = rendererRef.current;
    if (!renderer) {
      setErrorMessage("Renderer not ready yet — try again in a moment");
      return;
    }
    if (!window.isSecureContext) {
      setErrorMessage("WebXR requires HTTPS. Open the site over https://");
      return;
    }

    setSessionState("starting");
    setErrorMessage(null);

    try {
      const session = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["dom-overlay", "local-floor"],
        domOverlay: mountRef.current ? { root: mountRef.current } : undefined,
      } as XRSessionInit);

      await renderer.xr.setSession(session as XRSession);
      setSessionState("running");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      // Log so the dev console shows the full error on the device
      console.error("[ARScene] requestSession failed", err);
      setErrorMessage(msg);
      setSessionState("idle");
      onUnsupported?.(msg);
    }
  }, [onUnsupported]);

  const clearAll = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    for (const m of placedListRef.current) scene.remove(m);
    placedListRef.current = [];
    setPlacedCount(0);
  }, []);

  return (
    <div ref={mountRef} className="relative w-full h-dvh bg-black">
      {/* Canvas is non-interactive until AR starts so it can never eat the
          START AR button click on devices that mis-handle pointer events. */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 ${
          sessionState === "running" ? "" : "pointer-events-none"
        }`}
      />

      {/* In-AR overlay (visible during the immersive session) */}
      {sessionState === "running" && (
        <>
          {placedCount > 0 && (
            <div className="absolute top-6 left-5 bg-black/40 backdrop-blur border border-white/20 text-white text-xs px-3 py-1.5 rounded-full z-10 pointer-events-none">
              🏮 {placedCount}
            </div>
          )}
          {placedCount > 0 && (
            <button
              onClick={clearAll}
              className="absolute top-6 right-5 bg-black/40 backdrop-blur border border-white/20 text-white text-xs px-4 py-2 rounded-full z-10"
            >
              Clear all
            </button>
          )}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center text-xs text-white/80 pointer-events-none">
            {placedCount === 0
              ? "Move your phone to scan a surface, then tap to place"
              : "Tap again to add more lanterns"}
          </div>
        </>
      )}

      {/* Pre-AR launcher */}
      {sessionState !== "running" && (
        <div className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-4 z-10">
          <p className="text-center text-sm text-white/70 px-6">
            Point at a surface and tap to place the lantern
          </p>

          <button
            onClick={handleStartAR}
            disabled={sessionState === "starting"}
            className="px-8 py-3 rounded-full bg-white text-black font-medium text-sm tracking-wide shadow-lg active:scale-95 transition disabled:opacity-50"
          >
            {sessionState === "starting" ? "Starting…" : "START AR"}
          </button>

          {errorMessage && (
            <p className="text-xs text-red-300/80 px-6 text-center max-w-xs">
              AR failed to start: {errorMessage}. Falling back to GPS mode…
            </p>
          )}
        </div>
      )}
    </div>
  );
}
