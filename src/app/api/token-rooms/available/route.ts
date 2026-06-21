import { NextResponse } from "next/server";
import {
  RACETE_TEST_TOKEN_MINT,
  RACETE_TOKEN_MINT,
  TOKEN_ROOM_DISABLED_MESSAGE,
  TOKEN_ROOM_FEE_BPS,
  TOKEN_STAKE_PRESET_CONFIGS,
  TOKEN_STAKE_ROOMS_ENABLED,
  TOKEN_STAKE_ROOMS_TEST_MODE,
  TOKEN_TREASURY_WALLET,
  TOKEN_WEEKLY_REWARD_WALLET,
  getTokenRoomMode,
} from "@/config/token-rooms";

export async function GET() {
  return NextResponse.json({
    enabled: TOKEN_STAKE_ROOMS_ENABLED,
    testMode: TOKEN_STAKE_ROOMS_TEST_MODE,
    mode: getTokenRoomMode(),
    message: TOKEN_ROOM_DISABLED_MESSAGE,
    rooms: [],
    config: {
      testTokenMint: RACETE_TEST_TOKEN_MINT,
      productionTokenMint: RACETE_TOKEN_MINT,
      treasuryWallet: TOKEN_TREASURY_WALLET,
      weeklyRewardWallet: TOKEN_WEEKLY_REWARD_WALLET,
      stakePresets: TOKEN_STAKE_PRESET_CONFIGS,
      feeBps: TOKEN_ROOM_FEE_BPS,
    },
  });
}
