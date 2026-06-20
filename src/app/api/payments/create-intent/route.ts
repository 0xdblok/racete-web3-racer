import { NextRequest, NextResponse } from "next/server";
import { getRaceCashPack } from "@/config/economy";
import { getCarPrice } from "@/lib/car-purchases";
import { getUpgradeQuote } from "@/lib/car-upgrades";
import { serverEnv } from "@/lib/server-env";
import { isValidSolanaAddress } from "@/lib/solana-payments";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const INTENT_TTL_MINUTES = 15;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const walletAddress = String(body.walletAddress || "");
    const actionType = String(body.actionType || "");
    const itemId = String(body.itemId || body.carId || body.playerCarId || "");
    const carId = typeof body.carId === "string" ? body.carId : actionType === "buy_car" ? itemId : null;
    const playerCarId = typeof body.playerCarId === "string" ? body.playerCarId : actionType === "upgrade_car" ? itemId : null;
    const upgradeType = typeof body.upgradeType === "string" ? body.upgradeType : "";

    if (!isValidSolanaAddress(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    if (!serverEnv.mockTokenMode && (!serverEnv.tokenMint || !serverEnv.treasuryWallet)) {
      return NextResponse.json({ error: "Token payments are not configured" }, { status: 503 });
    }

    if (!["buy_race_cash", "buy_car", "upgrade_car"].includes(actionType)) {
      return NextResponse.json({ error: "Unsupported payment action" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("wallet_address,earned_race_cash,purchased_race_cash")
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    if (playerError) throw playerError;
    if (!player) return NextResponse.json({ error: "Player profile not found" }, { status: 404 });

    let intentItemId = itemId;
    let tokenAmount = 0;
    let raceCashAmount = 0;
    let displayName = "";

    if (actionType === "buy_race_cash") {
      const pack = getRaceCashPack(itemId);
      if (!pack) return NextResponse.json({ error: "Unknown Race Cash pack" }, { status: 404 });
      intentItemId = pack.id;
      tokenAmount = pack.tokenAmount;
      raceCashAmount = pack.raceCashAmount;
      displayName = pack.name;
    }

    if (actionType === "buy_car") {
      if (!carId) return NextResponse.json({ error: "Missing car id" }, { status: 400 });
      const car = await getCarPrice(supabase, carId);
      if (!car) return NextResponse.json({ error: "Unknown car" }, { status: 404 });
      if (car.priceToken <= 0) return NextResponse.json({ error: "This car does not require token payment" }, { status: 400 });

      const { data: existingCar, error: existingError } = await supabase
        .from("player_cars")
        .select("id")
        .eq("wallet_address", walletAddress)
        .eq("car_id", car.id)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existingCar) return NextResponse.json({ error: "Car already owned" }, { status: 409 });

      const raceCashBalance = Number(player.purchased_race_cash || 0) + Number(player.earned_race_cash || 0);
      if (raceCashBalance < car.priceRaceCash) {
        return NextResponse.json({ error: "Insufficient Race Cash" }, { status: 402 });
      }

      intentItemId = car.id;
      tokenAmount = car.priceToken;
      raceCashAmount = car.priceRaceCash;
      displayName = car.name;
    }

    if (actionType === "upgrade_car") {
      if (!playerCarId) return NextResponse.json({ error: "Missing player car id" }, { status: 400 });
      const quoteResult = await getUpgradeQuote({ supabase, walletAddress, playerCarId, upgradeType });
      if (!quoteResult) return NextResponse.json({ error: "Owned car not found" }, { status: 404 });
      const { quote } = quoteResult;
      if (quote.token <= 0) return NextResponse.json({ error: "This upgrade does not require token payment" }, { status: 400 });

      const raceCashBalance = Number(player.purchased_race_cash || 0) + Number(player.earned_race_cash || 0);
      if (raceCashBalance < quote.raceCash) {
        return NextResponse.json({ error: "Insufficient Race Cash" }, { status: 402 });
      }

      intentItemId = playerCarId;
      tokenAmount = quote.token;
      raceCashAmount = quote.raceCash;
      displayName = `${quote.upgradeType} level ${quote.nextLevel}`;
    }

    const expiresAt = new Date(Date.now() + INTENT_TTL_MINUTES * 60_000).toISOString();
    const { data: intent, error: intentError } = await supabase
      .from("payment_intents")
      .insert({
        wallet_address: walletAddress,
        action_type: actionType,
        item_id: intentItemId,
        car_id: carId,
        upgrade_type: actionType === "upgrade_car" ? upgradeType : null,
        token_amount: tokenAmount,
        token_mint: serverEnv.tokenMint,
        treasury_wallet: serverEnv.treasuryWallet,
        status: "pending",
        expires_at: expiresAt,
      })
      .select("id,wallet_address,action_type,item_id,car_id,upgrade_type,token_amount,token_mint,treasury_wallet,status,expires_at")
      .single();

    if (intentError) throw intentError;

    return NextResponse.json({
      paymentIntentId: intent.id,
      actionType: intent.action_type,
      itemId: intent.item_id,
      carId: intent.car_id,
      upgradeType: intent.upgrade_type,
      tokenAmount: Number(intent.token_amount),
      tokenMint: intent.token_mint,
      treasuryWallet: intent.treasury_wallet,
      expiresAt: intent.expires_at,
      raceCashAmount,
      packName: displayName,
      carName: actionType === "buy_car" ? displayName : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Create payment intent failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
