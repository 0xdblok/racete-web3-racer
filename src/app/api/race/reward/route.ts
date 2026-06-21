import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TRACKS } from "@/config/tracks";
import { calculateSoloRaceReward, SOLO_RACE_REWARD_CONFIG, type RaceRewardBreakdown } from "@/config/rewards";
import { getPlayerState } from "@/lib/player-state";
import { isValidSolanaAddress } from "@/lib/solana-payments";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type RaceRewardPayload = {
  walletAddress?: string;
  raceMode?: "solo" | "multiplayer";
  carId?: string;
  trackId?: string;
  totalTimeMs?: number;
  bestLapMs?: number;
  lapsCompleted?: number;
  checkpointsCompleted?: number;
  placement?: number;
  clientRaceId?: string;
  raceSessionId?: string;
};

type PlayerBalanceRow = {
  earned_race_cash: number | string;
};

type RaceRewardInsert = {
  wallet_address: string;
  race_mode: "solo" | "multiplayer";
  track_id: string;
  car_id: string;
  client_race_id: string;
  total_time_ms: number;
  best_lap_ms: number;
  laps_completed: number;
  checkpoints_completed: number;
  placement: number | null;
  reward_amount: number;
  reward_breakdown: Record<string, unknown> | RaceRewardBreakdown;
  status: "paid" | "rejected";
  rejection_reason?: string;
};

function toPositiveInt(value: unknown): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.max(0, Math.floor(numberValue));
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isMissingRaceRewardsTable(error: unknown): boolean {
  const maybe = error as { code?: string; message?: string } | null;
  return maybe?.code === "PGRST205" || Boolean(maybe?.message?.includes("race_rewards"));
}

async function tryInsertRaceReward(supabase: SupabaseClient, row: RaceRewardInsert) {
  const { data, error } = await supabase.from("race_rewards").insert(row).select("*").single();
  if (error) {
    if (isMissingRaceRewardsTable(error)) return null;
    throw error;
  }
  return data;
}

