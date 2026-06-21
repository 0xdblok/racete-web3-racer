export type RaceMode = "solo" | "free_multiplayer" | "token_stake_multiplayer" | "multiplayer";

export interface TrackTargetConfig {
  totalMs: number;
  firstLapMs: number;
  bestLapMs: number;
}

export type RaceRewardBreakdown = {
  finishReward: number;
  targetTimeBonus: number;
  personalBestTotalBonus: number;
  personalBestFirstLapBonus: number;
  personalBestLapBonus: number;
  cleanRaceBonus: number;
  noResetBonus: number;
  noWrongWayBonus: number;
  total: number;
  earnedBonuses: string[];
  missedBonuses: string[];
  previousRecords: { bestTotalTimeMs?: number; bestFirstLapMs?: number; bestLapMs?: number } | null;
  newRecords: { bestTotalTimeMs?: number; bestFirstLapMs?: number; bestLapMs?: number } | null;
};

/**
 * Per-track target times for each car class.
 * Targets represent challenging but achievable times for competent drivers.
 * Expand with additional tracks by adding new top-level keys.
 */
const TRACK_TARGETS: Record<string, Record<string, TrackTargetConfig>> = {
  "city-loop": {
    D:  { totalMs: 200_000, firstLapMs: 65_000, bestLapMs: 60_000 },
    C:  { totalMs: 180_000, firstLapMs: 58_000, bestLapMs: 55_000 },
    "C+": { totalMs: 175_000, firstLapMs: 56_000, bestLapMs: 53_000 },
    B:  { totalMs: 165_000, firstLapMs: 53_000, bestLapMs: 50_000 },
    "B+": { totalMs: 160_000, firstLapMs: 51_000, bestLapMs: 48_000 },
    A:  { totalMs: 150_000, firstLapMs: 48_000, bestLapMs: 45_000 },
    S:  { totalMs: 140_000, firstLapMs: 45_000, bestLapMs: 42_000 },
  },
};

/** Fallback target used when a track or class has no explicit entry. */
const DEFAULT_TARGET: TrackTargetConfig = {
  totalMs: 180_000,
  firstLapMs: 60_000,
  bestLapMs: 55_000,
};

export const SOLO_RACE_REWARD_CONFIG = {
  finishReward: 40,
  targetTimeTotalBonus: 20,
  personalBestTotalBonus: 75,
  personalBestFirstLapBonus: 60,
  personalBestLapBonus: 50,
  cleanRaceBonus: 25,
  noResetBonus: 25,
  noWrongWayBonus: 20,
  maxSoloReward: 320,
  minFinishTimeMs: 30_000,
  maxFinishTimeMs: 30 * 60_000,
} as const;

export const MULTIPLAYER_RACE_CASH_PLACEMENT_REWARDS: Record<number, number> = {
  1: 300,
  2: 220,
  3: 160,
  4: 100,
  5: 60,
  6: 40,
};

export const MULTIPLAYER_PLACEMENT_REWARDS = MULTIPLAYER_RACE_CASH_PLACEMENT_REWARDS;

/**
 * Look up the target times for a given car class on a given track.
 * Falls back to the default target if the track or class is not found.
 */
export function getTrackTarget(carClass: string, trackId: string): TrackTargetConfig {
  const trackMap = TRACK_TARGETS[trackId];
  if (!trackMap) return { ...DEFAULT_TARGET };
  return trackMap[carClass] ?? trackMap["default"] ?? { ...DEFAULT_TARGET };
}

/**
 * Calculate the full solo race reward breakdown including earned/missed
 * bonuses and personal record tracking.
 */
