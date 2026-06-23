import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  TOKEN_ROOM_DECIMALS,
  TOKEN_ROOM_FEE_BPS,
  TOKEN_ROOM_MIN_PLAYERS,
  TOKEN_STAKE_ROOMS_TEST_MODE,
  getActiveTokenMint,
  toTokenBaseUnits,
} from "@/config/token-rooms";
import {
  createRoomId,
  ensureDryRunPlayer,
  fetchDryRunRooms,
  getRoomExpiresAt,
  isMissingTokenRoomTableError,
  stakePresetKey,
  tokenRoomBasePayload,
  tokenRoomDryRunUnavailableResponse,
  validateMaxPlayers,
  validateStakeAmount,
  validateWalletAddress,
} from "../_shared";

export async function POST(request: NextRequest) {
  if (!TOKEN_STAKE_ROOMS_TEST_MODE) return tokenRoomDryRunUnavailableResponse("create");

  try {
    const body = await request.json();
    const walletAddress = validateWalletAddress(body.walletAddress);
    const stakeAmount = validateStakeAmount(body.stakeAmount);
    const maxPlayers = validateMaxPlayers(body.maxPlayers ?? 6);

    if (!walletAddress) {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "Invalid wallet address" }, { status: 400 });
    }
    if (!stakeAmount) {
      return NextResponse.json(
        { ...tokenRoomBasePayload(), error: "Invalid stake amount", allowedStakeAmounts: [1000, 5000, 10000, 25000] },
        { status: 400 },
      );
    }
    if (!maxPlayers) {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "maxPlayers must be between 2 and 6" }, { status: 400 });
    }

    await ensureDryRunPlayer(walletAddress);

    const supabase = getSupabaseAdmin();
    const roomId = createRoomId();
    const now = new Date().toISOString();
    const stakeBaseUnits = toTokenBaseUnits(stakeAmount);

    const { error: roomError } = await supabase.from("token_rooms").insert({
      room_id: roomId,
      token_mint: getActiveTokenMint(),
      stake_amount: stakeBaseUnits,
      stake_decimals: TOKEN_ROOM_DECIMALS,
      stake_preset: stakePresetKey(stakeAmount),
      creator_wallet_address: walletAddress,
      min_players: TOKEN_ROOM_MIN_PLAYERS,
      max_players: maxPlayers,
      confirmed_player_count: 0,
      status: "created",
      vault_authority_type: "manual",
      creator_fee_bps: TOKEN_ROOM_FEE_BPS.creatorFeeBps,
      weekly_reward_bps: TOKEN_ROOM_FEE_BPS.weeklyRewardBps,
      treasury_fee_bps: TOKEN_ROOM_FEE_BPS.treasuryFeeBps,
      player_payout_bps: TOKEN_ROOM_FEE_BPS.playerPayoutBps,
      anti_cheat_summary: { phase: "C.1", dryRun: true },
      created_at: now,
      updated_at: now,
      expires_at: getRoomExpiresAt(),
    });

    if (roomError) throw roomError;

    const { error: playerError } = await supabase.from("token_room_players").insert({
      room_id: roomId,
      wallet_address: walletAddress,
      is_creator: true,
      status: "ready",
      deposit_status: "intent_created",
      stake_amount: stakeBaseUnits,
      token_mint: getActiveTokenMint(),
      eligible_for_payout: false,
      joined_at: now,
      ready_at: now,
      created_at: now,
      updated_at: now,
    });

    if (playerError) throw playerError;

    const [room] = await fetchDryRunRooms(roomId);

    return NextResponse.json({
      ...tokenRoomBasePayload(),
      action: "create",
      room,
      dryRunNotice: "Token room created. Deposit RACETE from the room lobby. Automatic payouts execute only after verified valid results.",
    });
  } catch (error) {
    if (isMissingTokenRoomTableError(error)) {
      return NextResponse.json(
        {
          ...tokenRoomBasePayload(),
          error: "Token room tables are not available yet.",
          message: "Phase C.1 dry-run creation requires the Phase A token_rooms migration to be applied manually.",
        },
        { status: 503 },
      );
    }

    const message = error instanceof Error ? error.message : "Token room dry-run creation failed";
    return NextResponse.json({ ...tokenRoomBasePayload(), error: "Token room dry-run creation failed", message }, { status: 500 });
  }
}
