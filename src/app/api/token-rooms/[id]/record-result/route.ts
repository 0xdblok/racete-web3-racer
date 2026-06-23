import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  fetchDryRunRoom,
  isMissingTokenRoomTableError,
  tokenRoomBasePayload,
  validateWalletAddress,
  writeTokenRoomEvent,
} from "../../_shared";
import { buildSettlementPreview, markManualReview, type TokenRoomRaceResultInput } from "../../_settlement";

type RouteContext = { params: Promise<{ id: string }> };

const FINISH_STATUS_MAP = {
  finished: "finished",
  dnf: "dnf",
  dq: "disqualified",
  disconnected: "disconnected",
} as const;

function normalizeResults(value: unknown): TokenRoomRaceResultInput[] {
  if (!Array.isArray(value)) throw new Error("results array is required");
  return value.map((result) => {
    const row = result as Record<string, unknown>;
    const walletAddress = validateWalletAddress(row.walletAddress);
    if (!walletAddress) throw new Error("Every result requires a valid walletAddress");
    const finishStatus = row.finishStatus;
    if (finishStatus !== "finished" && finishStatus !== "dnf" && finishStatus !== "dq" && finishStatus !== "disconnected") {
      throw new Error("finishStatus must be finished, dnf, dq, or disconnected");
    }
    const placement = row.placement === undefined || row.placement === null ? undefined : Number(row.placement);
    if (placement !== undefined && (!Number.isInteger(placement) || placement < 1 || placement > 6)) {
      throw new Error("placement must be between 1 and 6");
    }
    const finishTimeMs = row.finishTimeMs === undefined || row.finishTimeMs === null ? undefined : Number(row.finishTimeMs);
    const laps = row.laps === undefined || row.laps === null ? undefined : Number(row.laps);
    const checkpoints = row.checkpoints === undefined || row.checkpoints === null ? undefined : Number(row.checkpoints);
    return { walletAddress, finishStatus, placement, finishTimeMs, laps, checkpoints };
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  try {
    const body = await request.json().catch(() => ({}));
    const results = normalizeResults(body.results);
    const raceId = typeof body.multiplayerRaceId === "string" ? body.multiplayerRaceId : typeof body.dryRunRaceId === "string" ? body.dryRunRaceId : null;
    const uniqueWallets = new Set(results.map((result) => result.walletAddress));
    if (uniqueWallets.size !== results.length) {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "Duplicate wallet result" }, { status: 400 });
    }

    const room = await fetchDryRunRoom(id);
    if (!room) return NextResponse.json({ ...tokenRoomBasePayload(), error: "Token room not found" }, { status: 404 });
    if (["paid", "paid_out", "completed", "payout_pending", "finalizing"].includes(room.status)) {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "Token room results are already settled or paid", room }, { status: 409 });
    }
    if (!room.allDepositsConfirmed) {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "All deposits must be confirmed before recording results", room }, { status: 409 });
    }

    const memberWallets = new Set(room.players.map((player) => player.walletAddress));
    for (const result of results) {
      if (!memberWallets.has(result.walletAddress)) {
        return NextResponse.json({ ...tokenRoomBasePayload(), error: "Result wallet is not a room member", walletAddress: result.walletAddress }, { status: 400 });
      }
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    for (const result of results) {
      const status = FINISH_STATUS_MAP[result.finishStatus];
      const eligible = result.finishStatus === "finished";
      const { error } = await supabase
        .from("token_room_players")
        .update({
          status,
          final_race_status: status,
          placement: result.placement || null,
          payout_rank: eligible ? result.placement || null : null,
          finish_time_ms: result.finishTimeMs || null,
          laps_completed: result.laps || 0,
          checkpoints_completed: result.checkpoints || 0,
          eligible_for_payout: eligible,
          finished_at: eligible ? now : null,
          updated_at: now,
        })
        .eq("room_id", room.roomId)
        .eq("wallet_address", result.walletAddress);
      if (error) throw error;
    }

    const validFinishers = results.filter((result) => result.finishStatus === "finished");
    if (validFinishers.length === 0) {
      await markManualReview(room.roomId, "No valid finishers in recorded result; no automatic payout executed.");
      const updatedRoom = await fetchDryRunRoom(room.roomId);
      return NextResponse.json({
        ...tokenRoomBasePayload(),
        room: updatedRoom,
        settlementPreview: null,
        manualReview: true,
        reason: "No valid finishers. Room marked manual_review; no payout executed.",
      });
    }

    const { error: roomError } = await supabase
      .from("token_rooms")
      .update({ status: "results_recorded", race_id: raceId, results_recorded_at: now, updated_at: now })
      .eq("room_id", room.roomId)
      .in("status", ["locked", "racing", "results_recorded"]);
    if (roomError) throw roomError;

    await writeTokenRoomEvent({
      roomId: room.roomId,
      raceId,
      eventType: "token_room_results_recorded",
      payload: { results, automaticPayoutEligible: true },
    });

    const { preview } = await buildSettlementPreview(room.roomId);
    const updatedRoom = await fetchDryRunRoom(room.roomId);
    return NextResponse.json({ ...tokenRoomBasePayload(), room: updatedRoom, settlementPreview: preview });
  } catch (error) {
    if (isMissingTokenRoomTableError(error)) {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "Token room tables are not available yet." }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Failed to record token room result";
    console.error("[token-rooms/record-result] failed", message);
    return NextResponse.json({ ...tokenRoomBasePayload(), error: message }, { status: 400 });
  }
}
