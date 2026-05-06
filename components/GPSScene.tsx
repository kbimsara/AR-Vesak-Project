"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import * as THREE from "three";
import { createRenderer } from "@/lib/three/createRenderer";
import { loadModel } from "@/lib/three/loadModel";
import { forwardOffset } from "@/lib/geo/forwardOffset";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useDeviceOrientation } from "@/hooks/useDeviceOrientation";

interface GPSSceneProps {
  modelUrl: string;
  onReady?: () => void;
}

const PLACEMENT_DISTANCE = 5; // metres in front of user

export default function GPSScene({ modelUrl, onReady }: GPSSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rafRef = useRef<number>(0);
  const placedRef = useRef(false);

  const { position } = useGeolocation();
  const { orientation, permissionGranted, requestPermission } = useDeviceOrientation();
  const [needsPermission, setNeedsPermission] = useState(false);

  // ── Touch interaction state ──────────────────────────────────
  const touchState = useRef({
    lastX: 0,
    lastDist: 0,
    rotating: false,
    pinching: false,
  });

  const init = useCallback(async () => {
    if (!canvasRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Lighting
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
    const dirLight = new THREE.DirectionalLight(0xc9a84c, 2);
    dirLight.position.set(2, 5, 3);
    scene.add(dirLight);

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.01,
      1000
    );
    camera.position.set(0, 1.6, 0); // eye height
    cameraRef.current = camera;

    const renderer = createRenderer(canvasRef.current);
    rendererRef.current = renderer;

    // Load model
    const model = await loadModel(modelUrl);
    modelRef.current = model;
    scene.add(model);
    onReady?.();

    // Resize handler
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    // Animation loop
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      // Slow idle rotation
      if (modelRef.current) modelRef.current.rotation.y += 0.004;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      renderer.dispose();
      window.removeEventListener("resize", onResize);
    };
  }, [modelUrl, onReady]);

  // Check if iOS permission is needed
  useEffect(() => {
    const DevOrEvent = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    if (typeof DevOrEvent.requestPermission === "function" && !permissionGranted) {
      setNeedsPermission(true);
    }
  }, [permissionGranted]);

  // Apply device orientation to camera
  useEffect(() => {
    if (!cameraRef.current || !permissionGranted) return;

    const { alpha, beta, gamma } = orientation;
    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(beta),
      THREE.MathUtils.degToRad(alpha),
      THREE.MathUtils.degToRad(-gamma),
      "YXZ"
    );
    cameraRef.current.quaternion.setFromEuler(euler);
  }, [orientation, permissionGranted]);

  // Place model once we have GPS + heading
  useEffect(() => {
    if (!modelRef.current || placedRef.current || !position) return;
    placedRef.current = true;

    const offset = forwardOffset(orientation.alpha, PLACEMENT_DISTANCE);
    modelRef.current.position.copy(offset);
  }, [position, orientation.alpha]);

  // Touch: rotate (1 finger) & scale (2 finger pinch)
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchState.current.lastX = e.touches[0].clientX;
      touchState.current.rotating = true;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchState.current.lastDist = Math.hypot(dx, dy);
      touchState.current.pinching = true;
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!modelRef.current) return;
    if (touchState.current.rotating && e.touches.length === 1) {
      const delta = e.touches[0].clientX - touchState.current.lastX;
      modelRef.current.rotation.y += delta * 0.01;
      touchState.current.lastX = e.touches[0].clientX;
    }
    if (touchState.current.pinching && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const delta = dist / touchState.current.lastDist;
      const current = modelRef.current.scale.x;
      modelRef.current.scale.setScalar(THREE.MathUtils.clamp(current * delta, 0.1, 5));
      touchState.current.lastDist = dist;
    }
  };
  const onTouchEnd = () => {
    touchState.current.rotating = false;
    touchState.current.pinching = false;
  };

  useEffect(() => {
    const cleanup = init();
    return () => { cleanup.then((fn) => fn?.()); };
  }, [init]);

  return (
    <div
      ref={mountRef}
      className="relative w-full h-dvh"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Crosshair centre indicator */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-6 h-6 border-2 border-white/50 rounded-full" />
      </div>

      {/* iOS permission prompt */}
      {needsPermission && !permissionGranted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
          <div className="bg-white/10 backdrop-blur rounded-2xl p-8 text-center max-w-xs mx-4">
            <p className="text-white mb-4">Enable motion sensors for compass direction</p>
            <button
              onClick={async () => {
                await requestPermission();
                setNeedsPermission(false);
              }}
              className="bg-yellow-500 text-black font-semibold px-6 py-2 rounded-full"
            >
              Enable
            </button>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center text-xs text-white/60 pointer-events-none space-y-1">
        {position ? (
          <p>GPS locked · {position.accuracy.toFixed(0)} m accuracy</p>
        ) : (
          <p>Acquiring GPS…</p>
        )}
        <p>Drag to rotate · Pinch to scale</p>
      </div>
    </div>
  );
}
