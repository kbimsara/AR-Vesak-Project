"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import * as THREE from "three";
import { createRenderer } from "@/lib/three/createRenderer";
import { createReticle } from "@/lib/three/createReticle";
import { useGLTFLoader } from "@/hooks/useGLTFLoader";
import AROverlay from "@/components/AROverlay";
import ARHud from "@/components/ARHud";
import StatusPill from "@/components/StatusPill";

interface ARSceneProps {
  modelUrl: string;
  onReady?: () => void;
  onUnsupported?: (reason: string) => void;
}

const DEFAULT_SCALE = 1;
const MIN_SCALE = 0.25;
const MAX_SCALE = 4;

export default function ARScene({ modelUrl, onReady, onUnsupported }: ARSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const clockRef = useRef(new THREE.Clock());

  // Single-placement model — the loaded model IS the placed object (no clone)
  const placedRef = useRef<THREE.Group | null>(null);

  const [sessionState, setSessionState] = useState<"idle" | "starting" | "running">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasPlaced, setHasPlaced] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [placeScale, setPlaceScale] = useState(DEFAULT_SCALE);
  const placeScaleRef = useRef(DEFAULT_SCALE);

  const [animPaused, setAnimPaused] = useState(false);
  const animPausedRef = useRef(false);

  const [autoSpin, setAutoSpin] = useState(true);
  const autoSpinRef = useRef(true);

  const cleanup = useRef<(() => void) | null>(null);

  const { model: modelTemplate, mixer, error: modelError } = useGLTFLoader(modelUrl);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  // Keep mixerRef in sync so the render loop always sees the latest mixer
  useEffect(() => {
    mixerRef.current = mixer;
  }, [mixer]);

  // Signal ready once model loads (or errors)
  useEffect(() => {
    if (modelTemplate || modelError) onReady?.();
  }, [modelTemplate, modelError, onReady]);

  const init = useCallback(() => {
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
    cameraRef.current = camera;

    const renderer = createRenderer(canvasRef.current);
    renderer.xr.enabled = true;
    rendererRef.current = renderer;

    const reticle = createReticle();
    scene.add(reticle);

    let hitTestSource: XRHitTestSource | null = null;
    let hitTestSourceRequested = false;

    const controller = renderer.xr.getController(0);
    controller.addEventListener("select", () => {
      if (!reticle.visible) return;
      const template = modelTemplate;
      if (!template) return;

      // Single-placement: move template to reticle position (no clone needed)
      if (!placedRef.current) {
        scene.add(template);
        placedRef.current = template;
        setHasPlaced(true);
        setStatus("Lantern placed! Tap again to move");
      }

      const pos = new THREE.Vector3().setFromMatrixPosition(reticle.matrix);
      template.position.copy(pos);
      template.scale.setScalar(placeScaleRef.current);

      const camPos = new THREE.Vector3();
      camera.getWorldPosition(camPos);
      const toCam = new THREE.Vector3().subVectors(camPos, pos).setY(0);
      if (toCam.lengthSq() > 1e-6) {
        toCam.normalize();
        template.rotation.y = Math.atan2(toCam.x, toCam.z);
      }
    });
    scene.add(controller);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    renderer.setAnimationLoop(async (_, frame) => {
      const delta = clockRef.current.getDelta();

      // Advance animations if not paused
      if (!animPausedRef.current) {
        mixerRef.current?.update(delta);
      }

      // Auto-spin the placed lantern
      if (placedRef.current && autoSpinRef.current) {
        placedRef.current.rotation.y += 0.005;
      }

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
            // hit-test unavailable — reticle stays hidden
          }

          session.addEventListener("end", () => {
            hitTestSourceRequested = false;
            hitTestSource = null;
            if (placedRef.current && sceneRef.current) {
              sceneRef.current.remove(placedRef.current);
              placedRef.current = null;
            }
            setHasPlaced(false);
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
  }, [modelTemplate]);

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
      setErrorMessage("Renderer not ready — try again in a moment");
      return;
    }
    if (!window.isSecureContext) {
      setErrorMessage("WebXR requires HTTPS");
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
      clockRef.current.start();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[ARScene] requestSession failed", err);
      setErrorMessage(msg);
      setSessionState("idle");
      onUnsupported?.(msg);
    }
  }, [onUnsupported]);

  const removePlacement = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene || !placedRef.current) return;
    scene.remove(placedRef.current);
    placedRef.current = null;
    setHasPlaced(false);
    setStatus("Lantern removed");
  }, []);

  const updateScale = useCallback((next: number) => {
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
    placeScaleRef.current = clamped;
    setPlaceScale(clamped);
    if (placedRef.current) placedRef.current.scale.setScalar(clamped);
  }, []);

  const togglePause = useCallback(() => {
    setAnimPaused((prev) => {
      const next = !prev;
      animPausedRef.current = next;
      if (next) {
        mixerRef.current?.timeScale !== undefined && (mixerRef.current.timeScale = 0);
      } else {
        if (mixerRef.current) mixerRef.current.timeScale = 1;
      }
      setStatus(next ? "Animation paused" : "Animation playing");
      return next;
    });
  }, []);

  const toggleSpin = useCallback(() => {
    setAutoSpin((prev) => {
      const next = !prev;
      autoSpinRef.current = next;
      setStatus(next ? "Auto-spin on" : "Auto-spin off");
      return next;
    });
  }, []);

  return (
    <div ref={mountRef} className="relative w-full h-dvh bg-black">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 ${
          sessionState === "running" ? "" : "pointer-events-none"
        }`}
      />

      <StatusPill message={status} />

      {/* Pre-AR landing overlay */}
      {sessionState !== "running" && (
        <AROverlay
          onLaunch={handleStartAR}
          sessionState={sessionState}
          errorMessage={errorMessage}
        />
      )}

      {/* In-AR HUD controls */}
      {sessionState === "running" && (
        <>
          <ARHud
            hasPlaced={hasPlaced}
            animPaused={animPaused}
            autoSpin={autoSpin}
            scale={placeScale}
            onScaleDown={() => updateScale(placeScale / 1.4)}
            onScaleUp={() => updateScale(placeScale * 1.4)}
            onTogglePause={togglePause}
            onToggleSpin={toggleSpin}
            onRemove={removePlacement}
          />

          {!hasPlaced && (
            <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center text-xs text-white/70 pointer-events-none">
              Move your phone to scan a surface, then tap to place
            </p>
          )}
        </>
      )}
    </div>
  );
}
