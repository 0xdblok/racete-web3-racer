import { NextRequest, NextResponse } from "next/server";
import { getRaceCashPack } from "@/config/economy";
import { serverEnv } from "@/lib/server-env";
import { isValidSolanaAddress } from "@/lib/solana-payments";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const INTENT_TTL_MINUTES = 15;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const walletAddress = String(body.walletAddress || "");
    const actionType = String(body.actionType || "");
    const itemId = String(body.itemId || "");

    if (!isValidSolanaAddress(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    if (!serverEnv.mockTokenMode && (!serverEnv.tokenMint || !serverEnv.treasuryWallet)) {
      return NextResponse.json({ error: "Token payments are not configured" }, { status: 503 });
    }

    if (actionType !== "buy_race_cash") {
      return NextResponse.json({ error: "Unsupported payment action" }, { status: 400 });
    }

    const pack = getRaceCashPack(itemId);
    if (!pack) {
      return NextResponse.json({ error: "Unknown Race Cash pack" }, { status: 404 });
    }

    const supabase = getSupabaseAdmin();
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("wallet_address")
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    if (playerError) throw playerError;
    if (!player) return NextResponse.json({ error: "Player profile not found" }, { status: 404 });

    const expiresAt = new Date(Date.now() + INTENT_TTL_MINUTES * 60_000).toISOString();
    const { data: intent, error: intentError } = await supabase
      .from("payment_intents")
      .insert({
        wallet_address: walletAddress,
        action_type: actionType,
        item_id: pack.id,
        token_amount: pack.tokenAmount,
        token_mint: serverEnv.tokenMint,
        treasury_wallet: serverEnv.treasuryWallet,
        status: "pending",
        expires_at: expiresAt,
      })
      .select("id,wallet_address,action_type,item_id,token_amount,token_mint,treasury_wallet,status,expires_at")
      .single();

    if (intentError) throw intentError;

    return NextResponse.json({
      paymentIntentId: intent.id,
      actionType: intent.action_type,
      itemId: intent.item_id,
      tokenAmount: Number(intent.token_amount),
      tokenMint: intent.token_mint,
      treasuryWallet: intent.treasury_wallet,
      expiresAt: intent.expires_at,
      raceCashAmount: pack.raceCashAmount,
      packName: pack.name,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Create payment intent failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
