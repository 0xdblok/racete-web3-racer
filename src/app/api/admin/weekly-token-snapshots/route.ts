import { NextResponse } from "next/server";
import {
  RACETE_TEST_TOKEN_MINT,
  RACETE_TOKEN_MINT,
  TOKEN_ROOM_DISABLED_MESSAGE,
  TOKEN_STAKE_ROOMS_ENABLED,
  TOKEN_STAKE_ROOMS_TEST_MODE,
  TOKEN_WEEKLY_REWARD_WALLET,
  getTokenRoomMode,
} from "@/config/token-rooms";

export async function GET() {
  return NextResponse.json({
    enabled: TOKEN_STAKE_ROOMS_ENABLED,
    testMode: TOKEN_STAKE_ROOMS_TEST_MODE,
    mode: getTokenRoomMode(),
    implemented: false,
    error: "Admin weekly token snapshot API is not implemented in Phase A.",
    message: TOKEN_ROOM_DISABLED_MESSAGE,
    snapshots: [],
    config: {
      testTokenMint: RACETE_TEST_TOKEN_MINT,
      productionTokenMint: RACETE_TOKEN_MINT,
      weeklyRewardWallet: TOKEN_WEEKLY_REWARD_WALLET,
    },
  });
}
