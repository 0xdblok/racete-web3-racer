import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { TOKEN_STAKE_ROOMS_TEST_MODE, getActiveTokenMint, toTokenBaseUnits } from "@/config/token-rooms";
import {
  DRY_RUN_ROOM_STATUSES,
  ensureDryRunPlayer,
  fetchDryRunRooms,
  isMissingTokenRoomTableError,
  tokenRoomBasePayload,
  tokenRoomDryRunUnavailableResponse,
  validateWalletAddress,
} from "../_shared";

export async function POST(request: NextRequest) {
  if (!TOKEN_STAKE_ROOMS_TEST_MODE) return tokenRoomDryRunUnavailableResponse("join-intent");

  try {
    const body = await request.json();
    const walletAddress = validateWalletAddress(body.walletAddress);
    const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";

    if (!walletAddress) {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "Invalid wallet address" }, { status: 400 });
    }
    if (!roomId) {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "Missing roomId" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { data: room, error: roomError } = await supabase
      .from("token_rooms")
      .select("room_id, token_mint, stake_amount, stake_preset, max_players, status, expires_at")
      .eq("room_id", roomId)
      .maybeSingle();

    if (roomError) throw roomError;
    if (!room) {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "Token room not found" }, { status: 404 });
    }
    if (!DRY_RUN_ROOM_STATUSES.includes(room.status as (typeof DRY_RUN_ROOM_STATUSES)[number])) {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "Token room is not open for dry-run joins" }, { status: 409 });
    }
    if (room.token_mint !== getActiveTokenMint()) {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "Token room mint does not match active test mint" }, { status: 409 });
    }
    if (new Date(room.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "Token room has expired" }, { status: 410 });
    }

    const { data: players, error: playersError } = await supabase
      .from("token_room_players")
      .select("wallet_address")
      .eq("room_id", roomId);

    if (playersError) throw playersError;

    const existingPlayers = players || [];
    if (existingPlayers.some((player) => player.wallet_address === walletAddress)) {
      const [existingRoom] = await fetchDryRunRooms(roomId);
      return NextResponse.json(
        {
          ...tokenRoomBasePayload(),
          action: "join-intent",
          room: existingRoom,
          dryRunNotice: "Wallet is already in this dry-run room. No RACETE deposit was requested or transferred.",
        },
        { status: 200 },
      );
    }

    if (existingPlayers.length >= Number(room.max_players)) {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "Token room is full" }, { status: 409 });
    }

    await ensureDryRunPlayer(walletAddress);

    const { error: insertError } = await supabase.from("token_room_players").insert({
      room_id: roomId,
      wallet_address: walletAddress,
      is_creator: false,
      status: "ready",
      deposit_status: "intent_created",
      stake_amount: room.stake_amount || toTokenBaseUnits(Number(room.stake_preset)),
      token_mint: getActiveTokenMint(),
      eligible_for_payout: false,
      joined_at: now,
      ready_at: now,
      created_at: now,
      updated_at: now,
    });

    if (insertError) throw insertError;

    const newPlayerCount = existingPlayers.length + 1;
    const { error: updateError } = await supabase
      .from("token_rooms")
      .update({ confirmed_player_count: newPlayerCount, updated_at: now })
      .eq("room_id", roomId);

    if (updateError) throw updateError;

    const [updatedRoom] = await fetchDryRunRooms(roomId);

    return NextResponse.json({
      ...tokenRoomBasePayload(),
      action: "join-intent",
      room: updatedRoom,
      dryRunNotice: "Joined dry-run room. No RACETE deposit was requested or transferred.",
    });
  } catch (error) {
    if (isMissingTokenRoomTableError(error)) {
      return NextResponse.json(
        {
          ...tokenRoomBasePayload(),
          error: "Token room tables are not available yet.",
          message: "Phase C.1 dry-run joining requires the Phase A token_rooms migration to be applied manually.",
        },
        { status: 503 },
      );
    }

    const message = error instanceof Error ? error.message : "Token room dry-run join failed";
    return NextResponse.json({ ...tokenRoomBasePayload(), error: "Token room dry-run join failed", message }, { status: 500 });
  }
}
