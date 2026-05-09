"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { loadModel } from "@/lib/three/loadModel";

export interface GLTFLoaderResult {
  model: THREE.Group | null;
  mixer: THREE.AnimationMixer | null;
  progress: number;
  error: Error | null;
}

/**
 * Loads a GLB model, applies emission fixes, and starts all AnimationClips
 * on a THREE.AnimationMixer. Call mixer.update(delta) each frame.
 *
 * The returned model is a stable reference — it won't change between renders.
 */
export function useGLTFLoader(url: string): GLTFLoaderResult {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [mixer, setMixer] = useState<THREE.AnimationMixer | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  useEffect(() => {
    let cancelled = false;
    setProgress(0);
    setError(null);

    loadModel(url)
      .then(({ model: m, animations }) => {
        if (cancelled) return;

        const mix = new THREE.AnimationMixer(m);
        animations.forEach((clip) => mix.clipAction(clip).play());
        mixerRef.current = mix;

        setModel(m);
        setMixer(mix);
        setProgress(100);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err : new Error(String(err)));
      });

    return () => {
      cancelled = true;
      // Stop all actions on unmount so they don't accumulate in the cache
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
    };
  }, [url]);

  return { model, mixer, progress, error };
}
