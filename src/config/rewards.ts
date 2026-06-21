export type RaceMode = "solo" | "free_multiplayer" | "token_stake_multiplayer" | "multiplayer";

export type RaceRewardBreakdown = {
  finish: number;
  bestLap: number;
  cleanRace: number;
  fastFinish: number;
  total: number;
};

export const SOLO_RACE_REWARD_CONFIG = {
  finishReward: 50,
  bestLapBonus: 10,
  cleanRaceBonus: 10,
  fastFinishBonus: 5,
  fastFinishUnderMs: 180_000,
  maxReward: 75,
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

export function calculateSoloRaceReward(params: {
  completed: boolean;
  totalTimeMs: number;
  bestLapMs: number;
  cleanRace?: boolean;
}): RaceRewardBreakdown {
  if (!params.completed) {
    return { finish: 0, bestLap: 0, cleanRace: 0, fastFinish: 0, total: 0 };
  }

  const finish = SOLO_RACE_REWARD_CONFIG.finishReward;
  const bestLap = params.bestLapMs > 0 ? SOLO_RACE_REWARD_CONFIG.bestLapBonus : 0;
  const cleanRace = params.cleanRace === false ? 0 : SOLO_RACE_REWARD_CONFIG.cleanRaceBonus;
  const fastFinish = params.totalTimeMs <= SOLO_RACE_REWARD_CONFIG.fastFinishUnderMs
    ? SOLO_RACE_REWARD_CONFIG.fastFinishBonus
    : 0;
  const total = Math.min(
    finish + bestLap + cleanRace + fastFinish,
    SOLO_RACE_REWARD_CONFIG.maxReward,
  );

  return { finish, bestLap, cleanRace, fastFinish, total };
}

export function getMultiplayerPlacementReward(placement: number): number {
  return MULTIPLAYER_PLACEMENT_REWARDS[placement] ?? 0;
}
