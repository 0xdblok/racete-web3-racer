import { NextRequest, NextResponse } from "next/server";
import { getPlayerState } from "@/lib/player-state";
import { isValidSolanaAddress } from "@/lib/solana-payments";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, carId } = await request.json();

    if (typeof walletAddress !== "string" || !isValidSolanaAddress(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }
    if (typeof carId !== "string" || !carId) {
      return NextResponse.json({ error: "Missing car id" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: ownedCar, error: ownedError } = await supabase
      .from("player_cars")
      .select("id")
      .eq("wallet_address", walletAddress)
      .eq("car_id", carId)
      .maybeSingle();

    if (ownedError) throw ownedError;
    if (!ownedCar) return NextResponse.json({ error: "Car is not owned" }, { status: 403 });

    const { error: clearError } = await supabase
      .from("player_cars")
      .update({ is_selected: false })
      .eq("wallet_address", walletAddress);
    if (clearError) throw clearError;

    const { error: selectError } = await supabase
      .from("player_cars")
      .update({ is_selected: true })
      .eq("wallet_address", walletAddress)
      .eq("car_id", carId);
    if (selectError) throw selectError;

    return NextResponse.json(await getPlayerState(supabase, walletAddress));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Car select failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
