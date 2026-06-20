import { NextRequest, NextResponse } from "next/server";
import { getRaceCashPack } from "@/config/economy";
import { getCarPrice, purchaseCarWithRaceCash } from "@/lib/car-purchases";
import { serverEnv } from "@/lib/server-env";
import { verifyTokenTransferSignature } from "@/lib/solana-payments";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type PaymentIntentRow = {
  id: string;
  wallet_address: string;
  action_type: string;
  item_id: string;
  car_id: string | null;
  token_amount: number | string;
  token_mint: string;
  treasury_wallet: string;
  status: string;
  signature: string | null;
  expires_at: string;
};

type PlayerTokenRow = {
  total_token_spent: number | string;
  season_token_spent: number | string;
};

type MockConfirmation = {
  type?: string;
  walletAddress?: string;
};

const MOCK_CONFIRMATION_TYPE = "RACETE_MOCK_TOKEN_PAYMENT";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const paymentIntentId = body.paymentIntentId;
    const signature = body.signature;
    const mockConfirmation = body.mockConfirmation as MockConfirmation | undefined;
    const isMockConfirmation = mockConfirmation?.type === MOCK_CONFIRMATION_TYPE;

    if (typeof paymentIntentId !== "string" || !paymentIntentId) {
      return NextResponse.json({ error: "Missing payment intent" }, { status: 400 });
    }

    if (!isMockConfirmation && (typeof signature !== "string" || signature.length < 32)) {
      return NextResponse.json({ error: "Invalid transaction signature" }, { status: 400 });
    }

    if (isMockConfirmation && !serverEnv.mockTokenMode) {
      return NextResponse.json({ error: "Mock payments are disabled" }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
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
    if (!["buy_race_cash", "buy_car"].includes(intent.action_type)) {
      return NextResponse.json({ error: "Unsupported payment action" }, { status: 400 });
    }

    const pack = intent.action_type === "buy_race_cash" ? getRaceCashPack(intent.item_id) : null;
    const car = intent.action_type === "buy_car" ? await getCarPrice(supabase, intent.car_id || intent.item_id) : null;

    if (intent.action_type === "buy_race_cash" && (!pack || Number(intent.token_amount) !== pack.tokenAmount)) {
      return NextResponse.json({ error: "Payment intent price mismatch" }, { status: 400 });
    }
    if (intent.action_type === "buy_car" && (!car || Number(intent.token_amount) !== car.priceToken || car.priceToken <= 0)) {
      return NextResponse.json({ error: "Payment intent car price mismatch" }, { status: 400 });
    }

    if (intent.action_type === "buy_car" && car) {
      const [{ data: existingCar, error: existingError }, { data: balancePlayer, error: balanceError }] = await Promise.all([
        supabase
          .from("player_cars")
          .select("id")
          .eq("wallet_address", intent.wallet_address)
          .eq("car_id", car.id)
          .maybeSingle(),
        supabase
          .from("players")
          .select("earned_race_cash,purchased_race_cash")
          .eq("wallet_address", intent.wallet_address)
          .single<{ earned_race_cash: number | string; purchased_race_cash: number | string }>(),
      ]);
      if (existingError) throw existingError;
      if (balanceError) throw balanceError;
      if (existingCar) return NextResponse.json({ error: "Car already owned" }, { status: 409 });
      const raceCashBalance = Number(balancePlayer.purchased_race_cash || 0) + Number(balancePlayer.earned_race_cash || 0);
      if (raceCashBalance < car.priceRaceCash) {
        return NextResponse.json({ error: "Insufficient Race Cash" }, { status: 402 });
      }
    }

    const finalSignature = isMockConfirmation ? `mock:${intent.id}` : signature;
    if (typeof finalSignature !== "string") {
      return NextResponse.json({ error: "Invalid confirmation signature" }, { status: 400 });
    }

    if (isMockConfirmation && mockConfirmation?.walletAddress !== intent.wallet_address) {
      return NextResponse.json({ error: "Mock confirmation wallet mismatch" }, { status: 400 });
    }

    const { data: reusedSignature, error: reusedError } = await supabase
      .from("token_transactions")
      .select("id")
      .eq("signature", finalSignature)
      .maybeSingle();

    if (reusedError) throw reusedError;
    if (reusedSignature) {
      return NextResponse.json({ error: "Transaction signature already used" }, { status: 409 });
    }

    const verified = isMockConfirmation
      ? {
          tokenMint: intent.token_mint,
          recipientWallet: intent.treasury_wallet,
        }
      : await verifyTokenTransferSignature({
          signature: finalSignature,
          walletAddress: intent.wallet_address,
          expectedTokenAmount: intent.token_amount,
        });

    const { data: claimedIntent, error: claimError } = await supabase
      .from("payment_intents")
      .update({ status: isMockConfirmation ? "mock_paid" : "paid", signature: finalSignature, confirmed_at: new Date().toISOString() })
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
      signature: finalSignature,
      token_amount: intent.token_amount,
      action_type: intent.action_type,
      payment_intent_id: intent.id,
      token_mint: verified.tokenMint,
      recipient_wallet: verified.recipientWallet,
      status: isMockConfirmation ? "mock_confirmed" : "confirmed",
    });

    if (transactionError) throw transactionError;

    const { data: tokenPlayer, error: tokenPlayerError } = await supabase
      .from("players")
      .select("total_token_spent,season_token_spent")
      .eq("wallet_address", intent.wallet_address)
      .single<PlayerTokenRow>();

    if (tokenPlayerError) throw tokenPlayerError;

    const { error: tokenSpendError } = await supabase
      .from("players")
      .update({
        total_token_spent: Number(tokenPlayer.total_token_spent || 0) + Number(intent.token_amount),
        season_token_spent: Number(tokenPlayer.season_token_spent || 0) + Number(intent.token_amount),
      })
      .eq("wallet_address", intent.wallet_address);

    if (tokenSpendError) throw tokenSpendError;

    if (intent.action_type === "buy_race_cash" && pack) {
      const { data: player, error: playerError } = await supabase
        .from("players")
        .select("earned_race_cash,purchased_race_cash")
        .eq("wallet_address", intent.wallet_address)
        .single<{ earned_race_cash: number | string; purchased_race_cash: number | string }>();

      if (playerError) throw playerError;

      const earnedRaceCash = Number(player.earned_race_cash || 0);
      const purchasedRaceCash = Number(player.purchased_race_cash || 0) + pack.raceCashAmount;

      const { error: playerUpdateError } = await supabase
        .from("players")
        .update({ purchased_race_cash: purchasedRaceCash })
        .eq("wallet_address", intent.wallet_address);

      if (playerUpdateError) throw playerUpdateError;

      const { error: ledgerError } = await supabase.from("race_cash_ledger").insert({
        wallet_address: intent.wallet_address,
        amount: pack.raceCashAmount,
        source: isMockConfirmation ? "mock_token_purchase" : "token_purchase",
        cash_type: "purchased",
        reason: `${isMockConfirmation ? "Mock bought" : "Bought"} ${pack.name}`,
      });

      if (ledgerError) throw ledgerError;

      return NextResponse.json({
        status: isMockConfirmation ? "mock_confirmed" : "confirmed",
        purchasedRaceCashAdded: pack.raceCashAmount,
        tokenSpent: Number(intent.token_amount),
        earnedRaceCash,
        purchasedRaceCash,
        signature: finalSignature,
      });
    }

    if (intent.action_type === "buy_car" && car) {
      const purchase = await purchaseCarWithRaceCash({
        supabase,
        walletAddress: intent.wallet_address,
        car,
        requireTokenPaid: true,
      });

      return NextResponse.json({
        status: isMockConfirmation ? "mock_confirmed" : "confirmed",
        carId: car.id,
        carName: car.name,
        tokenSpent: Number(intent.token_amount),
        raceCashSpent: purchase.raceCashSpent,
        signature: finalSignature,
        player: purchase.player,
        ownedCars: purchase.ownedCars,
        selectedCar: purchase.selectedCar,
      });
    }

    return NextResponse.json({ error: "Unsupported payment action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Confirm payment failed";
    const status = message === "Car already owned" ? 409 : message === "Insufficient Race Cash" ? 402 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
