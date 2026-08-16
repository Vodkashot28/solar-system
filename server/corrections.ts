/**
 * AI classification correction handling.
 * Saves corrections to PostgreSQL and forwards to FastAPI for retraining.
 */

import fs from "fs";
import path from "path";
import type { Response } from "express";
import { db } from "./db";
import { corrections } from "../shared/schema";
import { logger } from "./logger";
import { invalidateAICache } from "./ai-cache";

const SPACEAI_URL = process.env.SPACEAI_URL ?? "http://127.0.0.1:8000";
const PROXY_TIMEOUT_MS = 10_000;
const PENDING_CORRECTIONS_PATH = path.resolve(
  process.cwd(),
  "spaceAI/data/pending_corrections.json",
);

// ── Taxonomy auto-sync ────────────────────────────────────────────────────────
const TAXONOMY_PATH = path.resolve(process.cwd(), "spaceAI/data/solar_system.json");

const VALID_CATEGORIES = new Set([
  "Star", "Planet", "DwarfPlanet", "Asteroid", "Comet", "Interstellar", "Moon", "Spacecraft",
]);

const ID_TO_TAXONOMY_NAME: Record<string, string> = {
  "io": "Io",
  "oumuamua": "1I/'Oumuamua",
  "borisov": "2I/Borisov",
  "churyumov": "67P/Churyumov-Gerasimenko",
  "tempel1": "9P/Tempel 1",
  "wild2": "81P/Wild 2",
  "hubble": "Hubble",
  "jwst": "JWST",
  "apollo-lm": "Apollo Lunar Module",
  "voyager": "Voyager",
  "voyager-2": "Voyager2",
  "juno": "Juno",
  "juno-spacecraft": "Juno",
};

const ID_TO_EXPECTED_CATEGORY: Record<string, string> = {
  "juno": "Asteroid",
  "juno-spacecraft": "Spacecraft",
};

function syncTaxonomyToJson(bodyId: string, correctedType: string): void {
  if (!VALID_CATEGORIES.has(correctedType)) {
    logger.warn({ bodyId, correctedType }, 'Invalid category for taxonomy sync');
    return;
  }
  try {
    const name = ID_TO_TAXONOMY_NAME[bodyId] ??
      bodyId.charAt(0).toUpperCase() + bodyId.slice(1);

    if (!fs.existsSync(TAXONOMY_PATH)) {
      logger.warn({ path: TAXONOMY_PATH }, 'Taxonomy file not found');
      return;
    }

    const raw = fs.readFileSync(TAXONOMY_PATH, "utf-8");
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries)) {
      logger.warn('Taxonomy file is not an array');
      return;
    }

    const expectedCategory = ID_TO_EXPECTED_CATEGORY[bodyId];
    let updated = false;

    for (const entry of entries) {
      if (entry.name !== name) continue;
      if (expectedCategory && entry.category !== expectedCategory) continue;
      entry.category = correctedType;
      updated = true;
      break;
    }

    if (!updated) {
      logger.warn({ bodyId, name }, 'No taxonomy entry found for body');
      return;
    }

    fs.writeFileSync(TAXONOMY_PATH, JSON.stringify(entries, null, 2) + "\n", "utf-8");
    logger.info({ bodyId, correctedType }, 'Taxonomy synced');
  } catch (err) {
    logger.error({ err, bodyId }, 'Taxonomy sync failed');
  }
}

function queuePendingCorrection(bodyId: string, body: Record<string, unknown>): void {
  try {
    let pending: Array<Record<string, unknown>> = [];
    if (fs.existsSync(PENDING_CORRECTIONS_PATH)) {
      const raw = fs.readFileSync(PENDING_CORRECTIONS_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) pending = parsed;
    }
    pending.push({ body_id: bodyId, ...body, queued_at: new Date().toISOString() });
    fs.writeFileSync(
      PENDING_CORRECTIONS_PATH,
      JSON.stringify(pending, null, 2) + "\n",
      "utf-8",
    );
    logger.info({ bodyId, path: PENDING_CORRECTIONS_PATH }, 'Correction queued (FastAPI offline)');
  } catch (err) {
    logger.error({ err, bodyId }, 'Failed to queue correction');
  }
}

export async function handleCorrection(
  bodyId: string,
  body: Record<string, unknown>,
  res: Response,
): Promise<void> {
  const { predicted_type, corrected_type, features, uncertainty } = body;

  if (!corrected_type) {
    res.status(400).json({ error: "corrected_type required" });
    return;
  }

  try {
    await db.insert(corrections).values({
      bodyId,
      predictedType: (predicted_type as string) ?? "",
      correctedType: corrected_type as string,
      features: (features as object) ?? {},
      uncertainty: (uncertainty as number) ?? null,
      source: "user",
    });
    invalidateAICache();
  } catch (err) {
    logger.error({ err, bodyId }, 'Failed to save correction to database');
    res.status(500).json({ error: "Failed to save correction" });
    return;
  }

  syncTaxonomyToJson(bodyId, corrected_type as string);

  // Forward to FastAPI
  try {
    const upstream = await fetch(`${SPACEAI_URL}/classify/${bodyId}/correct`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });
    if (!upstream.ok) queuePendingCorrection(bodyId, body);
  } catch {
    queuePendingCorrection(bodyId, body);
  }

  res.json({ status: "ok" });
}
