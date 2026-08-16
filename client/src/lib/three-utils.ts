/**
 * Shared Three.js utilities and reusable objects to reduce allocations.
 */

import * as THREE from "three";

// ── Reusable scratch objects (avoid per-frame allocations) ────────────────────
export const scratchVec3 = new THREE.Vector3();
export const scratchVec3_2 = new THREE.Vector3();
export const scratchVec3_3 = new THREE.Vector3();
export const scratchQuat = new THREE.Quaternion();
export const scratchMatrix4 = new THREE.Matrix4();
export const scratchColor = new THREE.Color();

// ── Common constants ───────────────────────────────────────────────────────────
export const ORIGIN = new THREE.Vector3(0, 0, 0);
export const UP = new THREE.Vector3(0, 1, 0);

// ── Shared geometries (reused across multiple meshes) ─────────────────────────
export const SHARED_SPHERE_GEOMETRY = new THREE.SphereGeometry(1, 48, 48);
export const SHARED_CIRCLE_GEOMETRY = new THREE.CircleGeometry(1, 32);
export const SHARED_RING_GEOMETRY = new THREE.RingGeometry(0.8, 1, 32);

/**
 * Compute bounding sphere for an Object3D and return its radius.
 */
export function computeBoundingRadius(obj: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  return Math.max(size.x, size.y, size.z) / 2;
}

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
 * Optimize a mesh for performance (disable frustum culling, precompute bounds).
 */
export function optimizeMesh(mesh: THREE.Mesh): void {
  mesh.frustumCulled = true;
  mesh.geometry?.computeBoundingSphere();
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
}

/**
 * Traverse an Object3D and optimize all child meshes.
 */
export function optimizeObject3D(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      optimizeMesh(child);
    }
  });
  obj.matrixAutoUpdate = false;
  obj.updateMatrix();
}

/**
 * Convert hex color string to THREE.Color.
 */
export function hexToColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

/**
 * Lerp between two Vector3 values (mutates target).
 */
export function lerpVec3(target: THREE.Vector3, dest: THREE.Vector3, alpha: number): void {
  target.lerp(dest, alpha);
}
