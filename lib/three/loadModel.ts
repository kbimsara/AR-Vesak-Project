import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

let cached: THREE.Group | null = null;

function buildLoader(): GLTFLoader {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("/draco/");
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  return loader;
}

export async function loadModel(url: string): Promise<THREE.Group> {
  if (cached) return cached.clone();

  const loader = buildLoader();
  const gltf = await loader.loadAsync(url);
  const model = gltf.scene;

  // Normalise: fit inside a 1-unit bounding box, centre at origin
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  model.scale.setScalar(0.4 / maxDim);
  const centre = box.getCenter(new THREE.Vector3());
  model.position.sub(centre.multiplyScalar(0.4 / maxDim));

  // Enable shadows
  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  cached = model;
  return model.clone();
}

export function disposeModel(model: THREE.Group) {
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
    }
  });
}
