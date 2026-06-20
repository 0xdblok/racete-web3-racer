import type { SupabaseClient } from "@supabase/supabase-js";
import { CARS, type CarConfig } from "@/config/cars";
import { getPlayerState } from "@/lib/player-state";

type PlayerBalances = {
  earned_race_cash: number | string;
  purchased_race_cash: number | string;
};

export type CarPurchaseResult = Awaited<ReturnType<typeof getPlayerState>> & {
  raceCashSpent: number;
  spentPurchasedRaceCash: number;
  spentEarnedRaceCash: number;
};

export async function getCarPrice(supabase: SupabaseClient, carId: string): Promise<CarConfig | null> {
  const { data, error } = await supabase
    .from("cars_catalog")
    .select("id,name,class,model_url,base_power_rating,price_race_cash,price_token,is_starter,is_active")
    .eq("id", carId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  if (data) {
    const fallback = CARS.find((car) => car.id === data.id);
    return {
      id: data.id,
      name: data.name,
      class: data.class,
      modelUrl: data.model_url,
      basePowerRating: Number(data.base_power_rating),
      priceRaceCash: Number(data.price_race_cash),
      priceToken: Number(data.price_token),
      isStarter: Boolean(data.is_starter),
      vibe: fallback?.vibe || "Garage car",
      stats: fallback?.stats || { speed: 0, acceleration: 0, handling: 0, nitro: 0 },
    };
  }

  return CARS.find((car) => car.id === carId) || null;
}

export async function purchaseCarWithRaceCash(params: {
  supabase: SupabaseClient;
  walletAddress: string;
  car: CarConfig;
  requireTokenPaid: boolean;
}): Promise<CarPurchaseResult> {
  const { supabase, walletAddress, car, requireTokenPaid } = params;

  const { data: existingCar, error: existingError } = await supabase
    .from("player_cars")
    .select("id")
    .eq("wallet_address", walletAddress)
    .eq("car_id", car.id)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existingCar) throw new Error("Car already owned");

  if (car.priceToken > 0 && !requireTokenPaid) {
    throw new Error("Token payment required for this car");
  }

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("earned_race_cash,purchased_race_cash")
    .eq("wallet_address", walletAddress)
    .single<PlayerBalances>();

  if (playerError) throw playerError;

  const earned = Number(player.earned_race_cash || 0);
  const purchased = Number(player.purchased_race_cash || 0);
  const price = Number(car.priceRaceCash || 0);
  if (purchased + earned < price) {
    throw new Error("Insufficient Race Cash");
  }

  const spentPurchasedRaceCash = Math.min(purchased, price);
  const spentEarnedRaceCash = price - spentPurchasedRaceCash;
  const nextPurchased = purchased - spentPurchasedRaceCash;
  const nextEarned = earned - spentEarnedRaceCash;

  const { error: balanceError } = await supabase
    .from("players")
    .update({ purchased_race_cash: nextPurchased, earned_race_cash: nextEarned })
    .eq("wallet_address", walletAddress);
  if (balanceError) throw balanceError;

  const { error: carInsertError } = await supabase.from("player_cars").insert({
    wallet_address: walletAddress,
    car_id: car.id,
    power_rating: car.basePowerRating,
    is_selected: false,
  });
  if (carInsertError) throw carInsertError;

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
      source: "car_purchase",
      cash_type: "purchased",
      reason: `Bought ${car.name}`,
    });
  }

  if (spentEarnedRaceCash > 0) {
    ledgerRows.push({
      wallet_address: walletAddress,
      amount: -spentEarnedRaceCash,
      source: "car_purchase",
      cash_type: "earned",
      reason: `Bought ${car.name}`,
    });
  }

  if (ledgerRows.length) {
    const { error: ledgerError } = await supabase.from("race_cash_ledger").insert(ledgerRows);
    if (ledgerError) throw ledgerError;
  }

  return {
    ...(await getPlayerState(supabase, walletAddress)),
    raceCashSpent: price,
    spentPurchasedRaceCash,
    spentEarnedRaceCash,
  };
}
