import * as THREE from "three";

export function createReticle(): THREE.Mesh {
  const geometry = new THREE.RingGeometry(0.06, 0.09, 32).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    color: 0xc9a84c, // Vesak gold
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });
  const reticle = new THREE.Mesh(geometry, material);
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  return reticle;
}
