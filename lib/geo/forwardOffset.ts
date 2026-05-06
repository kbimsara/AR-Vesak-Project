import * as THREE from "three";

/**
 * Compute a 3D position offset for placing an object `distance` metres
 * directly in front of the user, using the compass heading (degrees, 0=North).
 * Three.js convention: -Z is forward, +X is East.
 */
export function forwardOffset(headingDeg: number, distance: number): THREE.Vector3 {
  const rad = THREE.MathUtils.degToRad(headingDeg);
  return new THREE.Vector3(
    Math.sin(rad) * distance,   // East offset
    0,
    -Math.cos(rad) * distance   // Forward (North) offset in Three.js space
  );
}
