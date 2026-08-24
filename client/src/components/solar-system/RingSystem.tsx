/**
 * RingSystem.tsx
 *
 * Renders planetary ring systems with astronomically accurate parameters.
 * Supports Saturn, Jupiter, Uranus, Neptune, and Haumea.
 *
 * Rings are a custom fan geometry with radial UVs (u = radius, v = azimuth)
 * textured by a per-body canvas texture — Saturn gets its classic banded
 * structure (C ring, bright B ring, Cassini division, A ring, Encke dip),
 * the others a soft banded gradient. The azimuthal texture axis fakes the
 * bright-side/dark-side illumination gradient.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Body } from "./bodies";

interface RingParameters {
  innerRadius: number;   // Planet radii
  outerRadius: number;   // Planet radii
  inclination: number;   // Degrees, relative to planet equator
  opticalDepth: number;  // 0-1, affects opacity
  color: string;
  segments: number;
}

// [from, to, alpha] bands along the ring radius (0 = inner, 1 = outer).
// Alpha values are relative — scaled by maxOpacity below.
const SATURN_BANDS: Array<[number, number, number]> = [
  [0.00, 0.05, 0.0],
  [0.05, 0.34, 0.38],  // C ring (faint, broad)
  [0.34, 0.44, 0.55],  // inner B ring ramp
  [0.44, 0.62, 1.0],   // B ring core (brightest)
  [0.54, 0.57, 0.7],   // B ringlet trough
  [0.62, 0.66, 0.08],  // Cassini division
  [0.66, 0.90, 0.72],  // A ring
  [0.92, 0.95, 0.25],  // Encke dip
];

const JUPITER_BANDS: Array<[number, number, number]> = [
  [0.00, 0.15, 0.0],
  [0.15, 0.45, 0.25],  // Halo ring
  [0.45, 0.55, 0.05],  // Main ring inner edge
  [0.55, 0.85, 0.15],  // Main ring
  [0.85, 1.00, 0.05],  // Gossamer rings
];

const URANUS_BANDS: Array<[number, number, number]> = [
  [0.00, 0.1, 0.0],
  [0.10, 0.25, 0.15],  // 1986U2R/ζ ring
  [0.25, 0.35, 0.08],  // Gap
  [0.35, 0.55, 0.25],  // 6/5/4 rings
  [0.55, 0.65, 0.08],  // Gap
  [0.65, 0.85, 0.2],   // α/β/η/γ/δ/λ rings
  [0.85, 1.00, 0.08],  // Outer rings
];

const NEPTUNE_BANDS: Array<[number, number, number]> = [
  [0.00, 0.2, 0.0],
  [0.20, 0.35, 0.1],   // Galle ring
  [0.35, 0.5, 0.04],   // Gap
  [0.50, 0.65, 0.12],  // Le Verrier ring
  [0.65, 0.75, 0.03],  // Gap
  [0.75, 0.9, 0.15],   // Arago ring
  [0.90, 1.00, 0.05],  // Adams ring arcs
];

const HAUMEA_BANDS: Array<[number, number, number]> = [
  [0.00, 0.1, 0.0],
  [0.10, 0.45, 0.25],
  [0.45, 0.55, 0.1],
  [0.55, 0.9, 0.2],
  [0.90, 1.00, 0.05],
];

const RING_PARAMETERS: Record<string, RingParameters> = {
  saturn: {
    innerRadius: 1.24,
    outerRadius: 2.27,
    inclination: 26.7,
    opticalDepth: 0.8,
    color: "#c8b88a",
    segments: 128,
  },
  jupiter: {
    innerRadius: 1.72,
    outerRadius: 1.81,
    inclination: 3.1,
    opticalDepth: 0.05,
    color: "#8b7d6b",
    segments: 64,
  },
  uranus: {
    innerRadius: 1.59,
    outerRadius: 2.00,
    inclination: 97.8,
    opticalDepth: 0.1,
    color: "#7a7a7a",
    segments: 64,
  },
  neptune: {
    innerRadius: 1.72,
    outerRadius: 2.54,
    inclination: 28.3,
    opticalDepth: 0.05,
    color: "#5a5a7a",
    segments: 64,
  },
  haumea: {
    innerRadius: 1.4,
    outerRadius: 1.8,
    inclination: 0,
    opticalDepth: 0.3,
    color: "#a0a0b0",
    segments: 32,
  },
};

const RING_BANDS: Record<string, Array<[number, number, number]>> = {
  saturn: SATURN_BANDS,
  jupiter: JUPITER_BANDS,
  uranus: URANUS_BANDS,
  neptune: NEPTUNE_BANDS,
  haumea: HAUMEA_BANDS,
};

const GENERIC_BANDS: Array<[number, number, number]> = [
  [0.00, 0.06, 0.35],
  [0.06, 0.32, 0.8],
  [0.32, 0.5, 0.62],
  [0.5, 0.78, 0.85],
  [0.78, 1.0, 0.45],
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return { r: 200, g: 184, b: 138 };
  return { r, g, b };
}

/**
 * Fan geometry with radial UVs: uv.x runs inner→outer across the ring,
 * uv.y runs around the ring (0 = +X axis, going CCW). This lets a 1-D
 * canvas texture encode radial banding exactly.
 */
