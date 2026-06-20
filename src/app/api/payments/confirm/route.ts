import { NextRequest, NextResponse } from "next/server";
import { getRaceCashPack } from "@/config/economy";
import { verifyTokenTransferSignature } from "@/lib/solana-payments";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type PaymentIntentRow = {
  id: string;
  wallet_address: string;
  action_type: string;
  item_id: string;
  token_amount: number | string;
  token_mint: string;
  treasury_wallet: string;
  status: string;
  signature: string | null;
  expires_at: string;
};

type PlayerRow = {
  purchased_race_cash: number | string;
  total_token_spent: number | string;
  season_token_spent: number | string;
};

export async function POST(request: NextRequest) {
  try {
    const { paymentIntentId, signature } = await request.json();

    if (typeof paymentIntentId !== "string" || !paymentIntentId) {
      return NextResponse.json({ error: "Missing payment intent" }, { status: 400 });
    }

    if (typeof signature !== "string" || signature.length < 32) {
      return NextResponse.json({ error: "Invalid transaction signature" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: reusedSignature, error: reusedError } = await supabase
      .from("token_transactions")
      .select("id")
      .eq("signature", signature)
      .maybeSingle();

    if (reusedError) throw reusedError;
    if (reusedSignature) {
      return NextResponse.json({ error: "Transaction signature already used" }, { status: 409 });
    }

    const { data: intent, error: intentError } = await supabase
      .from("payment_intents")
      .select("*")
      .eq("id", paymentIntentId)
      .single<PaymentIntentRow>();

    if (intentError) throw intentError;
    if (intent.status !== "pending") {
      return NextResponse.json({ error: "Payment intent is not pending" }, { status: 409 });
    }
    if (new Date(intent.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Payment intent expired" }, { status: 410 });
    }
    if (intent.action_type !== "buy_race_cash") {
      return NextResponse.json({ error: "Unsupported payment action" }, { status: 400 });
    }

    const pack = getRaceCashPack(intent.item_id);
    if (!pack || Number(intent.token_amount) !== pack.tokenAmount) {
      return NextResponse.json({ error: "Payment intent price mismatch" }, { status: 400 });
    }

    const verified = await verifyTokenTransferSignature({
      signature,
      walletAddress: intent.wallet_address,
      expectedTokenAmount: intent.token_amount,
    });

    const { data: claimedIntent, error: claimError } = await supabase
      .from("payment_intents")
      .update({ status: "paid", signature, confirmed_at: new Date().toISOString() })
      .eq("id", intent.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (claimError) throw claimError;
    if (!claimedIntent) {
      return NextResponse.json({ error: "Payment intent was already used" }, { status: 409 });
    }

    const { error: transactionError } = await supabase.from("token_transactions").insert({
      wallet_address: intent.wallet_address,
      signature,
      token_amount: intent.token_amount,
      action_type: intent.action_type,
      payment_intent_id: intent.id,
      token_mint: verified.tokenMint,
      recipient_wallet: verified.recipientWallet,
      status: "confirmed",
    });

    if (transactionError) throw transactionError;

    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("purchased_race_cash,total_token_spent,season_token_spent")
      .eq("wallet_address", intent.wallet_address)
      .single<PlayerRow>();

    if (playerError) throw playerError;

    const purchasedRaceCash = Number(player.purchased_race_cash || 0) + pack.raceCashAmount;
    const totalTokenSpent = Number(player.total_token_spent || 0) + pack.tokenAmount;
    const seasonTokenSpent = Number(player.season_token_spent || 0) + pack.tokenAmount;

    const { error: playerUpdateError } = await supabase
      .from("players")
      .update({
        purchased_race_cash: purchasedRaceCash,
        total_token_spent: totalTokenSpent,
        season_token_spent: seasonTokenSpent,
      })
      .eq("wallet_address", intent.wallet_address);

    if (playerUpdateError) throw playerUpdateError;

    const { error: ledgerError } = await supabase.from("race_cash_ledger").insert({
      wallet_address: intent.wallet_address,
      amount: pack.raceCashAmount,
      source: "token_purchase",
      cash_type: "purchased",
      reason: `Bought ${pack.name}`,
    });

    if (ledgerError) throw ledgerError;

    return NextResponse.json({
      status: "confirmed",
      purchasedRaceCashAdded: pack.raceCashAmount,
      tokenSpent: pack.tokenAmount,
      signature,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Confirm payment failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
