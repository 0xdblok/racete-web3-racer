import type { TokenStakeAmount } from "@/types/token-rooms";

export const RACETE_TEST_TOKEN_MINT = "26vpJsWJswDbztCoZBEskkqjMKeFn9ym7s72Hn3spump" as const;
export const RACETE_TOKEN_MINT = "TO_BE_PROVIDED_FINAL_PUMPFUN_MINT" as const;

export const TOKEN_WEEKLY_REWARD_WALLET = "4oCUAXbyLfSzd6YifcL1QkXNqepm2cZpwxm3pqGNx6Lw" as const;
export const TOKEN_TREASURY_WALLET = "ne8CVnmNJKuSegSLJ7PtA1zPqEKdynXSzivj4kKVXVG" as const;
export const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" as const;
export const CLASSIC_SPL_TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" as const;

export function getTokenRoomDepositWallet(): string {
  return (process.env.TOKEN_ROOM_DEPOSIT_WALLET || process.env.NEXT_PUBLIC_TOKEN_ROOM_DEPOSIT_WALLET || "").trim();
}

export const TOKEN_STAKE_ROOMS_ENABLED = false as const;
export const TOKEN_STAKE_ROOMS_TEST_MODE = true as const;

export const TOKEN_ROOM_DECIMALS = 6 as const;
export const TOKEN_ROOM_MIN_PLAYERS = 2 as const;
export const TOKEN_ROOM_MAX_PLAYERS = 6 as const;

export const TOKEN_STAKE_PRESETS: readonly TokenStakeAmount[] = [1_000, 5_000, 10_000, 25_000] as const;

export const TOKEN_ROOM_FEE_BPS = {
  creatorFeeBps: 0,
  weeklyRewardBps: 1_500,
  treasuryFeeBps: 500,
  playerPayoutBps: 8_000,
} as const;

export const TOKEN_ROOM_PAYOUT_SPLITS = {
  threeOrMoreValidFinishers: [
    { rank: 1, bps: 6_500 },
    { rank: 2, bps: 2_500 },
    { rank: 3, bps: 1_000 },
  ],
  twoValidFinishers: [
    { rank: 1, bps: 7_500 },
    { rank: 2, bps: 2_500 },
  ],
  oneValidFinisher: [{ rank: 1, bps: 10_000 }],
} as const;

export type TokenRoomMode = "disabled" | "test" | "production";

export type TokenStakePresetConfig = {
  amount: TokenStakeAmount;
  label: string;
  baseUnits: string;
};

export const TOKEN_STAKE_PRESET_CONFIGS: readonly TokenStakePresetConfig[] = TOKEN_STAKE_PRESETS.map((amount) => ({
  amount,
  label: `${amount.toLocaleString("en-US")} RACETE`,
  baseUnits: toTokenBaseUnits(amount),
}));

export function getTokenRoomMode(): TokenRoomMode {
  if (!TOKEN_STAKE_ROOMS_ENABLED) return "disabled";
  if (TOKEN_STAKE_ROOMS_TEST_MODE) return "test";
  return "production";
}

export function getActiveTokenMint(): string {
  return TOKEN_STAKE_ROOMS_TEST_MODE ? RACETE_TEST_TOKEN_MINT : RACETE_TOKEN_MINT;
}

export function toTokenBaseUnits(amount: number, decimals: number = TOKEN_ROOM_DECIMALS): string {
  return String(Math.round(amount * 10 ** decimals));
}

export function getPlayerPayoutSplit(validFinisherCount: number): readonly { rank: number; bps: number }[] {
  if (validFinisherCount <= 0) return [];
  if (validFinisherCount === 1) return TOKEN_ROOM_PAYOUT_SPLITS.oneValidFinisher;
  if (validFinisherCount === 2) return TOKEN_ROOM_PAYOUT_SPLITS.twoValidFinishers;
  return TOKEN_ROOM_PAYOUT_SPLITS.threeOrMoreValidFinishers;
}

export function calculateTokenRoomPoolBreakdown(poolAmount: number) {
  const weeklyRewardAmount = Math.floor((poolAmount * TOKEN_ROOM_FEE_BPS.weeklyRewardBps) / 10_000);
  const treasuryFeeAmount = Math.floor((poolAmount * TOKEN_ROOM_FEE_BPS.treasuryFeeBps) / 10_000);
  const creatorFeeAmount = Math.floor((poolAmount * TOKEN_ROOM_FEE_BPS.creatorFeeBps) / 10_000);
  const playerPayoutPoolAmount = poolAmount - weeklyRewardAmount - treasuryFeeAmount - creatorFeeAmount;

  return {
    poolAmount,
    creatorFeeAmount,
    weeklyRewardAmount,
    treasuryFeeAmount,
    playerPayoutPoolAmount,
  };
}

export const TOKEN_ROOM_DISABLED_MESSAGE = "Token Stake Rooms are disabled in V1 test mode." as const;
