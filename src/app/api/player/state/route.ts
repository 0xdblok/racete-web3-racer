import { NextRequest, NextResponse } from "next/server";
import { getPlayerState } from "@/lib/player-state";
import { isValidSolanaAddress } from "@/lib/solana-payments";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const walletAddress = String(body.walletAddress || "");

    if (!isValidSolanaAddress(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    const state = await getPlayerState(getSupabaseAdmin(), walletAddress, { autoSelectFallback: false });
    if (!state.player) return NextResponse.json({ error: "Player not found" }, { status: 404 });
    return NextResponse.json(state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Player state failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
