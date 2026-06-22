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
    return tokenRoomDryRunUnavailableResponse("start-dry-run");
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

    const enoughPlayers = room.playerCount >= room.minPlayers;
    const readyForDryRun = room.dryRunStatus === "full" || room.dryRunStatus === "in_lobby";
    if (!enoughPlayers || !readyForDryRun) {
      return NextResponse.json(
        {
          ...tokenRoomBasePayload(),
          error: "Dry-run token room is not ready to start",
          room,
        },
        { status: 409 },
      );
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    const mockRaceId = `dryrace_${room.roomId}_${Date.now()}`;

    const { error: roomError } = await supabase
      .from("token_rooms")
      .update({ status: "racing", race_id: mockRaceId, updated_at: now, started_at: now })
      .eq("room_id", room.roomId)
      .in("status", ["created", "depositing", "racing"]);

    if (roomError) throw roomError;

    const { error: playerError } = await supabase
      .from("token_room_players")
      .update({ status: "racing", race_id: mockRaceId, updated_at: now })
      .eq("room_id", room.roomId);

    if (playerError) throw playerError;

    await writeTokenRoomEvent({
      roomId: room.roomId,
      walletAddress,
      eventType: "dry_run_start_race",
      payload: {
        mockRaceId,
        noDepositRequested: true,
        noTokenTransfer: true,
        noPayout: true,
        note: "Dry-run token room race. Results are for testing only. No RACETE payout.",
      },
    });

    const updatedRoom = await fetchDryRunRoom(room.roomId);

    return NextResponse.json({
      ...tokenRoomBasePayload(),
      room: updatedRoom,
      mockRaceId,
      nextUrl: `/race/multiplayer?tokenRoomId=${encodeURIComponent(room.roomId)}&dryRunRaceId=${encodeURIComponent(mockRaceId)}`,
      dryRunNotice: "Dry-run token room race started. Results are for testing only. No RACETE payout.",
    });
  } catch (error) {
    if (isMissingTokenRoomTableError(error)) {
      return NextResponse.json({
        ...tokenRoomBasePayload(),
        error: "Token room tables are not available yet.",
        message: "Apply the Phase A migration before using DB-backed dry-run rooms.",
      });
    }

    console.error("[token-rooms/start-dry-run] failed", error);
    return NextResponse.json(
      {
        ...tokenRoomBasePayload(),
        error: "Failed to start dry-run token room race",
      },
      { status: 500 },
    );
  }
}
