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

const PLACEMENT_DISTANCE = 2.5; // metres in front of user
const EYE_HEIGHT = 1.6;
const LANTERN_HEIGHT = 1.2; // place around chest/face level so it's centred

export default function GPSScene({ modelUrl, onReady }: GPSSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rafRef = useRef<number>(0);
  const placedRef = useRef(false);

  const { position } = useGeolocation();
  const { orientation, permissionGranted, requestPermission } = useDeviceOrientation();
  const [needsPermission, setNeedsPermission] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

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
    camera.position.set(0, EYE_HEIGHT, 0); // eye height
    cameraRef.current = camera;

    const renderer = createRenderer(canvasRef.current);
    renderer.setClearAlpha(0); // ensure camera-feed video shows through
    rendererRef.current = renderer;

    // Load model
    const model = await loadModel(modelUrl);
    // Bump up so the 0.4 m bbox lantern is comfortably visible at 2.5 m
    model.scale.multiplyScalar(2.5);
    modelRef.current = model;
    // Place immediately, eye-level, straight ahead — visible even before GPS
    model.position.set(0, LANTERN_HEIGHT, -PLACEMENT_DISTANCE);
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

  // Apply device orientation to camera (matches three.js DeviceOrientationControls)
  useEffect(() => {
    if (!cameraRef.current || !permissionGranted) return;

    const { alpha, beta, gamma } = orientation;

    // Screen orientation in radians (rotate 0/90/-90/180 depending on device)
    const screenAngle =
      typeof window !== "undefined"
        ? ((window.screen.orientation?.angle ?? 0) * Math.PI) / 180
        : 0;

    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(beta),
      THREE.MathUtils.degToRad(alpha),
      THREE.MathUtils.degToRad(-gamma),
      "YXZ"
    );

    const q = new THREE.Quaternion().setFromEuler(euler);
    // Camera looks out the back of the device, not "up" through the screen
    q.multiply(new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)));
    // Account for the user holding the phone in portrait/landscape
    const screenCorr = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      -screenAngle
    );
    q.multiply(screenCorr);

    cameraRef.current.quaternion.copy(q);
  }, [orientation, permissionGranted]);

  // Re-place model on the compass heading once we have GPS + heading
  useEffect(() => {
    if (!modelRef.current || placedRef.current || !position) return;
    placedRef.current = true;

    const offset = forwardOffset(orientation.alpha, PLACEMENT_DISTANCE);
    offset.y = LANTERN_HEIGHT;
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

  // ── Back-camera feed (getUserMedia) ──────────────────────────
  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera API not available");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // play() needs to be awaited on iOS; ignore AbortError on unmount.
          videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Camera blocked";
        setCameraError(msg);
      }
    };
    start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="relative w-full h-dvh bg-black"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Live back-camera feed — sits behind the transparent Three.js canvas */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />
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
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center text-xs text-white/70 pointer-events-none space-y-1">
        {cameraError && (
          <p className="text-red-300/90">Camera: {cameraError}</p>
        )}
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
