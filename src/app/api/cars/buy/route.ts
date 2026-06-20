import { NextRequest, NextResponse } from "next/server";
import { getCarPrice, purchaseCarWithRaceCash } from "@/lib/car-purchases";
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
    const car = await getCarPrice(supabase, carId);
    if (!car) return NextResponse.json({ error: "Unknown car" }, { status: 404 });
    if (car.isStarter || car.priceRaceCash <= 0) {
      return NextResponse.json({ error: "This car is not purchasable" }, { status: 400 });
    }
    if (car.priceToken > 0) {
      return NextResponse.json({ error: "Token payment intent required for this car" }, { status: 402 });
    }

    const result = await purchaseCarWithRaceCash({ supabase, walletAddress, car, requireTokenPaid: false });
    return NextResponse.json({ ...result, carId: car.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Car purchase failed";
    const status = message === "Car already owned" ? 409 : message === "Insufficient Race Cash" ? 402 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
