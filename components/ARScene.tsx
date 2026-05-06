"use client";

import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import { createRenderer } from "@/lib/three/createRenderer";
import { createReticle } from "@/lib/three/createReticle";
import { loadModel } from "@/lib/three/loadModel";

interface ARSceneProps {
  modelUrl: string;
  onReady?: () => void;
}

export default function ARScene({ modelUrl, onReady }: ARSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const cleanup = useRef<(() => void) | null>(null);

  const init = useCallback(async () => {
    if (!mountRef.current || !canvasRef.current) return;

    // ── Scene ───────────────────────────────────────────────────
    const scene = new THREE.Scene();

    // ── Lighting ────────────────────────────────────────────────
    scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(1, 3, 2);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // ── Camera ──────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.01,
      20
    );

    // ── Renderer ────────────────────────────────────────────────
    const renderer = createRenderer(canvasRef.current);
    renderer.xr.enabled = true;

    // AR button — appended to the overlay div, not document.body
    const arButton = ARButton.createButton(renderer, {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["dom-overlay"],
      domOverlay: { root: mountRef.current },
    });
    arButton.id = "ar-button";
    mountRef.current.appendChild(arButton);

    // ── Reticle ──────────────────────────────────────────────────
    const reticle = createReticle();
    scene.add(reticle);

    // ── Load model ───────────────────────────────────────────────
    const modelTemplate = await loadModel(modelUrl);
    onReady?.();

    // ── Hit-test source ──────────────────────────────────────────
    let hitTestSource: XRHitTestSource | null = null;
    let hitTestSourceRequested = false;

    // ── Controller (tap) ─────────────────────────────────────────
    const controller = renderer.xr.getController(0);
    controller.addEventListener("select", () => {
      if (!reticle.visible) return;

      // Clone the model and place at reticle pose
      const model = modelTemplate.clone();
      model.position.setFromMatrixPosition(reticle.matrix);
      model.quaternion.setFromRotationMatrix(reticle.matrix);
      // Lift slightly so it sits on the surface
      model.position.y += 0.01;
      scene.add(model);
    });
    scene.add(controller);

    // ── Resize ───────────────────────────────────────────────────
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    // ── Animation loop ───────────────────────────────────────────
    renderer.setAnimationLoop(async (_, frame) => {
      // Rotate all placed models for visual interest
      scene.children.forEach((child) => {
        if (child !== reticle && child !== controller && child.type === "Group") {
          child.rotation.y += 0.005;
        }
      });

      if (frame) {
        const session = renderer.xr.getSession()!;
        const referenceSpace = renderer.xr.getReferenceSpace()!;

        // Request hit-test source once per session
        if (!hitTestSourceRequested) {
          hitTestSourceRequested = true;
          const viewerSpace = await session.requestReferenceSpace("viewer");
          if (session.requestHitTestSource) {
            const src = await session.requestHitTestSource({ space: viewerSpace });
            hitTestSource = src ?? null;
          }

          session.addEventListener("end", () => {
            hitTestSourceRequested = false;
            hitTestSource = null;
          });
        }

        // Update reticle from hit results
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
      if (arButton.parentNode) arButton.parentNode.removeChild(arButton);
    };
  }, [modelUrl, onReady]);

  useEffect(() => {
    init();
    return () => cleanup.current?.();
  }, [init]);

  return (
    <div ref={mountRef} className="relative w-full h-dvh">
      <canvas ref={canvasRef} className="absolute inset-0" />
      {/* Overlay hint */}
      <p className="absolute bottom-24 left-1/2 -translate-x-1/2 text-center text-sm text-white/70 pointer-events-none">
        Point at a surface and tap to place the lantern
      </p>
    </div>
  );
}
