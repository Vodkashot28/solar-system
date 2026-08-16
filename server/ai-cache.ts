/**
 * AI classification cache management.
 * Handles three-tier caching: PostgreSQL → file cache → static fallback.
 */

import fs from "fs";
import path from "path";
import { db } from "./db";
import { aiCache } from "../shared/schema";
import { logger } from "./logger";

const FILE_CACHE_PATH = path.resolve(process.cwd(), "spaceAI/data/ai_cache.json");
const AI_CACHE_TTL_MS = 60_000;

// ── Static fallback for known spacecraft ──────────────────────────────────────
const STATIC_CLASSIFICATIONS: Record<string, unknown> = {
  "apollo-lm": {
    classification: "Spacecraft",
    confidence: 0.92,
    alternatives: [{ type: "Lander", score: 0.08 }],
    features: [{ name: "type", value: 1, importance: 1.0 }],
    similarObjects: [{ bodyId: "huygens", similarity: 0.65 }],
  },
  "new-horizons": {
    classification: "Spacecraft",
    confidence: 0.95,
    alternatives: [{ type: "Flyby Spacecraft", score: 0.05 }],
    features: [{ name: "type", value: 1, importance: 1.0 }],
    similarObjects: [{ bodyId: "voyager", similarity: 0.82 }],
  },
  "juno-spacecraft": {
    classification: "Spacecraft",
    confidence: 0.93,
    alternatives: [{ type: "Orbiter", score: 0.07 }],
    features: [{ name: "type", value: 1, importance: 1.0 }],
    similarObjects: [{ bodyId: "cassini", similarity: 0.78 }],
  },
  "voyager": {
    classification: "Spacecraft",
    confidence: 0.97,
    alternatives: [{ type: "Interstellar Probe", score: 0.03 }],
    features: [{ name: "type", value: 1, importance: 1.0 }],
    similarObjects: [{ bodyId: "voyager-2", similarity: 0.95 }],
  },
  "voyager-2": {
    classification: "Spacecraft",
    confidence: 0.97,
    alternatives: [{ type: "Interstellar Probe", score: 0.03 }],
    features: [{ name: "type", value: 1, importance: 1.0 }],
    similarObjects: [{ bodyId: "voyager", similarity: 0.95 }],
  },
  "cassini": {
    classification: "Spacecraft",
    confidence: 0.94,
    alternatives: [{ type: "Orbiter", score: 0.06 }],
    features: [{ name: "type", value: 1, importance: 1.0 }],
    similarObjects: [{ bodyId: "juno-spacecraft", similarity: 0.78 }],
  },
  "huygens": {
    classification: "Spacecraft",
    confidence: 0.91,
    alternatives: [{ type: "Atmospheric Probe", score: 0.09 }],
    features: [{ name: "type", value: 1, importance: 1.0 }],
    similarObjects: [{ bodyId: "apollo-lm", similarity: 0.65 }],
  },
  "perseverance": {
    classification: "Spacecraft",
    confidence: 0.96,
    alternatives: [{ type: "Rover", score: 0.04 }],
    features: [{ name: "type", value: 1, importance: 1.0 }],
    similarObjects: [{ bodyId: "curiosity", similarity: 0.88 }],
  },
  "curiosity": {
    classification: "Spacecraft",
    confidence: 0.96,
    alternatives: [{ type: "Rover", score: 0.04 }],
    features: [{ name: "type", value: 1, importance: 1.0 }],
    similarObjects: [{ bodyId: "perseverance", similarity: 0.88 }],
  },
};

// ── File cache (loaded at startup) ────────────────────────────────────────────
function loadFileCache(): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(FILE_CACHE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      logger.warn({ path: FILE_CACHE_PATH }, 'Unexpected shape in AI cache file');
      return {};
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      logger.error({ err, path: FILE_CACHE_PATH }, 'Failed to load AI cache file');
    }
    return {};
  }
}

const FILE_CACHE = loadFileCache();
export const FILE_CACHE_COUNT = Object.keys(FILE_CACHE).length;
if (FILE_CACHE_COUNT > 0) {
  logger.info({ count: FILE_CACHE_COUNT, path: FILE_CACHE_PATH }, 'Loaded AI classifications from file cache');
}

// ── In-memory merged cache ────────────────────────────────────────────────────
let mergedAICache: Record<string, unknown> | null = null;
let mergedAICacheLoadedAt = 0;
let lastDBCount = 0;
let aiCacheRefreshing: Promise<void> | null = null;

function mergeCacheSources(...sources: Array<Record<string, unknown> | null>): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [bodyId, entry] of Object.entries(source)) {
      if (!(bodyId in merged)) merged[bodyId] = entry;
    }
  }
  return merged;
}

function mergeAllCacheSources(dbRows: Record<string, unknown> | null): Record<string, unknown> {
  const merged = mergeCacheSources(dbRows, FILE_CACHE);
  for (const [bodyId, entry] of Object.entries(STATIC_CLASSIFICATIONS)) {
    if (!(bodyId in merged)) {
      merged[bodyId] = { bodyId, ...(entry as Record<string, unknown>) };
    }
  }
  return merged;
}

// Seed from file cache at boot for instant first response
mergedAICache = mergeAllCacheSources(null);
mergedAICacheLoadedAt = 0;

async function refreshMergedAICache(): Promise<Record<string, unknown>> {
  const now = Date.now();
  try {
    const rows = await db.select().from(aiCache);
    lastDBCount = rows.length;
    mergedAICache = mergeAllCacheSources(
      Object.fromEntries(rows.map((r) => [r.bodyId, r])),
    );
  } catch {
    mergedAICache = mergeAllCacheSources(null);
  }
  mergedAICacheLoadedAt = now;
  return mergedAICache;
}

export async function getMergedAICache(force = false): Promise<Record<string, unknown>> {
  // Fresh cache — serve instantly
  if (!force && mergedAICache !== null && Date.now() - mergedAICacheLoadedAt < AI_CACHE_TTL_MS) {
    return mergedAICache;
  }

  // Stale-while-revalidate: serve cached and refresh in background
  if (!force && mergedAICache !== null) {
    if (!aiCacheRefreshing) {
      aiCacheRefreshing = refreshMergedAICache().then(
        () => { aiCacheRefreshing = null; },
        () => { aiCacheRefreshing = null; },
      );
    }
    return mergedAICache;
  }

  return refreshMergedAICache();
}

export function invalidateAICache(): void {
  mergedAICache = null;
}

export function getLastDBCount(): number {
  return lastDBCount;
}
