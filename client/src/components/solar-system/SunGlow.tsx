import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { makeGlowTexture } from "@/lib/glow-textures";
import { useCinematicMode } from "@/stores/cinematic-mode";
import { useSimulation } from "@/stores/simulation";

export default function SunGlow() {
  const coreRef = useRef<THREE.Sprite>(null);
  const innerCoronaRef = useRef<THREE.Sprite>(null);
  const outerCoronaRef = useRef<THREE.Sprite>(null);
  const raysRef = useRef<THREE.Sprite>(null);
  const cinematic = useCinematicMode((s) => s.enabled);
  const speed = useSimulation((s) => s.speed);

  const coreTex = useMemo(
    () =>
      makeGlowTexture(256, [
        [0, "rgba(255, 240, 200, 1)"],
        [0.05, "rgba(255, 220, 160, 0.95)"],
        [0.15, "rgba(255, 190, 100, 0.8)"],
        [0.3, "rgba(255, 150, 60, 0.5)"],
        [0.5, "rgba(255, 110, 30, 0.2)"],
        [0.7, "rgba(230, 80, 20, 0.08)"],
        [1, "rgba(0, 0, 0, 0)"],
      ]),
    [],
  );

  const innerCoronaTex = useMemo(
    () =>
      makeGlowTexture(512, [
        [0, "rgba(255, 255, 255, 0)"],
        [0.01, "rgba(255, 230, 180, 0.4)"],
        [0.05, "rgba(255, 200, 120, 0.25)"],
        [0.15, "rgba(255, 170, 80, 0.15)"],
        [0.3, "rgba(255, 130, 50, 0.08)"],
        [0.5, "rgba(255, 100, 30, 0.04)"],
        [0.8, "rgba(230, 70, 20, 0.015)"],
        [1, "rgba(0, 0, 0, 0)"],
      ]),
    [],
  );

  const outerCoronaTex = useMemo(
    () =>
      makeGlowTexture(1024, [
        [0, "rgba(255, 255, 255, 0)"],
        [0.05, "rgba(255, 220, 160, 0.08)"],
        [0.15, "rgba(255, 180, 100, 0.05)"],
        [0.3, "rgba(255, 140, 60, 0.03)"],
        [0.5, "rgba(255, 110, 40, 0.015)"],
        [0.75, "rgba(230, 80, 25, 0.005)"],
        [1, "rgba(0, 0, 0, 0)"],
      ]),
    [],
  );

  const raysTex = useMemo(
    () =>
      makeGlowTexture(512, [
        [0, "rgba(255, 240, 200, 0.0)"],
        [0.02, "rgba(255, 220, 150, 0.3)"],
        [0.08, "rgba(255, 190, 100, 0.15)"],
        [0.2, "rgba(255, 160, 70, 0.06)"],
        [0.5, "rgba(255, 130, 50, 0.015)"],
        [1, "rgba(0, 0, 0, 0)"],
      ]),
    [],
  );

  useFrame(({ clock, invalidate }) => {
    const t = clock.elapsedTime;
    
    if (coreRef.current) {
      const pulse = 1 + 0.03 * Math.sin(t * 1.3) + 0.015 * Math.sin(t * 2.7);
      coreRef.current.scale.setScalar(25 * pulse);
      coreRef.current.material.opacity = 0.9 + 0.05 * Math.sin(t * 1.7);
    }
    
    if (innerCoronaRef.current) {
      const pulse = 1 + 0.05 * Math.sin(t * 0.9) + 0.02 * Math.sin(t * 1.9);
      innerCoronaRef.current.scale.setScalar(70 * pulse);
      innerCoronaRef.current.material.opacity = 0.35 + 0.08 * Math.sin(t * 0.7);
    }
    
    if (outerCoronaRef.current) {
      const pulse = 1 + 0.08 * Math.sin(t * 0.6) + 0.03 * Math.sin(t * 1.4);
      outerCoronaRef.current.scale.setScalar(140 * pulse);
      outerCoronaRef.current.material.opacity = 0.18 + 0.04 * Math.sin(t * 0.5);
    }
    
    // God rays — slow rotation for cinematic effect
    if (raysRef.current) {
      const wobble = 0.12 * Math.sin(t * 0.12);
      raysRef.current.rotation.z = -0.28 + wobble;
      raysRef.current.material.opacity = 0.18 + 0.05 * Math.sin(t * 0.8);
    }
    
    if (speed > 0 || cinematic) {
      invalidate();
    }
  });

  return (
    <>
      <sprite ref={outerCoronaRef} scale={[140, 140, 1]} position={[0, 0, 0]}>
        <spriteMaterial
          map={outerCoronaTex}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          transparent
          opacity={0.18}
        />
      </sprite>
      <sprite ref={innerCoronaRef} scale={[70, 70, 1]} position={[0, 0, 0]}>
        <spriteMaterial
          map={innerCoronaTex}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          transparent
          opacity={0.35}
        />
      </sprite>
      <sprite ref={coreRef} scale={[25, 25, 1]} position={[0, 0, 0]}>
        <spriteMaterial
          map={coreTex}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          transparent
          opacity={0.9}
        />
      </sprite>
      {/* Subtle vertical light shafts, billboarded — tour-only */}
      {cinematic && (
        <sprite ref={raysRef} scale={[22, 104, 1]} position={[0, 0, 0]}>
          <spriteMaterial
            map={raysTex}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            transparent
            opacity={0.18}
          />
        </sprite>
      )}
    </>
  );
}
