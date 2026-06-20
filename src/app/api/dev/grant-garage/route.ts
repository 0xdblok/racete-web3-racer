import { NextRequest, NextResponse } from "next/server";
import { CARS, STARTER_CAR_ID } from "@/config/cars";
import { getPlayerState } from "@/lib/player-state";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const DEV_WALLET = "7ZA3Z6pceuPzrrhnNNqRyT1evjBUAKZXLeCgxCzmMMzz";
const WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function isDevToolsEnabled() {
  return process.env.DEV_TOOLS_ENABLED === "true";
}

export async function POST(request: NextRequest) {
  try {
    if (!isDevToolsEnabled()) {
      return NextResponse.json({ error: "Dev tools not enabled" }, { status: 403 });
    }

    const { walletAddress } = await request.json();

    if (typeof walletAddress !== "string" || !WALLET_RE.test(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    if (walletAddress !== DEV_WALLET) {
      return NextResponse.json({ error: "Unauthorized wallet" }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    // Ensure player exists
    const { error: playerUpsertError } = await supabase
      .from("players")
      .upsert(
        { wallet_address: walletAddress, last_login: now },
        { onConflict: "wallet_address", ignoreDuplicates: false },
      );

    if (playerUpsertError) throw playerUpsertError;

    // Grant all cars not yet owned
    const { data: ownedCars } = await supabase
      .from("player_cars")
      .select("car_id")
      .eq("wallet_address", walletAddress);

    const ownedIds = new Set((ownedCars || []).map((c) => c.car_id));

    const carsToInsert = CARS.filter((car) => !ownedIds.has(car.id)).map((car) => ({
      wallet_address: walletAddress,
      car_id: car.id,
      power_rating: car.basePowerRating,
      is_selected: false,
    }));

    if (carsToInsert.length > 0) {
      const { error: insertError } = await supabase.from("player_cars").insert(carsToInsert);
      if (insertError) throw insertError;
    }

    // Ensure one selected car
    const { data: selectedCars } = await supabase
      .from("player_cars")
      .select("id")
      .eq("wallet_address", walletAddress)
      .eq("is_selected", true);

    if (!selectedCars?.length) {
      const { error: selectError } = await supabase
        .from("player_cars")
        .update({ is_selected: true })
        .eq("wallet_address", walletAddress)
        .eq("car_id", STARTER_CAR_ID);
      if (selectError) throw selectError;
    }

    // Add purchased Race Cash (not earned)
    const GRANT_AMOUNT = 2_000_000;

    const { data: playerBefore } = await supabase
      .from("players")
      .select("purchased_race_cash")
      .eq("wallet_address", walletAddress)
      .single();

    const currentPurchased = Number(playerBefore?.purchased_race_cash || 0);

    const { error: updateError } = await supabase
      .from("players")
      .update({ purchased_race_cash: currentPurchased + GRANT_AMOUNT })
      .eq("wallet_address", walletAddress);

    if (updateError) throw updateError;

    // Ledger entry
    const { error: ledgerError } = await supabase.from("race_cash_ledger").insert({
      wallet_address: walletAddress,
      amount: GRANT_AMOUNT,
      cash_type: "purchased",
      source: "dev_grant",
      reason: "Dev test garage grant",
    });

    if (ledgerError) throw ledgerError;

    return NextResponse.json(await getPlayerState(supabase, walletAddress));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dev grant failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