function createRingGeometry(
  params: RingParameters,
  planetRadius: number,
  radialSegments = 4,
): THREE.BufferGeometry {
  const inner = planetRadius * params.innerRadius;
  const outer = planetRadius * params.outerRadius;
  const segments = params.segments;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let s = 0; s <= segments; s++) {
    const theta = (s / segments) * Math.PI * 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    for (let r = 0; r <= radialSegments; r++) {
      const radius = inner + (outer - inner) * (r / radialSegments);
      positions.push(cos * radius, sin * radius, 0);
      uvs.push(r / radialSegments, s / segments);
    }
  }

  for (let s = 0; s < segments; s++) {
    for (let r = 0; r < radialSegments; r++) {
      const a = s * (radialSegments + 1) + r;
      const b = a + radialSegments + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeRingTexture(params: RingParameters, bodyId: string): THREE.CanvasTexture {
  const W = 512;
  const H = 16;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(W, H);
  const data = imageData.data;

  const { r, g, b } = hexToRgb(params.color);
  const bands = RING_BANDS[bodyId] || GENERIC_BANDS;
  const maxOpacity = Math.min(params.opticalDepth * 1.2, 0.85);

  for (let x = 0; x < W; x++) {
    const u = x / (W - 1);

    let alpha = 0;
    for (const [from, to, a] of bands) {
      if (u >= from && u <= to && a > alpha) alpha = a;
    }
    alpha *= maxOpacity;

    // Soft falloff at the inner and outer edges.
    const edge = Math.min(1, u / 0.03, (1 - u) / 0.03);
    alpha *= Math.max(0, Math.min(1, edge));

    // Add subtle radial noise for realism
    const radialNoise = (Math.sin(u * 50) * 0.02 + Math.sin(u * 120) * 0.01) * alpha;
    alpha = Math.max(0, Math.min(1, alpha + radialNoise));

    for (let y = 0; y < H; y++) {
      // Improved illumination model: brighter on the sun-facing side
      const v = y / (H - 1);
      const illumination = 0.75 + 0.25 * Math.cos(v * Math.PI * 2);
      const a = Math.min(1, alpha * illumination);
      const idx = (y * W + x) * 4;
      data[idx] = Math.round(r * (0.9 + 0.1 * v));
      data[idx + 1] = Math.round(g * (0.9 + 0.1 * v));
      data[idx + 2] = Math.round(b * (0.9 + 0.1 * v));
      data[idx + 3] = Math.round(a * 255);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

interface RingSystemProps {
  body: Body;
  planetRadius: number;
}

export default function RingSystem({ body, planetRadius }: RingSystemProps) {
  const ringParams = RING_PARAMETERS[body.id];
  const meshRef = useRef<THREE.Mesh>(null);

  if (!ringParams) return null;

  const geometry = useMemo(
    () => createRingGeometry(ringParams, planetRadius),
    [body.id, planetRadius],
  );

  const texture = useMemo(() => makeRingTexture(ringParams, body.id), [body.id]);

  // Subtle ring rotation for visual life
  useFrame(({ clock }: { clock: { elapsedTime: number } }) => {
    if (meshRef.current) {
      const rotationSpeed = body.id === "saturn" ? 0.0001 : 0.0002;
      meshRef.current.rotation.z = clock.elapsedTime * rotationSpeed;
    }
  });

  // Rendered inside Planet's spin group, which already applies body.tilt,
  // so the ring plane lies flat relative to the tilted equator.
  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      geometry={geometry}
      frustumCulled={false}
      onClick={(e) => e.stopPropagation()}
      onPointerOver={(e) => e.stopPropagation()}
      onPointerOut={(e) => e.stopPropagation()}
    >
      <meshBasicMaterial
        map={texture}
        side={THREE.DoubleSide}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

export { RING_PARAMETERS, type RingParameters };
