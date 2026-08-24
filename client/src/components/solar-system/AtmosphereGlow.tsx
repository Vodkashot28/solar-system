import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { hexToRgba, makeGlowTexture } from "@/lib/glow-textures";
import { useCinematicMode } from "@/stores/cinematic-mode";
import { useSimulation } from "@/stores/simulation";

const ATMOSPHERE_COLORS: Record<string, string> = {
  earth: "#4fc3f7",
  venus: "#ffcc80",
  mars: "#ef9a9a",
  jupiter: "#d2a679",
  saturn: "#e8d8a0",
  neptune: "#5b9bd5",
};

const ATMOSPHERE_SCALE: Record<string, number> = {
  earth: 1.15,
  venus: 1.08,
  mars: 1.12,
  jupiter: 1.03,
  saturn: 1.04,
  neptune: 1.05,
};

type Props = {
  radius: number;
  bodyId: string;
};

export default function AtmosphereGlow({ radius, bodyId }: Props) {
  const innerRef = useRef<THREE.Sprite>(null);
  const outerRef = useRef<THREE.Sprite>(null);
  const cinematic = useCinematicMode((s) => s.enabled);
  const speed = useSimulation((s) => s.speed);
  const color = ATMOSPHERE_COLORS[bodyId] ?? "#ffffff";
  const scale = ATMOSPHERE_SCALE[bodyId] ?? 1.1;

  const innerTex = useMemo(
    () =>
      makeGlowTexture(128, [
        [0, "rgba(0,0,0,0)"],
        [0.05, hexToRgba(color, 0.5)],
        [0.2, hexToRgba(color, 0.25)],
        [0.5, hexToRgba(color, 0.08)],
        [1, "rgba(0,0,0,0)"],
      ]),
    [color],
  );

  const outerTex = useMemo(
    () =>
      makeGlowTexture(256, [
        [0, "rgba(0,0,0,0)"],
        [0.1, hexToRgba(color, 0.15)],
        [0.4, hexToRgba(color, 0.06)],
        [0.7, hexToRgba(color, 0.015)],
        [1, "rgba(0,0,0,0)"],
      ]),
    [color],
  );

  useFrame(({ clock, invalidate }) => {
    const t = clock.elapsedTime;
    const pulse = 1 + 0.015 * Math.sin(t * 0.7 + bodyId.charCodeAt(0));
    const breathe = 1 + 0.008 * Math.sin(t * 0.3 + bodyId.charCodeAt(0) * 2);

    if (innerRef.current) {
      innerRef.current.scale.setScalar(radius * scale * pulse * breathe);
      innerRef.current.material.opacity = 0.4 + 0.05 * Math.sin(t * 1.1 + bodyId.charCodeAt(0));
    }
    if (outerRef.current) {
      outerRef.current.scale.setScalar(radius * scale * 1.8 * pulse);
      outerRef.current.material.opacity = 0.15 + 0.03 * Math.sin(t * 0.5 + bodyId.charCodeAt(0) * 3);
    }
    if (speed > 0 || cinematic) {
      invalidate();
    }
  });

  return (
    <>
      <sprite
        ref={innerRef}
        scale={[radius * scale, radius * scale, 1]}
      >
        <spriteMaterial
          map={innerTex}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          transparent
          opacity={0.4}
        />
      </sprite>
      <sprite
        ref={outerRef}
        scale={[radius * scale * 1.8, radius * scale * 1.8, 1]}
      >
        <spriteMaterial
          map={outerTex}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          transparent
          opacity={0.15}
        />
      </sprite>
    </>
  );
}
