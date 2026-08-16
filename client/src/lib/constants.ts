/**
 * Application-wide constants to avoid magic numbers scattered across files.
 */

// ── Camera settings ────────────────────────────────────────────────────────────
export const CAMERA_NEAR = 0.01;
export const CAMERA_FAR_COMPRESSED = 400;
export const CAMERA_FAR_EXPANDED = 1500;
export const CAMERA_FOV = 55;
export const CAMERA_DEFAULT_POSITION = [0, 55, 130] as const;

// ── Scale modes ────────────────────────────────────────────────────────────────
export const SCALE_VISUAL = 1;
export const SCALE_HYBRID = 0.6;
export const SCALE_REAL_SIZE = 0.35;
export const SCALE_REAL_DISTANCE = 0.25;

// ── Cinematic tour timing ──────────────────────────────────────────────────────
export const OVERVIEW_DURATION_SEC = 10;
export const SECONDS_PER_BODY = 5;

// ── Performance & rendering ────────────────────────────────────────────────────
export const DPR_RANGE: [number, number] = [1, 1.75];
export const TONE_MAPPING_EXPOSURE = 1.1;

// ── Planet rendering ───────────────────────────────────────────────────────────
export const RADIUS_SCALE_MIN = 0.3;
export const RADIUS_SCALE_WEIGHT = 0.7;

// ── LOD thresholds ─────────────────────────────────────────────────────────────
export const LOD_HIGH_DETAIL_DISTANCE = 80;
export const LOD_CULL_DISTANCE = 300;
export const LOD_HIGH_DETAIL_DISTANCE_MOBILE = 50;
export const LOD_CULL_DISTANCE_MOBILE = 200;

// ── Focus camera distances ─────────────────────────────────────────────────────
export const FOCUS_DISTANCE_MULTIPLIER = 7;
export const FOCUS_HEIGHT_MULTIPLIER = 0.6;
export const FOCUS_DISTANCE_OFFSET = 7;
export const FOCUS_HEIGHT_OFFSET = 2.5;
export const FOCUS_SETTLED_THRESHOLD = 0.5;
export const FOCUS_SETTLED_FRAMES = 30;

// ── Orbit ring rendering ───────────────────────────────────────────────────────
export const ORBIT_SEGMENTS = 128;
export const ORBIT_LINE_WIDTH = 1.5;
export const ORBIT_LINE_WIDTH_DIMMED = 1;
export const ORBIT_ACTIVE_LINE_WIDTH = 3;
export const ORBIT_OPACITY = 0.22;
export const ORBIT_OPACITY_DIMMED = 0.07;
export const ORBIT_ACTIVE_OPACITY = 0.55;
export const ORBIT_ACTIVE_OPACITY_DIMMED = 0.15;

// ── Stars ──────────────────────────────────────────────────────────────────────
export const STAR_COUNT = 6000;
export const STAR_RADIUS = 200;
export const STAR_DEPTH = 80;
export const STAR_SIZE_FACTOR = 4;

// ── UI constants ───────────────────────────────────────────────────────────────
export const MIN_TOUCH_TARGET = 44; // px - WCAG minimum
export const SAFE_AREA_INSET = "max(env(safe-area-inset-top), 0.5rem)";

// ── Animation & easing ─────────────────────────────────────────────────────────
export const CAMERA_DAMP_FACTOR = 0.85;
export const LOOK_DAMP_FACTOR = 0.85;
export const TOUR_CAMERA_DAMP = 1.3;
export const TOUR_LOOK_DAMP = 1.1;
export const ORBIT_DASH_SPEED = 0.4;

// ── API & caching ──────────────────────────────────────────────────────────────
export const AI_CACHE_TTL_MS = 60_000;
export const PROXY_TIMEOUT_MS = 10_000;
export const GLB_CACHE_DAYS = 30;
export const DRACO_CACHE_DAYS = 365;

// ── Body types (for type guards) ───────────────────────────────────────────────
export const ATMOSPHERE_BODIES = new Set(["earth", "venus", "mars", "jupiter", "saturn", "neptune"]);
export const ASTRONOMY_EPHEMERIS_BODIES = new Set([
  "sun", "mercury", "venus", "earth", "mars",
  "jupiter", "saturn", "uranus", "neptune"
]);
