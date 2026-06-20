export type RaceCashPack = {
  id: string;
  name: string;
  raceCashAmount: number;
  tokenAmount: number;
  description: string;
};

export const RACE_CASH_PACKS: RaceCashPack[] = [
  {
    id: "starter-pack",
    name: "Starter Pack",
    raceCashAmount: 10_000,
    tokenAmount: 5_000,
    description: "Small boost for early garage upgrades.",
  },
  {
    id: "racer-pack",
    name: "Racer Pack",
    raceCashAmount: 50_000,
    tokenAmount: 20_000,
    description: "Enough Race Cash to unlock stronger early cars.",
  },
  {
    id: "degen-pack",
    name: "Degen Pack",
    raceCashAmount: 150_000,
    tokenAmount: 50_000,
    description: "Fast progression for serious racers.",
  },
  {
    id: "whale-pack",
    name: "Whale Pack",
    raceCashAmount: 500_000,
    tokenAmount: 150_000,
    description: "Big garage push. Still not cashout-eligible.",
  },
];

export function getRaceCashPack(packId: string) {
  return RACE_CASH_PACKS.find((pack) => pack.id === packId) || null;
}
