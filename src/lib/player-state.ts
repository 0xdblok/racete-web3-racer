import type { SupabaseClient } from "@supabase/supabase-js";
import { STARTER_CAR_ID } from "@/config/cars";

export async function getPlayerState(supabase: SupabaseClient, walletAddress: string) {
  const [{ data: player, error: playerError }, { data: ownedCars, error: carsError }] = await Promise.all([
    supabase.from("players").select("*").eq("wallet_address", walletAddress).single(),
    supabase
      .from("player_cars")
      .select("*")
      .eq("wallet_address", walletAddress)
      .order("acquired_at", { ascending: true }),
  ]);

  if (playerError) throw playerError;
  if (carsError) throw carsError;

  const selectedCar = ownedCars?.find((car) => car.is_selected) || ownedCars?.[0] || null;
  if (ownedCars?.length && !ownedCars.some((car) => car.is_selected)) {
    await supabase
      .from("player_cars")
      .update({ is_selected: true })
      .eq("wallet_address", walletAddress)
      .eq("car_id", selectedCar?.car_id || STARTER_CAR_ID);
    const { data: refreshedOwnedCars, error: refreshedError } = await supabase
      .from("player_cars")
      .select("*")
      .eq("wallet_address", walletAddress)
      .order("acquired_at", { ascending: true });
    if (refreshedError) throw refreshedError;
    return {
      player,
      ownedCars: refreshedOwnedCars || [],
      selectedCar: refreshedOwnedCars?.find((car) => car.is_selected) || refreshedOwnedCars?.[0] || null,
    };
  }

  return {
    player,
    ownedCars: ownedCars || [],
    selectedCar,
  };
}
