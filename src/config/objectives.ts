/**
 * Hard Objectives / Missions V1 — Race Cash only, no tokens, no on-chain.
 *
 * Objectives are evaluated server-side during race reward processing.
 * Manual claim model: race completion marks as "completed", user clicks Claim.
 */

import type { TrackTargetConfig, PreviousRecords } from "@/config/rewards";

// ── Objective type taxonomy ────────────────────────────────────────────────

export type ObjectiveType =
  | "finish_race"           // Just complete a race (any or specific track)
  | "under_target_time"     // Total time under target for track+class
  | "under_elite_time"      // Total time under a hard elite cutoff
  | "first_lap_under_target"
  | "best_lap_under_target"
  | "no_reset"              // resetCount === 0
  | "no_wrong_way"          // wrongWayTriggered === false
  | "clean_race"            // both no wrong way AND no reset
  | "beat_total_pb_by_ms"   // Improve best_total_time_ms by at least X ms
  | "beat_first_lap_pb_by_ms"
  | "beat_best_lap_pb_by_ms"
  | "races_finished_count"  // total races finished reaches target
  | "total_rc_earned"       // total race cash earned from races reaches target
  | "class_under_target"    // Specific car class under target time
  | "car_under_target";     // Specific car ID under target time

export type ObjectiveDifficulty = "easy" | "medium" | "hard" | "elite";

// ── Objective config shape ─────────────────────────────────────────────────

export interface ObjectiveConfig {
  id: string;
  title: string;
  description: string;
  type: ObjectiveType;
  difficulty: ObjectiveDifficulty;
  /** If set, only evaluates for this track. */
  trackId?: string;
  /** If set, only evaluates for this car class. */
  carClass?: string;
  /** If set, only evaluates for this specific car. */
  carId?: string;
  /** Numeric requirement (time in ms, count, RC amount). */
  requirement: number;
  /** Race Cash reward for completing this objective. */
  rewardAmount: number;
  /** If true, completed objective resets to in_progress after claim. */
  repeatable: boolean;
  /** Sort order for UI (lower = first). */
  sortOrder: number;
}

// ── V1 Objectives ──────────────────────────────────────────────────────────

export const OBJECTIVES_V1: ObjectiveConfig[] = [
  // === EASY ===
  {
    id: "finish_city_loop_once",
    title: "First Finish",
    description: "Finish City Loop once",
    type: "races_finished_count",
    difficulty: "easy",
    trackId: "city-loop",
    requirement: 1,
    rewardAmount: 50,
    repeatable: false,
    sortOrder: 1,
  },
  {
    id: "finish_no_reset",
    title: "Zero Resets",
    description: "Finish a race without resetting",
    type: "no_reset",
    difficulty: "easy",
    requirement: 1,
    rewardAmount: 75,
    repeatable: false,
    sortOrder: 2,
  },
  {
    id: "finish_no_wrong_way",
    title: "Right Direction",
    description: "Finish without going the wrong way",
    type: "no_wrong_way",
    difficulty: "easy",
    requirement: 1,
    rewardAmount: 75,
    repeatable: false,
    sortOrder: 3,
  },

  // === MEDIUM ===
  {
    id: "city_loop_under_target",
    title: "On Pace",
    description: "Finish City Loop under target time",
    type: "under_target_time",
    difficulty: "medium",
    trackId: "city-loop",
    requirement: 1,
    rewardAmount: 100,
    repeatable: false,
    sortOrder: 4,
  },
  {
    id: "first_lap_under_target",
    title: "Quick Start",
    description: "First lap under target time",
    type: "first_lap_under_target",
    difficulty: "medium",
    requirement: 1,
    rewardAmount: 100,
    repeatable: false,
    sortOrder: 5,
  },
  {
    id: "best_lap_under_target",
    title: "Hot Lap",
    description: "Best lap under target time",
    type: "best_lap_under_target",
    difficulty: "medium",
    requirement: 1,
    rewardAmount: 100,
    repeatable: false,
    sortOrder: 6,
  },
  {
    id: "finish_3_races",
    title: "Beginner Driver",
    description: "Finish 3 races",
    type: "races_finished_count",
    difficulty: "medium",
    requirement: 3,
    rewardAmount: 120,
    repeatable: false,
    sortOrder: 7,
  },

  // === HARD ===
  {
    id: "beat_total_pb_by_3s",
    title: "Personal Best Buster",
    description: "Beat your total time PB by 3 seconds",
    type: "beat_total_pb_by_ms",
    difficulty: "hard",
    requirement: 3_000,
    rewardAmount: 200,
    repeatable: true,
    sortOrder: 8,
  },
  {
    id: "beat_first_lap_pb_by_1s",
    title: "Rocket Start",
    description: "Beat your first lap PB by 1 second",
    type: "beat_first_lap_pb_by_ms",
    difficulty: "hard",
    requirement: 1_000,
    rewardAmount: 150,
    repeatable: true,
    sortOrder: 9,
  },
  {
    id: "beat_best_lap_pb_by_1s",
    title: "Lap Record Breaker",
    description: "Beat your best lap PB by 1 second",
    type: "beat_best_lap_pb_by_ms",
    difficulty: "hard",
    requirement: 1_000,
    rewardAmount: 150,
    repeatable: true,
    sortOrder: 10,
  },
  {
    id: "finish_10_races",
    title: "Seasoned Driver",
    description: "Finish 10 races",
    type: "races_finished_count",
    difficulty: "hard",
    requirement: 10,
    rewardAmount: 300,
    repeatable: false,
    sortOrder: 11,
  },

  // === ELITE ===
  {
    id: "city_loop_elite_time",
    title: "City Loop Elite",
    description: "Finish City Loop under elite time for your class",
    type: "under_elite_time",
    difficulty: "elite",
    trackId: "city-loop",
    requirement: 1,
    rewardAmount: 500,
    repeatable: false,
    sortOrder: 12,
  },
  {
    id: "class_d_under_hard_target",
    title: "Underdog Champion",
    description: "Finish with a Class D car under hard target",
    type: "class_under_target",
    difficulty: "elite",
    carClass: "D",
    requirement: 1,
    rewardAmount: 400,
    repeatable: false,
    sortOrder: 13,
  },
  {
    id: "earn_1000_rc",
    title: "Race Cash Tycoon",
    description: "Earn 1,000 Race Cash from races",
    type: "total_rc_earned",
    difficulty: "elite",
    requirement: 1_000,
    rewardAmount: 250,
    repeatable: false,
    sortOrder: 14,
  },
];

