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

export default function ARScene({ modelUrl, onReady, onUnsupported }: ARSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const [sessionState, setSessionState] = useState<"idle" | "starting" | "running">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cleanup = useRef<(() => void) | null>(null);

  const init = useCallback(async () => {
    if (!mountRef.current || !canvasRef.current) return;

    const scene = new THREE.Scene();
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

    const modelTemplate = await loadModel(modelUrl);
    onReady?.();

    let hitTestSource: XRHitTestSource | null = null;
    let hitTestSourceRequested = false;

    const controller = renderer.xr.getController(0);
    controller.addEventListener("select", () => {
      if (!reticle.visible) return;
      const model = modelTemplate.clone();
      model.position.setFromMatrixPosition(reticle.matrix);
      model.quaternion.setFromRotationMatrix(reticle.matrix);
      model.position.y += 0.01;
      scene.add(model);
    });
    scene.add(controller);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    renderer.setAnimationLoop(async (_, frame) => {
      scene.children.forEach((child) => {
        if (child !== reticle && child !== controller && child.type === "Group") {
          child.rotation.y += 0.005;
        }
      });

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
    const renderer = rendererRef.current;
    if (!renderer || !navigator.xr) return;

    setSessionState("starting");
    setErrorMessage(null);

    try {
      const session = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["dom-overlay"],
        domOverlay: mountRef.current ? { root: mountRef.current } : undefined,
      } as XRSessionInit);

      await renderer.xr.setSession(session as XRSession);
      setSessionState("running");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setErrorMessage(msg);
      setSessionState("idle");
      // Real-device failure (e.g. Redmi without ARCore) — bubble up so the
      // app can switch to GPS mode automatically.
      onUnsupported?.(msg);
    }
  }, [onUnsupported]);

  return (
    <div ref={mountRef} className="relative w-full h-dvh">
      <canvas ref={canvasRef} className="absolute inset-0" />

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
