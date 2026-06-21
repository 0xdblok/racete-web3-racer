import { NextResponse } from "next/server";
import {
  TOKEN_ROOM_DISABLED_MESSAGE,
  TOKEN_STAKE_ROOMS_ENABLED,
  TOKEN_STAKE_ROOMS_TEST_MODE,
  getTokenRoomMode,
} from "@/config/token-rooms";

export function tokenRoomDisabledResponse(action: string, status = 403) {
  return NextResponse.json(
    {
      enabled: TOKEN_STAKE_ROOMS_ENABLED,
      testMode: TOKEN_STAKE_ROOMS_TEST_MODE,
      mode: getTokenRoomMode(),
      action,
      error: TOKEN_ROOM_DISABLED_MESSAGE,
      message: "Token Stake Rooms are disabled in V1 test mode. No deposits, transfers, payouts, or room actions are enabled.",
    },
    { status },
  );
}
