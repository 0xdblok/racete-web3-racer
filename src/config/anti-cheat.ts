/**
 * Multiplayer Anti-Cheat V1 — Shared Constants
 *
 * These thresholds are intentionally conservative to avoid false positives.
 * Warnings/logs occur on first violation; DQ only after repeated severe violations.
 */

// ── Movement validation ──────────────────────────────────────────────────────

/** Maximum plausible speed in meters-per-second for any car. */
export const MAX_PLAUSIBLE_SPEED_MPS = 180; // ~648 km/h — well above legit car stat max (~350 km/h for S-class)

/** Maximum rank-level speed cap by car class (m/s). Conservative upper bound. */
export const CLASS_SPEED_CAPS: Record<string, number> = {
  D: 80,
  C: 100,
  B: 120,
  A: 150,
  S: 180,
  open: 100,
};

/** Maximum allowed position delta between movement updates (meters).
 *  At 15Hz, 120m/s = 8m/tick. We allow 2x margin for network bursts. */
export const MAX_POSITION_DELTA_PER_TICK = 20;

/** Maximum teleport distance before flagging (meters).
 *  Any single-frame position jump beyond this is logged. */
export const MAX_TELEPORT_DISTANCE = 50;

// ── Checkpoint validation ────────────────────────────────────────────────────

/** Maximum distance from checkpoint center to accept a crossing (meters).
 *  Default checkpoint radius is ~28m; we allow generous 50m to avoid false positives. */
export const MAX_CHECKPOINT_DISTANCE = 50;

// ── Finish validation ────────────────────────────────────────────────────────

/** Minimum total race time (ms). */
export const MIN_MULTIPLAYER_TOTAL_TIME_MS = 35_000; // 35s — slightly above solo's 30s

/** Minimum plausible lap time (ms). Track ~2.5km, even at 300km/h that's ~30s. */
export const MIN_MULTIPLAYER_LAP_TIME_MS = 20_000;

/** Maximum race duration before timeout (ms). */
export const MAX_RACE_DURATION_MS = 10 * 60 * 1000; // 10 min

// ── Violation thresholds ─────────────────────────────────────────────────────

/** Number of speed violations before DQ. */
export const SPEED_VIOLATIONS_TO_DQ = 5;

/** Number of teleport violations before DQ. */
export const TELEPORT_VIOLATIONS_TO_DQ = 3;

/** Number of checkpoint proximity violations before DQ. */
export const CHECKPOINT_VIOLATIONS_TO_DQ = 5;

/** Number of out-of-order checkpoint violations before DQ. */
export const OUT_OF_ORDER_VIOLATIONS_TO_DQ = 10;

/** Number of total suspicious events before DQ (catch-all). */
export const MAX_SUSPICIOUS_EVENTS = 15;
