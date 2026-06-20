import type { SupabaseClient } from "@supabase/supabase-js";
import { calculatePowerRating, getUpgradePrice, isUpgradeType, MAX_UPGRADE_LEVEL, type UpgradeType } from "@/config/upgrades";
import { getCarPrice } from "@/lib/car-purchases";
import { getPlayerState } from "@/lib/player-state";

type PlayerBalances = {
  earned_race_cash: number | string;
  purchased_race_cash: number | string;
};

type PlayerCarUpgradeRow = {
  id: string;
  car_id: string;
  engine_level: number;
  tires_level: number;
  nitro_level: number;
  handling_level: number;
  is_selected: boolean;
};

const UPGRADE_COLUMN: Record<UpgradeType, keyof Pick<PlayerCarUpgradeRow, "engine_level" | "tires_level" | "nitro_level" | "handling_level">> = {
  engine: "engine_level",
  tires: "tires_level",
  nitro: "nitro_level",
  handling: "handling_level",
};

export type UpgradeQuote = {
  carId: string;
  upgradeType: UpgradeType;
  currentLevel: number;
  nextLevel: number;
  raceCash: number;
  token: number;
};

export type ApplyUpgradeResult = Awaited<ReturnType<typeof getPlayerState>> & {
  quote: UpgradeQuote;
  raceCashSpent: number;
  spentPurchasedRaceCash: number;
  spentEarnedRaceCash: number;
  powerRating: number;
};

export async function getUpgradeQuote(params: {
  supabase: SupabaseClient;
  walletAddress: string;
  playerCarId: string;
  upgradeType: string;
}): Promise<{ quote: UpgradeQuote; playerCar: PlayerCarUpgradeRow } | null> {
  const { supabase, walletAddress, playerCarId, upgradeType } = params;
  if (!isUpgradeType(upgradeType)) throw new Error("Invalid upgrade type");

  const { data: playerCar, error: carError } = await supabase
    .from("player_cars")
    .select("id,car_id,engine_level,tires_level,nitro_level,handling_level,is_selected")
    .eq("id", playerCarId)
    .eq("wallet_address", walletAddress)
    .maybeSingle<PlayerCarUpgradeRow>();

  if (carError) throw carError;
  if (!playerCar) return null;

  const currentLevel = Number(playerCar[UPGRADE_COLUMN[upgradeType]] || 1);
  if (currentLevel >= MAX_UPGRADE_LEVEL) throw new Error("Upgrade already at max level");

  const price = getUpgradePrice(currentLevel);
  if (!price) throw new Error("Upgrade price unavailable");

  return {
    playerCar,
    quote: {
      carId: playerCar.car_id,
      upgradeType,
      currentLevel,
      nextLevel: price.nextLevel,
      raceCash: price.raceCash,
      token: price.token,
    },
  };
}

export async function applyCarUpgrade(params: {
  supabase: SupabaseClient;
  walletAddress: string;
  playerCarId: string;
  upgradeType: string;
  requireTokenPaid: boolean;
}): Promise<ApplyUpgradeResult> {
  const { supabase, walletAddress, playerCarId, upgradeType, requireTokenPaid } = params;
  const quoteResult = await getUpgradeQuote({ supabase, walletAddress, playerCarId, upgradeType });
  if (!quoteResult) throw new Error("Owned car not found");

  const { quote, playerCar } = quoteResult;
  if (quote.token > 0 && !requireTokenPaid) throw new Error("Token payment required for this upgrade");

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("earned_race_cash,purchased_race_cash")
    .eq("wallet_address", walletAddress)
    .single<PlayerBalances>();
  if (playerError) throw playerError;

  const earned = Number(player.earned_race_cash || 0);
  const purchased = Number(player.purchased_race_cash || 0);
  if (earned + purchased < quote.raceCash) throw new Error("Insufficient Race Cash");

  const spentPurchasedRaceCash = Math.min(purchased, quote.raceCash);
  const spentEarnedRaceCash = quote.raceCash - spentPurchasedRaceCash;

  const car = await getCarPrice(supabase, playerCar.car_id);
  if (!car) throw new Error("Unknown car");

  const nextLevels = {
    engine_level: playerCar.engine_level,
    tires_level: playerCar.tires_level,
    nitro_level: playerCar.nitro_level,
    handling_level: playerCar.handling_level,
    [UPGRADE_COLUMN[quote.upgradeType]]: quote.nextLevel,
  };

  const powerRating = calculatePowerRating({
    basePowerRating: car.basePowerRating,
    engineLevel: nextLevels.engine_level,
    tiresLevel: nextLevels.tires_level,
    nitroLevel: nextLevels.nitro_level,
    handlingLevel: nextLevels.handling_level,
  });

  const { error: balanceError } = await supabase
    .from("players")
    .update({
      purchased_race_cash: purchased - spentPurchasedRaceCash,
      earned_race_cash: earned - spentEarnedRaceCash,
    })
    .eq("wallet_address", walletAddress);
  if (balanceError) throw balanceError;

  const { error: upgradeError } = await supabase
    .from("player_cars")
    .update({ ...nextLevels, power_rating: powerRating })
    .eq("id", playerCar.id)
    .eq("wallet_address", walletAddress);
  if (upgradeError) throw upgradeError;

  const ledgerRows: Array<{
    wallet_address: string;
    amount: number;
    source: string;
    cash_type: "earned" | "purchased";
    reason: string;
  }> = [];

  if (spentPurchasedRaceCash > 0) {
    ledgerRows.push({
      wallet_address: walletAddress,
      amount: -spentPurchasedRaceCash,
      source: "car_upgrade",
      cash_type: "purchased",
      reason: `Upgraded ${car.name} ${quote.upgradeType} to level ${quote.nextLevel}`,
    });
  }
  if (spentEarnedRaceCash > 0) {
    ledgerRows.push({
      wallet_address: walletAddress,
      amount: -spentEarnedRaceCash,
      source: "car_upgrade",
      cash_type: "earned",
      reason: `Upgraded ${car.name} ${quote.upgradeType} to level ${quote.nextLevel}`,
    });
  }
  if (ledgerRows.length) {
    const { error: ledgerError } = await supabase.from("race_cash_ledger").insert(ledgerRows);
    if (ledgerError) throw ledgerError;
  }

  return {
    ...(await getPlayerState(supabase, walletAddress)),
    quote,
    raceCashSpent: quote.raceCash,
    spentPurchasedRaceCash,
    spentEarnedRaceCash,
    powerRating,
  };
}