async function tryFindRaceReward(supabase: SupabaseClient, walletAddress: string, clientRaceId: string) {
  const { data, error } = await supabase
    .from("race_rewards")
    .select("id,status,reward_amount,reward_breakdown")
    .eq("wallet_address", walletAddress)
    .eq("client_race_id", clientRaceId)
    .maybeSingle();

  if (error) {
    if (isMissingRaceRewardsTable(error)) return null;
    throw error;
  }
  return data;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RaceRewardPayload;
    const walletAddress = String(body.walletAddress || "");
    const raceMode = body.raceMode || "solo";
    const carId = String(body.carId || "");
    const trackId = String(body.trackId || "");
    const clientRaceId = String(body.clientRaceId || body.raceSessionId || "");
    const totalTimeMs = toPositiveInt(body.totalTimeMs);
    const bestLapMs = toPositiveInt(body.bestLapMs);
    const lapsCompleted = toPositiveInt(body.lapsCompleted);
    const checkpointsCompleted = toPositiveInt(body.checkpointsCompleted);
    const placement = body.placement ? toPositiveInt(body.placement) : null;

    if (!isValidSolanaAddress(walletAddress)) return jsonError("Invalid wallet address", 400);
    if (!clientRaceId || clientRaceId.length > 120) return jsonError("Missing race session id", 400);
    if (!carId) return jsonError("Missing car id", 400);

    const track = TRACKS.find((item) => item.id === trackId);
    if (!track) return jsonError("Unknown track", 404);

    const supabase = getSupabaseAdmin();
    const rewardSource = `race_reward:${clientRaceId}`;

    const { data: existingLedger, error: existingLedgerError } = await supabase
      .from("race_cash_ledger")
      .select("id,amount")
      .eq("wallet_address", walletAddress)
      .eq("source", rewardSource)
      .maybeSingle();
    if (existingLedgerError) throw existingLedgerError;
    if (existingLedger) {
      return NextResponse.json({ error: "Race reward already claimed", reward: existingLedger }, { status: 409 });
    }

    const existingReward = await tryFindRaceReward(supabase, walletAddress, clientRaceId);
    if (existingReward) {
      return NextResponse.json({ error: "Race reward already claimed", reward: existingReward }, { status: 409 });
    }

    const baseRewardRow = {
      wallet_address: walletAddress,
      race_mode: raceMode,
      track_id: trackId,
      car_id: carId,
      client_race_id: clientRaceId,
      total_time_ms: totalTimeMs,
      best_lap_ms: bestLapMs,
      laps_completed: lapsCompleted,
      checkpoints_completed: checkpointsCompleted,
      placement,
    } satisfies Omit<RaceRewardInsert, "reward_amount" | "reward_breakdown" | "status" | "rejection_reason">;

    if (raceMode !== "solo") {
      await tryInsertRaceReward(supabase, {
        ...baseRewardRow,
        reward_amount: 0,
        reward_breakdown: { reason: "multiplayer_requires_server_authority" },
        status: "rejected",
        rejection_reason: "Multiplayer rewards require server-authoritative results",
      });
      return jsonError("Multiplayer rewards require server-authoritative results", 403);
    }

    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("earned_race_cash")
      .eq("wallet_address", walletAddress)
      .single<PlayerBalanceRow>();
    if (playerError) throw playerError;

    const { data: ownedCar, error: ownedCarError } = await supabase
      .from("player_cars")
      .select("id")
      .eq("wallet_address", walletAddress)
      .eq("car_id", carId)
      .maybeSingle();
    if (ownedCarError) throw ownedCarError;
    if (!ownedCar) return jsonError("Selected car does not belong to wallet", 403);

    const requiredCheckpoints = track.lapCount * track.checkpoints.length;
    const validationErrors: string[] = [];
    if (lapsCompleted < track.lapCount) validationErrors.push("Race not completed");
    if (checkpointsCompleted < requiredCheckpoints) validationErrors.push("Missing checkpoints");
    if (totalTimeMs < SOLO_RACE_REWARD_CONFIG.minFinishTimeMs) validationErrors.push("Finish time is impossible");
    if (totalTimeMs > SOLO_RACE_REWARD_CONFIG.maxFinishTimeMs) validationErrors.push("Finish time is too old");
    if (bestLapMs <= 0 || bestLapMs > totalTimeMs) validationErrors.push("Invalid best lap time");

    if (validationErrors.length) {
      await tryInsertRaceReward(supabase, {
        ...baseRewardRow,
        reward_amount: 0,
        reward_breakdown: { validationErrors },
        status: "rejected",
        rejection_reason: validationErrors.join(", "),
      });
      return NextResponse.json({ error: validationErrors.join(", ") }, { status: 400 });
    }

    const breakdown: RaceRewardBreakdown = calculateSoloRaceReward({
      completed: true,
      totalTimeMs,
      bestLapMs,
      cleanRace: true,
    });
    const rewardAmount = breakdown.total;

    const rewardRow = await tryInsertRaceReward(supabase, {
      ...baseRewardRow,
      placement: 1,
      reward_amount: rewardAmount,
      reward_breakdown: breakdown,
      status: "paid",
    });

    const currentEarned = Number(player.earned_race_cash || 0);
    const { error: balanceError } = await supabase
      .from("players")
      .update({ earned_race_cash: currentEarned + rewardAmount })
      .eq("wallet_address", walletAddress);
    if (balanceError) throw balanceError;

    const ledgerReason = JSON.stringify({
      kind: "solo_race_reward",
      trackId,
      trackName: track.name,
      carId,
      clientRaceId,
      totalTimeMs,
      bestLapMs,
      lapsCompleted,
      checkpointsCompleted,
      placement: 1,
      breakdown,
    });

    const { error: ledgerError } = await supabase.from("race_cash_ledger").insert({
      wallet_address: walletAddress,
      amount: rewardAmount,
      source: rewardSource,
      cash_type: "earned",
      reason: ledgerReason,
    });
    if (ledgerError) throw ledgerError;

    let recentRewards: Array<Record<string, unknown>> = [];
    const { data: recentRewardRows, error: recentRewardsError } = await supabase
      .from("race_rewards")
      .select("id,track_id,car_id,total_time_ms,best_lap_ms,laps_completed,reward_amount,created_at")
      .eq("wallet_address", walletAddress)
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(5);
    if (!recentRewardsError) recentRewards = recentRewardRows || [];

    return NextResponse.json({
      reward: rewardRow,
      rewardAmount,
      rewardBreakdown: breakdown,
      playerState: await getPlayerState(supabase, walletAddress, { autoSelectFallback: false }),
      recentRewards,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Race reward claim failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