// ── Elite time cutoffs per class (stricter than target times) ──────────────

export const ELITE_TIME_CUTOFFS: Record<string, Record<string, number>> = {
  "city-loop": {
    D:  170_000,
    C:  155_000,
    "C+": 150_000,
    B:  140_000,
    "B+": 135_000,
    A:  125_000,
    S:  115_000,
  },
};

/** Hard target for Class D objective (stricter than the D target of 200s). */
export const CLASS_D_HARD_TARGET_MS = 180_000;

// ── Objective progress row shape (from DB) ─────────────────────────────────

export type ObjectiveProgressRow = {
  id: string;
  wallet_address: string;
  objective_id: string;
  status: "locked" | "in_progress" | "completed" | "claimed";
  progress: number;
  target: number;
  reward_amount: number;
  completed_at: string | null;
  claimed_at: string | null;
  created_at: string;
  updated_at: string;
};

// ── API response shape ─────────────────────────────────────────────────────

export type ObjectiveState = {
  objective: ObjectiveConfig;
  status: ObjectiveProgressRow["status"];
  progress: number;
  target: number;
  rewardAmount: number;
  completedAt: string | null;
  claimedAt: string | null;
  difficulty: ObjectiveDifficulty;
  claimable: boolean;
};

// ── Helpers ────────────────────────────────────────────────────────────────

export function getObjectiveById(id: string): ObjectiveConfig | undefined {
  return OBJECTIVES_V1.find((o) => o.id === id);
}

