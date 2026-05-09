import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

export interface LoadModelResult {
  model: THREE.Group;
  animations: THREE.AnimationClip[];
}

interface CacheEntry {
  model: THREE.Group;
  animations: THREE.AnimationClip[];
}

const cache = new Map<string, CacheEntry>();

function buildLoader(): GLTFLoader {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("/draco/");
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  return loader;
}

function applyMaterialFixes(model: THREE.Group) {
  model.traverse((node) => {
    if (!(node as THREE.Mesh).isMesh) return;
    const mesh = node as THREE.Mesh;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (!mat) return;

    // Emission fix: if emissive is near-black but the mesh has colour, copy it
    if (mat.emissive) {
      const e = mat.emissive;
      if (e.r + e.g + e.b < 0.02 && mat.color) {
        mat.emissive.copy(mat.color).multiplyScalar(0.35);
      }
      mat.emissiveIntensity = Math.max(mat.emissiveIntensity ?? 0, 1.0);
    }

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    if (mat.roughness !== undefined) {
      mat.roughness = Math.max(mat.roughness, 0.05);
    }
  });
}

export async function loadModel(url: string): Promise<LoadModelResult> {
  const hit = cache.get(url);
  if (hit) return { model: hit.model.clone(), animations: hit.animations };

  const loader = buildLoader();
  const gltf = await loader.loadAsync(url);
  const model = gltf.scene;

  // Normalise: fit inside a 0.4 m bounding box, centre at origin
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  model.scale.setScalar(0.4 / maxDim);
  const centre = box.getCenter(new THREE.Vector3());
  model.position.sub(centre.multiplyScalar(0.4 / maxDim));

  applyMaterialFixes(model);

  cache.set(url, { model, animations: gltf.animations });
  return { model: model.clone(), animations: gltf.animations };
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