export function calculateSoloRaceReward(params: {
  completed: boolean;
  totalTimeMs: number;
  bestLapMs: number;
  firstLapMs: number;
  wrongWayTriggered: boolean;
  resetCount: number;
  targetConfig: TrackTargetConfig;
  previousRecords: {
    bestTotalTimeMs?: number;
    bestFirstLapMs?: number;
    bestLapMs?: number;
  } | null;
}): RaceRewardBreakdown {
  const zeroBreakdown = (msg: string): RaceRewardBreakdown => ({
    finishReward: 0,
    targetTimeBonus: 0,
    personalBestTotalBonus: 0,
    personalBestFirstLapBonus: 0,
    personalBestLapBonus: 0,
    cleanRaceBonus: 0,
    noResetBonus: 0,
    noWrongWayBonus: 0,
    total: 0,
    earnedBonuses: [],
    missedBonuses: [msg],
    previousRecords: params.previousRecords
      ? {
          bestTotalTimeMs: params.previousRecords.bestTotalTimeMs,
          bestFirstLapMs: params.previousRecords.bestFirstLapMs,
          bestLapMs: params.previousRecords.bestLapMs,
        }
      : null,
    newRecords: null,
  });

  if (!params.completed) {
    return zeroBreakdown("Race not completed");
  }

  const cfg = SOLO_RACE_REWARD_CONFIG;
  const earned: string[] = [];
  const missed: string[] = [];

  // --- Finish reward (always earned if completed) ---
  const finishReward = cfg.finishReward;
  earned.push("Finish");

  // --- Target time bonus ---
  let targetTimeBonus = 0;
  if (params.totalTimeMs <= params.targetConfig.totalMs) {
    targetTimeBonus = cfg.targetTimeTotalBonus;
    earned.push("Target Time");
  } else {
    missed.push("Target Time (total time too slow)");
  }

  // --- Personal bests ---
  let personalBestTotalBonus = 0;
  let personalBestFirstLapBonus = 0;
  let personalBestLapBonus = 0;

  const newRecords: { bestTotalTimeMs?: number; bestFirstLapMs?: number; bestLapMs?: number } = {};

  if (params.previousRecords) {
    // Best total time
    const prevTotal = params.previousRecords.bestTotalTimeMs;
    if (prevTotal === undefined || params.totalTimeMs < prevTotal) {
      personalBestTotalBonus = cfg.personalBestTotalBonus;
      newRecords.bestTotalTimeMs = params.totalTimeMs;
      earned.push("Personal Best Total Time");
    } else {
      missed.push("Personal Best Total Time (not faster than previous best)");
    }

    // Best first lap
    const prevFirstLap = params.previousRecords.bestFirstLapMs;
    if (params.firstLapMs > 0 && (prevFirstLap === undefined || params.firstLapMs < prevFirstLap)) {
      personalBestFirstLapBonus = cfg.personalBestFirstLapBonus;
      newRecords.bestFirstLapMs = params.firstLapMs;
      earned.push("Personal Best First Lap");
    } else if (params.firstLapMs > 0) {
      missed.push("Personal Best First Lap (not faster than previous best)");
    }

    // Best lap
    const prevLap = params.previousRecords.bestLapMs;
    if (params.bestLapMs > 0 && (prevLap === undefined || params.bestLapMs < prevLap)) {
      personalBestLapBonus = cfg.personalBestLapBonus;
      newRecords.bestLapMs = params.bestLapMs;
      earned.push("Personal Best Lap");
    } else if (params.bestLapMs > 0) {
      missed.push("Personal Best Lap (not faster than previous best)");
    }
  } else {
    // No previous records at all
    missed.push("Personal Best Total Time (no previous record)");
    if (params.firstLapMs > 0) missed.push("Personal Best First Lap (no previous record)");
    if (params.bestLapMs > 0) missed.push("Personal Best Lap (no previous record)");
  }

  // --- Clean race ---
  let cleanRaceBonus = 0;
  if (!params.wrongWayTriggered && params.resetCount === 0) {
    cleanRaceBonus = cfg.cleanRaceBonus;
    earned.push("Clean Race");
  } else {
    missed.push("Clean Race (wrong way or resets detected)");
  }

  // --- No resets ---
  let noResetBonus = 0;
  if (params.resetCount === 0) {
    noResetBonus = cfg.noResetBonus;
    earned.push("No Resets");
  } else {
    missed.push(`No Resets (${params.resetCount} reset(s) used)`);
  }

  // --- No wrong way ---
  let noWrongWayBonus = 0;
  if (!params.wrongWayTriggered) {
    noWrongWayBonus = cfg.noWrongWayBonus;
    earned.push("No Wrong Way");
  } else {
    missed.push("No Wrong Way (wrong way triggered)");
  }

  // --- Total ---
  let total = finishReward + targetTimeBonus + personalBestTotalBonus +
    personalBestFirstLapBonus + personalBestLapBonus + cleanRaceBonus +
    noResetBonus + noWrongWayBonus;

  total = Math.min(total, cfg.maxSoloReward);

  return {
    finishReward,
    targetTimeBonus,
    personalBestTotalBonus,
    personalBestFirstLapBonus,
    personalBestLapBonus,
    cleanRaceBonus,
    noResetBonus,
    noWrongWayBonus,
    total,
    earnedBonuses: earned,
    missedBonuses: missed,
    previousRecords: params.previousRecords
      ? {
          bestTotalTimeMs: params.previousRecords.bestTotalTimeMs,
          bestFirstLapMs: params.previousRecords.bestFirstLapMs,
          bestLapMs: params.previousRecords.bestLapMs,
        }
      : null,
    newRecords: Object.keys(newRecords).length > 0 ? newRecords : null,
  };
}

export function getMultiplayerPlacementReward(placement: number): number {
  return MULTIPLAYER_PLACEMENT_REWARDS[placement] ?? 0;
}

// ── Race records helpers ─────────────────────────────────────────────────────

/** Recognized car classes for validation. */
const RECOGNIZED_CLASSES = new Set(["D", "C", "C+", "B", "B+", "A", "S"]);

export function isRecognizedCarClass(carClass: string): boolean {
  return RECOGNIZED_CLASSES.has(carClass);
}

/** Shape of a race_records row in Supabase. */
export type RaceRecordRow = {
  id?: string;
  wallet_address: string;
  track_id: string;
  car_class: string;
  best_total_time_ms?: number;
  best_first_lap_ms?: number;
  best_lap_ms?: number;
  total_races_finished?: number;
  total_race_cash_earned?: number | string;
  updated_at?: string;
  created_at?: string;
};

/**
 * Normalised previous-best shape passed into the reward calculator.
 * Matches the camelCase convention used in the frontend.
 */
export type PreviousRecords = {
  bestTotalTimeMs?: number;
  bestFirstLapMs?: number;
  bestLapMs?: number;
  totalRacesFinished?: number;
  totalRaceCashEarned?: number;
};
