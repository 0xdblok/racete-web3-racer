import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getActiveTokenMint, TOKEN_STAKE_ROOMS_TEST_MODE } from "@/config/token-rooms";
import {
  fetchDryRunRoom,
  isMissingTokenRoomTableError,
  isWalletInRoom,
  tokenRoomBasePayload,
  tokenRoomDryRunUnavailableResponse,
  validateWalletAddress,
  writeTokenRoomEvent,
} from "../../_shared";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  if (!TOKEN_STAKE_ROOMS_TEST_MODE) {
    return tokenRoomDryRunUnavailableResponse("enter-lobby");
  }

  try {
    const body = await request.json().catch(() => ({}));
    const walletAddress = validateWalletAddress(body.walletAddress);

    if (!walletAddress) {
      return NextResponse.json(
        {
          ...tokenRoomBasePayload(),
          error: "Invalid wallet address",
        },
        { status: 400 },
      );
    }

    const room = await fetchDryRunRoom(id);
    if (!room) {
      return NextResponse.json(
        {
          ...tokenRoomBasePayload(),
          error: "Dry-run token room not found",
        },
        { status: 404 },
      );
    }

    if (room.tokenMint !== getActiveTokenMint()) {
      return NextResponse.json(
        {
          ...tokenRoomBasePayload(),
          error: "Token room mint mismatch",
        },
        { status: 400 },
      );
    }

    if (!isWalletInRoom(room, walletAddress)) {
      return NextResponse.json(
        {
          ...tokenRoomBasePayload(),
          error: "Wallet is not part of this dry-run token room",
        },
        { status: 403 },
      );
    }

    if (room.dryRunStatus === "closed" || room.dryRunStatus === "racing_mock") {
      return NextResponse.json(
        {
          ...tokenRoomBasePayload(),
          error: "Dry-run lobby is not enterable in the current room state",
          room,
        },
        { status: 409 },
      );
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { error: playerError } = await supabase
      .from("token_room_players")
      .update({ status: "ready", updated_at: now })
      .eq("room_id", room.roomId)
      .eq("wallet_address", walletAddress);

    if (playerError) throw playerError;

    const { error: roomError } = await supabase
      .from("token_rooms")
      .update({ status: "depositing", updated_at: now, locked_at: now })
      .eq("room_id", room.roomId)
      .in("status", ["created", "depositing"]);

    if (roomError) throw roomError;

    await writeTokenRoomEvent({
      roomId: room.roomId,
      walletAddress,
      eventType: "dry_run_enter_lobby",
      payload: {
        noDepositRequested: true,
        noTokenTransfer: true,
        noPayout: true,
      },
    });

    const updatedRoom = await fetchDryRunRoom(room.roomId);

    return NextResponse.json({
      ...tokenRoomBasePayload(),
      room: updatedRoom,
      dryRunNotice: "Entered dry-run token room lobby. No RACETE deposit, transfer, or payout will happen.",
    });
  } catch (error) {
    if (isMissingTokenRoomTableError(error)) {
      return NextResponse.json({
        ...tokenRoomBasePayload(),
        error: "Token room tables are not available yet.",
        message: "Apply the Phase A migration before using DB-backed dry-run rooms.",
      });
    }

    console.error("[token-rooms/enter-lobby] failed", error);
    return NextResponse.json(
      {
        ...tokenRoomBasePayload(),
        error: "Failed to enter dry-run lobby",
      },
      { status: 500 },
    );
  }
}
