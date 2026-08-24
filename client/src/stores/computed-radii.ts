import { create } from "zustand";

type ComputedRadiiState = {
  /** Computed radii from GLB bounding boxes, keyed by body ID. */
  radii: Record<string, number>;
  /** Bumped when a body reports its radius — lets OrbitalBody subscribe. */
  version: number;
  setRadius: (bodyId: string, radius: number) => void;
};

/**
 * Shared computed-radii store. Replaces the per-frame setRadiiVersion
 * cascade that was causing SolarSystem (and all 29+ children) to
 * re-render on every GLB load.
 *
 * OrbitalBody subscribes to `version` directly, so spacecraft get
 * updated orbitRadius without re-rendering the entire scene tree.
 */
export const useComputedRadii = create<ComputedRadiiState>((set) => ({
  radii: {},
  version: 0,
  setRadius: (bodyId, radius) =>
    set((s) => {
      if (s.radii[bodyId] === radius) return s;
      return { radii: { ...s.radii, [bodyId]: radius }, version: s.version + 1 };
    }),
}));
