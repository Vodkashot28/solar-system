import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import rateLimit from "express-rate-limit";
import { db } from "./db";
import { celestialBodies, playerCharacters } from "../shared/schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";
import { getMergedAICache, FILE_CACHE_COUNT, getLastDBCount } from "./ai-cache";
import { handleCorrection } from "./corrections";

const SPACEAI_URL = process.env.SPACEAI_URL ?? "http://127.0.0.1:8000";
const PROXY_TIMEOUT_MS = 10_000;

// ── Route-level rate limiters ────────────────────────────────────────────────
const WRITE_LIMIT = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, try again later" },
});
const SSE_LIMIT = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many SSE connections" },
});

// ── Server-Sent Events for Real-Time Sync ─────────────────────────────────
// Telegram /travel movements broadcast to all connected web clients
const sseClients = new Set<Response>();
// Note: In dev with hot-reload (tsx watch), the module-level Set can accumulate
// stale client references across reloads. This is harmless (failed writes are
// caught and removed), but in production or for long-running dev sessions, the
// cleanup on client disconnect (req.on("close")) ensures the set stays lean.

function broadcastPlayerMovement(userId: number, bodyId: number, bodyName: string): void {
  const event = JSON.stringify({
    type: "player_moved",
    userId,
    bodyId,
    bodyName,
    timestamp: Date.now(),
  });

  const data = `data: ${event}\n\n`;
  const clientsToRemove: Response[] = [];
  
  sseClients.forEach((client) => {
    try {
      client.write(data);
    } catch {
      clientsToRemove.push(client);
    }
  });
  
  // Clean up failed clients
  clientsToRemove.forEach((client) => sseClients.delete(client));
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function proxyToFastAI(req: Request, res: Response, endpoint: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${SPACEAI_URL}${endpoint}`, { signal: controller.signal });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      res.status(504).json({ error: "AI service timed out" });
    } else {
      res.status(503).json({ error: "AI service unavailable" });
    }
  } finally {
    clearTimeout(timer);
  }
}

// ── Route registration ─────────────────────────────────────────────────────

export function registerRoutes(app: Express): Server {

  app.get("/api/health", async (req, res) => {
    const startTime = Date.now();
    const checks: Record<string, any> = {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };

    // Database check
    try {
      const dbStart = Date.now();
      await db.select().from(celestialBodies).limit(1);
      checks.database = {
        status: "ok",
        responseTime: Date.now() - dbStart,
      };
    } catch (err) {
      checks.database = {
        status: "error",
        error: err instanceof Error ? err.message : 'Unknown error',
      };
      checks.status = "degraded";
    }

    // AI Cache check
    try {
      const cacheStart = Date.now();
      const merged = await getMergedAICache();
      checks.aiCache = {
        status: "ok",
        cachedBodies: Object.keys(merged).length,
        sources: {
          database: getLastDBCount(),
          fileCache: FILE_CACHE_COUNT,
        },
        responseTime: Date.now() - cacheStart,
      };
    } catch (err) {
      checks.aiCache = {
        status: "error",
        error: err instanceof Error ? err.message : 'Unknown error',
        cachedBodies: FILE_CACHE_COUNT,
      };
      // AI cache is optional, don't degrade overall status
    }

    // ML Service check (optional)
    try {
      const mlStart = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const mlResponse = await fetch(`${SPACEAI_URL}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      checks.mlService = {
        status: mlResponse.ok ? "ok" : "error",
        url: SPACEAI_URL,
        responseTime: Date.now() - mlStart,
      };
    } catch (err) {
      checks.mlService = {
        status: "unavailable",
        url: SPACEAI_URL,
        note: "ML service is optional - precomputed cache available",
      };
      // ML service is optional in production
    }

    // Memory usage
    const mem = process.memoryUsage();
    checks.memory = {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      rss: Math.round(mem.rss / 1024 / 1024),
      unit: "MB",
    };

    checks.responseTime = Date.now() - startTime;

    // Return 503 if critical services are down, 200 otherwise
    const statusCode = checks.status === "ok" ? 200 : 503;
    
    if (req.log) {
      req.log.info({ health: checks }, 'Health check completed');
    }
    
    res.status(statusCode).json(checks);
  });

  // ── Server-Sent Events for Real-Time Player Movement ───────────────────────
  app.get("/api/events", SSE_LIMIT, (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

    // Send initial connection confirmation
    res.write(`data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`);

    // Add client to broadcast set
    sseClients.add(res);

    // Remove client on disconnect
    req.on("close", () => {
      sseClients.delete(res);
    });

    if (req.log) {
      req.log.info({ clientCount: sseClients.size }, 'SSE client connected');
    }
  });

  app.get("/api/ai/precomputed", async (req, res) => {
    // Browsers skip revalidation for a minute — no 304 round-trip per boot.
    res.setHeader("Cache-Control", "public, max-age=60");
    const merged = await getMergedAICache();
    if (Object.keys(merged).length > 0) {
      res.json(merged);
    } else {
      // No cache anywhere — proxy directly to FastAPI
      await proxyToFastAI(req, res, "/precomputed");
    }
  });

  app.get("/api/ai/classify/:bodyId", async (req, res) => {
    const bodyId = req.params.bodyId;
    res.setHeader("Cache-Control", "public, max-age=60");
    const merged = await getMergedAICache();
    const entry = merged[bodyId] as Record<string, unknown> | undefined;
    if (entry) {
      res.json((entry as { bodyId?: string }).bodyId ? entry : { bodyId, ...entry });
      return;
    }

    const params = req.query.toString();
    await proxyToFastAI(req, res, `/classify/${bodyId}?${params}`);
  });

  // POST /api/ai/correct  (used by AIClassificationPanel)
  app.post("/api/ai/correct", WRITE_LIMIT, async (req, res) => {
    const bodyId = (req.body?.body_id as string) ?? "";
    if (!bodyId) {
      res.status(400).json({ error: "body_id required" });
      return;
    }
    await handleCorrection(bodyId, req.body ?? {}, res);
  });

  // ── Celestial bodies CRUD ────────────────────────────────────────────────

  app.get("/api/bodies", async (_req, res) => {
    try {
      res.json(await db.select().from(celestialBodies).orderBy(celestialBodies.name));
    } catch (err) {
      console.error("[db] failed to fetch celestial bodies:", err);
      res.status(500).json({ error: "Failed to fetch celestial bodies" });
    }
  });

  app.get("/api/bodies/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    try {
      const rows = await db.select().from(celestialBodies)
        .where(eq(celestialBodies.id, id)).limit(1);
      rows.length > 0
        ? res.json(rows[0])
        : res.status(404).json({ error: "Body not found" });
    } catch (err) {
      console.error("[db] failed to fetch celestial body:", err);
      res.status(500).json({ error: "Failed to fetch celestial body" });
    }
  });

  app.post("/api/bodies", WRITE_LIMIT, async (req, res) => {
    const { name, type } = req.body ?? {};
    if (!name || !type) {
      res.status(400).json({ error: "name and type required" });
      return;
    }
    const CREATE_ALLOWED = new Set([
      "name","type","mass","radius","density","gravity","temperature",
      "orbitalPeriod","semiMajorAxis","eccentricity","inclination",
      "rotationPeriod","axialTilt","aiClassification","aiConfidenceScore",
      "visualRadius","orbit","orbitSpeed","spinSpeed","tilt","phase",
      "color","fact","parentBody","hasRings",
    ]);
    const safe = Object.fromEntries(
      Object.entries(req.body ?? {}).filter(([k]) => CREATE_ALLOWED.has(k))
    ) as { name: string; type: string; [k: string]: unknown };
    try {
      const rows = await db.insert(celestialBodies).values(safe).returning();
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error("[db] failed to create celestial body:", err);
      res.status(500).json({ error: "Failed to create celestial body" });
    }
  });

  app.patch("/api/bodies/:id", WRITE_LIMIT, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const ALLOWED = new Set([
      "name","type","mass","radius","density","gravity","temperature",
      "orbitalPeriod","semiMajorAxis","eccentricity","inclination",
      "rotationPeriod","axialTilt","aiClassification","aiConfidenceScore",
      "visualRadius","orbit","orbitSpeed","spinSpeed","tilt","phase",
      "color","fact","parentBody","hasRings",
    ]);
    const updates = Object.fromEntries(
      Object.entries(req.body ?? {}).filter(([k]) => ALLOWED.has(k))
    );
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }
    try {
      const rows = await db.update(celestialBodies).set(updates)
        .where(eq(celestialBodies.id, id)).returning();
      rows.length > 0
        ? res.json(rows[0])
        : res.status(404).json({ error: "Body not found" });
    } catch (err) {
      console.error("[db] failed to update celestial body:", err);
      res.status(500).json({ error: "Failed to update celestial body" });
    }
  });

  app.delete("/api/bodies/:id", WRITE_LIMIT, async (req, res) => {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    try {
      const rows = await db.delete(celestialBodies)
        .where(eq(celestialBodies.id, id)).returning();
      rows.length > 0
        ? res.json({ status: "ok", deleted: rows[0] })
        : res.status(404).json({ error: "Body not found" });
    } catch (err) {
      console.error("[db] failed to delete celestial body:", err);
      res.status(500).json({ error: "Failed to delete celestial body" });
    }
  });

  // ── Player location sync (Telegram ↔ web) ────────────────────────────────
  // Telegram user ids are 64-bit ints — reject anything non-numeric up front.
  const parseTelegramUserId = (raw: string): number | null => {
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
  };

  app.get("/api/player/:telegramUserId", async (req, res) => {
    const tgId = parseTelegramUserId(req.params.telegramUserId);
    if (tgId === null) {
      res.status(400).json({ error: "Invalid telegram user id" });
      return;
    }
    try {
      const rows = await db.select().from(playerCharacters)
        .where(eq(playerCharacters.telegramUserId, tgId)).limit(1);
      if (rows.length > 0) {
        res.json(rows[0]);
      } else {
        res.status(404).json({ error: "Player not found" });
      }
    } catch (err) {
      logger.error({ err, telegramUserId: tgId }, 'DB unavailable — failed to fetch player');
      res.status(503).json({ error: "Database unavailable" });
    }
  });

  app.patch("/api/player/:telegramUserId/location", WRITE_LIMIT, async (req, res) => {
    const tgId = parseTelegramUserId(req.params.telegramUserId);
    if (tgId === null) {
      res.status(400).json({ error: "Invalid telegram user id" });
      return;
    }
    const { bodyId, bodyName, name } = (req.body ?? {}) as Record<string, unknown>;
    if (bodyId === undefined && bodyName === undefined) {
      res.status(400).json({ error: "bodyId or bodyName required" });
      return;
    }
    try {
      // Resolve the destination body (must exist in the catalog).
      let destId: number;
      let destName: string;
      if (bodyId !== undefined) {
        const id = Number(bodyId);
        if (!Number.isInteger(id) || id <= 0) {
          res.status(400).json({ error: "Invalid bodyId" });
          return;
        }
        const body = await db.select({ name: celestialBodies.name })
          .from(celestialBodies).where(eq(celestialBodies.id, id)).limit(1);
        if (body.length === 0) {
          res.status(404).json({ error: "Body not found" });
          return;
        }
        destId = id;
        destName = body[0].name;
      } else {
        const q = String(bodyName).trim().toLowerCase();
        if (!q) {
          res.status(400).json({ error: "bodyName required" });
          return;
        }
        const body = await db.select()
          .from(celestialBodies)
          .where(sql`lower(${celestialBodies.name}) = ${q}`).limit(1);
        if (body.length === 0) {
          res.status(404).json({ error: "Body not found" });
          return;
        }
        destId = body[0].id;
        destName = body[0].name;
      }

      // Upsert the player at the destination (single atomic statement).
      const playerName =
        typeof name === "string" && name.trim() ? String(name).trim() : "Traveler";
      const rows = await db.insert(playerCharacters)
        .values({ telegramUserId: tgId, name: playerName, currentBodyId: destId })
        .onConflictDoUpdate({
          target: playerCharacters.telegramUserId,
          set: { currentBodyId: destId },
        })
        .returning();
      
      // Broadcast movement to all connected web clients (SSE)
      broadcastPlayerMovement(tgId, destId, destName);
      
      res.json({ ...rows[0], bodyName: destName });
    } catch (err) {
      logger.error({ err, telegramUserId: tgId }, 'DB unavailable — failed to update player location');
      res.status(503).json({ error: "Database unavailable" });
    }
  });

  return createServer(app);
}