export function getObjectivesByDifficulty(
  difficulty: ObjectiveDifficulty,
): ObjectiveConfig[] {
  return OBJECTIVES_V1.filter((o) => o.difficulty === difficulty).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

export function getEliteTimeCutoff(
  carClass: string,
  trackId: string,
): number | undefined {
  return ELITE_TIME_CUTOFFS[trackId]?.[carClass];
}

// ── Objective evaluation engine ────────────────────────────────────────────

export type EvaluationContext = {
  walletAddress: string;
  trackId: string;
  carClass: string;
  carId: string;
  totalTimeMs: number;
  bestLapMs: number;
  firstLapMs: number;
  wrongWayTriggered: boolean;
  resetCount: number;
  targetConfig: TrackTargetConfig;
  /** Previous records BEFORE this race updates them. */
  previousRecords: PreviousRecords | null;
  /** The reward breakdown calculated for this race. */
  rewardBreakdown: {
    total: number;
    targetTimeBonus: number;
  };
};

export type ObjectiveEvaluation = {
  objectiveId: string;
  objective: ObjectiveConfig;
  completed: boolean;
  progress: number;
  target: number;
  /** The progress value after this race. */
  newProgress: number;
};

/**
 * Evaluate all defined objectives against a race result.
 * Returns only objectives that were affected by this race
 * (progress changed, completed, or already in_progress and relevant).
 */
export function evaluateObjectives(
  ctx: EvaluationContext,
): ObjectiveEvaluation[] {
  const results: ObjectiveEvaluation[] = [];

  for (const obj of OBJECTIVES_V1) {
    // Filter by track
    if (obj.trackId && obj.trackId !== ctx.trackId) continue;
    // Filter by car class
    if (obj.carClass && obj.carClass !== ctx.carClass) continue;
    // Filter by car ID
    if (obj.carId && obj.carId !== ctx.carId) continue;

    const evaluation = evaluateSingle(obj, ctx);
    if (evaluation) results.push(evaluation);
  }

  return results;
}

function evaluateSingle(
  obj: ObjectiveConfig,
  ctx: EvaluationContext,
): ObjectiveEvaluation | null {
  let progress = 0;
  const target = obj.requirement;

  switch (obj.type) {
    case "finish_race":
      progress = 1; // This race = 1 finish
      break;

    case "races_finished_count": {
      const prevRaces = ctx.previousRecords?.totalRacesFinished ?? 0;
      progress = prevRaces + 1;
      break;
    }

    case "total_rc_earned": {
      const prevEarned = ctx.previousRecords?.totalRaceCashEarned ?? 0;
      progress = prevEarned + ctx.rewardBreakdown.total;
      break;
    }

    case "no_reset":
      progress = ctx.resetCount === 0 ? 1 : 0;
      break;

    case "no_wrong_way":
      progress = ctx.wrongWayTriggered ? 0 : 1;
      break;

    case "clean_race":
      progress = (!ctx.wrongWayTriggered && ctx.resetCount === 0) ? 1 : 0;
      break;

    case "under_target_time":
      progress = ctx.totalTimeMs <= ctx.targetConfig.totalMs ? 1 : 0;
      break;

    case "under_elite_time": {
      const cutoff = getEliteTimeCutoff(ctx.carClass, ctx.trackId);
      progress = cutoff && ctx.totalTimeMs <= cutoff ? 1 : 0;
      break;
    }

    case "first_lap_under_target":
      progress =
        ctx.firstLapMs > 0 && ctx.firstLapMs <= ctx.targetConfig.firstLapMs
          ? 1
          : 0;
      break;

    case "best_lap_under_target":
      progress =
        ctx.bestLapMs > 0 && ctx.bestLapMs <= ctx.targetConfig.bestLapMs
          ? 1
          : 0;
      break;

    case "beat_total_pb_by_ms": {
      const prev = ctx.previousRecords?.bestTotalTimeMs;
      if (prev !== undefined && ctx.totalTimeMs < prev) {
        const improvement = prev - ctx.totalTimeMs;
        progress = Math.max(0, Math.floor(improvement));
      }
      break;
    }

    case "beat_first_lap_pb_by_ms": {
      const prev = ctx.previousRecords?.bestFirstLapMs;
      if (
        prev !== undefined &&
        ctx.firstLapMs > 0 &&
        ctx.firstLapMs < prev
      ) {
        const improvement = prev - ctx.firstLapMs;
        progress = Math.max(0, Math.floor(improvement));
      }
      break;
    }

    case "beat_best_lap_pb_by_ms": {
      const prev = ctx.previousRecords?.bestLapMs;
      if (prev !== undefined && ctx.bestLapMs > 0 && ctx.bestLapMs < prev) {
        const improvement = prev - ctx.bestLapMs;
        progress = Math.max(0, Math.floor(improvement));
      }
      break;
    }

    case "class_under_target":
      if (obj.carClass && ctx.carClass === obj.carClass) {
        // For Class D hard target objective
        const hardTarget =
          obj.id === "class_d_under_hard_target"
            ? CLASS_D_HARD_TARGET_MS
            : ctx.targetConfig.totalMs;
        progress = ctx.totalTimeMs <= hardTarget ? 1 : 0;
      }
      break;

    case "car_under_target":
      if (obj.carId && ctx.carId === obj.carId) {
        progress = ctx.totalTimeMs <= ctx.targetConfig.totalMs ? 1 : 0;
      }
      break;

    default:
      return null;
  }

  const completed = progress >= target;

  return {
    objectiveId: obj.id,
    objective: obj,
    completed,
    progress,
    target,
    newProgress: progress,
  };
}
