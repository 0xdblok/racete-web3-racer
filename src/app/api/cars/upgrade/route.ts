import { NextRequest, NextResponse } from "next/server";
import { applyCarUpgrade } from "@/lib/car-upgrades";
import { isValidSolanaAddress } from "@/lib/solana-payments";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const walletAddress = String(body.walletAddress || "");
    const playerCarId = String(body.playerCarId || "");
    const upgradeType = String(body.upgradeType || "");

    if (!isValidSolanaAddress(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }
    if (!playerCarId) return NextResponse.json({ error: "Missing player car id" }, { status: 400 });

    const result = await applyCarUpgrade({
      supabase: getSupabaseAdmin(),
      walletAddress,
      playerCarId,
      upgradeType,
      requireTokenPaid: false,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upgrade failed";
    const status =
      message === "Invalid upgrade type" || message === "Missing player car id"
        ? 400
        : message === "Owned car not found"
          ? 404
          : message === "Insufficient Race Cash"
            ? 402
            : message === "Token payment required for this upgrade"
              ? 402
              : message === "Upgrade already at max level"
                ? 409
                : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
