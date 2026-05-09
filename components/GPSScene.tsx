"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import * as THREE from "three";
import { createRenderer } from "@/lib/three/createRenderer";
import { loadModel } from "@/lib/three/loadModel";
import { useDeviceOrientation } from "@/hooks/useDeviceOrientation";

interface GPSSceneProps {
  modelUrl: string;
  onReady?: () => void;
}

const MAX_PLACEMENT_DISTANCE = 20; // ray cap when not hitting the ground
const MIN_PLACEMENT_DISTANCE = 0.8;
const EYE_HEIGHT = 1.6;
// Apparent-size scale: keeps the lantern visually the same apparent size at any distance.
const autoScale = (dist: number) => Math.max(0.5, dist * 0.2);

export default function GPSScene({ modelUrl, onReady }: GPSSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const ghostRef = useRef<THREE.Group | null>(null);
  // Source of truth for placements — clone synchronously on tap
  const templateRef = useRef<THREE.Group | null>(null);
  // Single-placement: only one lantern at a time
  const placedRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rafRef = useRef<number>(0);

  const [hasPlaced, setHasPlaced] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const { orientation, permissionGranted, requestPermission } = useDeviceOrientation();
  const [needsPermission, setNeedsPermission] = useState(false);

  const touch = useRef({
    startX: 0,
    startY: 0,
    lastX: 0,
    lastDist: 0,
    rotating: false,
    pinching: false,
    moved: false,
  });

  // Where the user is actually pointing.
  // Cast a ray from the camera along the look direction:
  //   • If it hits the ground plane (y=0), drop the lantern there.
  //   • Otherwise place at MAX_PLACEMENT_DISTANCE along the ray.
  const crosshairWorldPos = useCallback((): THREE.Vector3 => {
    const cam = cameraRef.current;
    if (!cam) return new THREE.Vector3(0, 0, -MAX_PLACEMENT_DISTANCE);

    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    let dist = MAX_PLACEMENT_DISTANCE;

    if (dir.y < -0.02) {
      const groundDist = -cam.position.y / dir.y;
      if (groundDist > 0) dist = Math.min(dist, groundDist);
    }
    dist = Math.max(MIN_PLACEMENT_DISTANCE, dist);

    return cam.position.clone().addScaledVector(dir, dist);
  }, []);

  const applyGhostMaterial = (group: THREE.Group) => {
    group.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      child.material = mats.map((m: THREE.Material) => {
        const c = m.clone() as THREE.MeshStandardMaterial;
        c.transparent = true;
        c.opacity = 0.4;
        c.depthWrite = false;
        return c;
      });
    });
  };

  const init = useCallback(async () => {
    if (!canvasRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
    const dirLight = new THREE.DirectionalLight(0xc9a84c, 2);
    dirLight.position.set(2, 5, 3);
    scene.add(dirLight);

    // 60° vertical FOV ≈ typical phone rear camera, so the on-screen
    // crosshair points at (roughly) the same real direction as the video feed.
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.01,
      1000
    );
    camera.position.set(0, EYE_HEIGHT, 0);
    cameraRef.current = camera;

    const renderer = createRenderer(canvasRef.current);
    renderer.setClearAlpha(0);
    rendererRef.current = renderer;

    // Template kept un-mutated so placeModel can clone synchronously
    const { model: template } = await loadModel(modelUrl);
    templateRef.current = template;

    // Ghost preview = a separate clone with semi-transparent materials
    const ghost = template.clone();
    ghost.scale.setScalar(autoScale(MAX_PLACEMENT_DISTANCE));
    applyGhostMaterial(ghost);
    ghostRef.current = ghost;
    scene.add(ghost);

    onReady?.();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    let ghostRotY = 0;
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);

      if (ghostRef.current && cameraRef.current) {
        const pos = crosshairWorldPos();
        ghostRef.current.position.copy(pos);
        const d = pos.distanceTo(cameraRef.current.position);
        ghostRef.current.scale.setScalar(autoScale(d));
        ghostRotY += 0.004;
        ghostRef.current.rotation.y = ghostRotY;
      }

      if (placedRef.current) placedRef.current.rotation.y += 0.004;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      renderer.dispose();
      window.removeEventListener("resize", onResize);
    };
  }, [modelUrl, onReady, crosshairWorldPos]);

  // Device orientation → camera quaternion
  useEffect(() => {
    if (!cameraRef.current || !permissionGranted) return;
    const { alpha, beta, gamma } = orientation;
    const screenAngle = ((window.screen.orientation?.angle ?? 0) * Math.PI) / 180;
    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(beta),
      THREE.MathUtils.degToRad(alpha),
      THREE.MathUtils.degToRad(-gamma),
      "YXZ"
    );
    const q = new THREE.Quaternion().setFromEuler(euler);
    q.multiply(new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)));
    q.multiply(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -screenAngle)
    );
    cameraRef.current.quaternion.copy(q);
  }, [orientation, permissionGranted]);

  // iOS motion permission gate
  useEffect(() => {
    const D = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof D.requestPermission === "function" && !permissionGranted) {
      setNeedsPermission(true);
    }
  }, [permissionGranted]);

  // Tap → replace the lantern at the crosshair position. Synchronous so the
  // placement uses the camera quaternion as it was at the tap.
  const placeModel = useCallback(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const template = templateRef.current;
    if (!scene || !camera || !template) return;

    // Single-placement: remove the previous lantern if any
    if (placedRef.current) scene.remove(placedRef.current);

    const pos = crosshairWorldPos();
    const model = template.clone();

    const dist = pos.distanceTo(camera.position);
    model.scale.setScalar(autoScale(dist));
    model.position.copy(pos);

    const toCam = new THREE.Vector3()
      .subVectors(camera.position, pos)
      .setY(0);
    if (toCam.lengthSq() > 1e-6) {
      toCam.normalize();
      model.rotation.y = Math.atan2(toCam.x, toCam.z);
    }

    scene.add(model);
    placedRef.current = model;
    setHasPlaced(true);
  }, [crosshairWorldPos]);

  const removePlacement = useCallback(() => {
    const scene = sceneRef.current;
    if (scene && placedRef.current) {
      scene.remove(placedRef.current);
      placedRef.current = null;
    }
    setHasPlaced(false);
  }, []);

  // Touch handlers — drag/pinch target the placed lantern
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touch.current.startX = e.touches[0].clientX;
      touch.current.startY = e.touches[0].clientY;
      touch.current.lastX = e.touches[0].clientX;
      touch.current.rotating = true;
      touch.current.pinching = false;
      touch.current.moved = false;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touch.current.lastDist = Math.hypot(dx, dy);
      touch.current.pinching = true;
      touch.current.rotating = false;
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (touch.current.rotating && e.touches.length === 1) {
      const dx = Math.abs(e.touches[0].clientX - touch.current.startX);
      const dy = Math.abs(e.touches[0].clientY - touch.current.startY);
      if (dx > 6 || dy > 6) touch.current.moved = true;

      if (placedRef.current) {
        placedRef.current.rotation.y +=
          (e.touches[0].clientX - touch.current.lastX) * 0.01;
      }
      touch.current.lastX = e.touches[0].clientX;
    }

    if (touch.current.pinching && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (placedRef.current) {
        const ratio = dist / touch.current.lastDist;
        placedRef.current.scale.setScalar(
          THREE.MathUtils.clamp(placedRef.current.scale.x * ratio, 0.1, 20)
        );
      }
      touch.current.lastDist = dist;
    }
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (
        touch.current.rotating &&
        !touch.current.moved &&
        e.changedTouches.length === 1
      ) {
        placeModel();
      }
      touch.current.rotating = false;
      touch.current.pinching = false;
    },
    [placeModel]
  );

  useEffect(() => {
    const cleanup = init();
    return () => { cleanup.then((fn) => fn?.()); };
  }, [init]);

  // Back-camera feed
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera API not available");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        setCameraError(err instanceof Error ? err.message : "Camera blocked");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  return (
    <div
      className="relative w-full h-dvh bg-black overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Crosshair */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-white/60" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-3 bg-white/80" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-3 bg-white/80" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-px w-3 bg-white/80" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 h-px w-3 bg-white/80" />
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 shadow-[0_0_6px_2px_rgba(251,191,36,0.7)]" />
        </div>
      </div>

      {/* Remove button */}
      {hasPlaced && (
        <button
          className="absolute top-6 right-5 bg-black/40 backdrop-blur border border-white/20 text-white text-xs px-4 py-2 rounded-full z-10"
          onClick={removePlacement}
        >
          Remove
        </button>
      )}

      {/* iOS motion permission overlay */}
      {needsPermission && !permissionGranted && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
          <div className="bg-white/10 backdrop-blur rounded-2xl p-8 text-center max-w-xs mx-4">
            <p className="text-white mb-2 font-medium">Motion sensors needed</p>
            <p className="text-white/60 text-sm mb-6">
              The crosshair aims using your device orientation.
            </p>
            <button
              onClick={async () => {
                await requestPermission();
                setNeedsPermission(false);
              }}
              className="bg-yellow-400 text-black font-semibold px-6 py-2 rounded-full"
            >
              Enable
            </button>
          </div>
        </div>
      )}

      {/* Hint bar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-max text-center text-xs text-white/70 pointer-events-none space-y-1">
        {cameraError && <p className="text-red-300/90">Camera: {cameraError}</p>}
        {hasPlaced ? (
          <p>Tap a new spot to move · Drag/pinch to adjust</p>
        ) : (
          <p>Aim at a spot and tap to place the lantern</p>
        )}
      </div>
    </div>
  );
}
