/**
 * Shared Three.js utilities and reusable objects to reduce allocations.
 */

import * as THREE from "three";

// ── Shared geometries (reused across multiple meshes) ─────────────────────────
export const SHARED_SPHERE_GEOMETRY = new THREE.SphereGeometry(1, 48, 48);

/**
 * Normalize and center a GLB model to fit within a target radius.
 */
export function normalizeModel(scene: THREE.Object3D, targetRadius: number): void {
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = (targetRadius * 2) / maxDim;
  scene.scale.setScalar(scale);

  box.setFromObject(scene);
  const center = new THREE.Vector3();
  box.getCenter(center);
  scene.position.sub(center);
}

/**
 * Traverse an Object3D and optimize all child meshes.
 */
export function optimizeObject3D(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.frustumCulled = true;
      child.geometry?.computeBoundingSphere();
      child.matrixAutoUpdate = false;
      child.updateMatrix();
    }
  });
  obj.matrixAutoUpdate = false;
  obj.updateMatrix();
}
