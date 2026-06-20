import { NextRequest, NextResponse } from "next/server";
import { CARS, STARTER_CAR_ID } from "@/config/cars";
import { getPlayerState } from "@/lib/player-state";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json();

    if (typeof walletAddress !== "string" || !WALLET_RE.test(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { error: playerUpsertError } = await supabase
      .from("players")
      .upsert(
        { wallet_address: walletAddress, last_login: now },
        { onConflict: "wallet_address", ignoreDuplicates: false },
      );

    if (playerUpsertError) throw playerUpsertError;

    const starter = CARS.find((car) => car.id === STARTER_CAR_ID)!;

    const { data: existingStarter, error: starterLookupError } = await supabase
      .from("player_cars")
      .select("id")
      .eq("wallet_address", walletAddress)
      .eq("car_id", STARTER_CAR_ID)
      .maybeSingle();

    if (starterLookupError) throw starterLookupError;

    if (!existingStarter) {
      const { error: starterInsertError } = await supabase.from("player_cars").insert({
        wallet_address: walletAddress,
        car_id: STARTER_CAR_ID,
        power_rating: starter.basePowerRating,
        is_selected: true,
      });

      if (starterInsertError) throw starterInsertError;
    }

    const { data: selectedCars, error: selectedLookupError } = await supabase
      .from("player_cars")
      .select("id")
      .eq("wallet_address", walletAddress)
      .eq("is_selected", true);

    if (selectedLookupError) throw selectedLookupError;

    if (!selectedCars?.length) {
      const { error: selectError } = await supabase
        .from("player_cars")
        .update({ is_selected: true })
        .eq("wallet_address", walletAddress)
        .eq("car_id", STARTER_CAR_ID);

      if (selectError) throw selectError;
    }

    return NextResponse.json(await getPlayerState(supabase, walletAddress));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Player init failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
