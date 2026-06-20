export const UPGRADE_TYPES = ["engine", "tires", "nitro", "handling"] as const;

export type UpgradeType = (typeof UPGRADE_TYPES)[number];

export type UpgradePrice = {
  nextLevel: number;
  raceCash: number;
  token: number;
};

const RACE_CASH_BY_NEXT_LEVEL: Record<number, number> = {
  2: 5_000,
  3: 15_000,
  4: 30_000,
  5: 60_000,
  6: 100_000,
  7: 150_000,
  8: 225_000,
  9: 325_000,
  10: 450_000,
};

const TOKEN_BY_NEXT_LEVEL: Record<number, number> = {
  2: 0,
  3: 0,
  4: 5_000,
  5: 12_000,
  6: 22_000,
  7: 35_000,
  8: 55_000,
  9: 80_000,
  10: 110_000,
};

const POWER_BY_TYPE: Record<UpgradeType, number> = {
  engine: 14,
  tires: 10,
  nitro: 11,
  handling: 9,
};

export const MAX_UPGRADE_LEVEL = 10;

export function isUpgradeType(value: string): value is UpgradeType {
  return UPGRADE_TYPES.includes(value as UpgradeType);
}

export function getUpgradePrice(currentLevel: number): UpgradePrice | null {
  const nextLevel = currentLevel + 1;
  if (nextLevel < 2 || nextLevel > MAX_UPGRADE_LEVEL) return null;
  return {
    nextLevel,
    raceCash: RACE_CASH_BY_NEXT_LEVEL[nextLevel],
    token: TOKEN_BY_NEXT_LEVEL[nextLevel],
  };
}

export function calculatePowerRating(params: {
  basePowerRating: number;
  engineLevel: number;
  tiresLevel: number;
  nitroLevel: number;
  handlingLevel: number;
}) {
  return Math.round(
    params.basePowerRating +
      (params.engineLevel - 1) * POWER_BY_TYPE.engine +
      (params.tiresLevel - 1) * POWER_BY_TYPE.tires +
      (params.nitroLevel - 1) * POWER_BY_TYPE.nitro +
      (params.handlingLevel - 1) * POWER_BY_TYPE.handling,
  );
}
