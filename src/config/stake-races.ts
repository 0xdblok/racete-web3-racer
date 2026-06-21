export type StakeTier = {
  id: string;
  label: string;
  stakeAmount: number;
  maxPlayers: number;
  enabled: boolean;
};

export type StakePotPayout = {
  placement: number;
  percent: number;
};

export const TOKEN_STAKE_SYMBOL = "$RACETE";

export const TOKEN_STAKE_POT_PAYOUTS: StakePotPayout[] = [
  { placement: 1, percent: 40 },
  { placement: 2, percent: 25 },
  { placement: 3, percent: 15 },
  { placement: 4, percent: 10 },
  { placement: 5, percent: 0 },
  { placement: 6, percent: 0 },
];

export const TOKEN_STAKE_PLATFORM_FEE_PERCENT = 10;

export const TOKEN_STAKE_TIERS: StakeTier[] = [
  { id: "stake-100", label: "Starter Stake", stakeAmount: 100, maxPlayers: 6, enabled: false },
  { id: "stake-500", label: "Racer Stake", stakeAmount: 500, maxPlayers: 6, enabled: false },
  { id: "stake-1000", label: "Degen Stake", stakeAmount: 1000, maxPlayers: 6, enabled: false },
];

export const DEFAULT_TOKEN_STAKE_TIER = TOKEN_STAKE_TIERS[0];

export function calculateStakePotPreview(stakeAmount: number, players: number) {
  const pool = stakeAmount * players;
  const payouts = TOKEN_STAKE_POT_PAYOUTS.map((payout) => ({
    placement: payout.placement,
    percent: payout.percent,
    amount: Math.floor((pool * payout.percent) / 100),
  }));
  const platformFee = Math.floor((pool * TOKEN_STAKE_PLATFORM_FEE_PERCENT) / 100);

  return { pool, payouts, platformFee };
}
