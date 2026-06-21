import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TRACKS } from "@/config/tracks";
import {
  calculateSoloRaceReward,
  getTrackTarget,
  isRecognizedCarClass,
  SOLO_RACE_REWARD_CONFIG,
  type RaceRewardBreakdown,
  type PreviousRecords,
  type RaceRecordRow,
} from "@/config/rewards";
import { getPlayerState } from "@/lib/player-state";
import { isValidSolanaAddress } from "@/lib/solana-payments";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// ── Payload types ────────────────────────────────────────────────────────────

type RaceRewardPayload = {
  walletAddress?: string;
  raceMode?: "solo" | "multiplayer";
  carId?: string;
  trackId?: string;
  totalTimeMs?: number;
  bestLapMs?: number;
  firstLapMs?: number;
  lapsCompleted?: number;
  checkpointsCompleted?: number;
  placement?: number;
  clientRaceId?: string;
  raceSessionId?: string;
  wrongWayTriggered?: boolean;
  resetCount?: number;
  carClass?: string;
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

type RaceRecordUpsert = {
  wallet_address: string;
  track_id: string;
  car_class: string;
  best_total_time_ms: number;
  best_first_lap_ms: number;
  best_lap_ms: number;
  total_races_finished: number;
  total_race_cash_earned: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function toPositiveInt(value: unknown): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.max(0, Math.floor(numberValue));
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function isTableNotFound(error: unknown): boolean {
  const maybe = error as { code?: string; message?: string } | null;
  return (
    maybe?.code === "PGRST205" ||
    Boolean(
      maybe?.message?.includes("relation") &&
        maybe?.message?.includes("does not exist"),
    )
  );
}

async function tryInsertRaceReward(
  supabase: SupabaseClient,
  row: RaceRewardInsert,
) {
  const { data, error } = await supabase
    .from("race_rewards")
    .insert(row)
    .select("*")
    .single();
  if (error) {
    if (isTableNotFound(error)) return null;
    throw error;
  }
  return data;
}

async function tryFindRaceReward(
  supabase: SupabaseClient,
  walletAddress: string,
  clientRaceId: string,
) {
  const { data, error } = await supabase
    .from("race_rewards")
    .select("id,status,reward_amount,reward_breakdown")
    .eq("wallet_address", walletAddress)
    .eq("client_race_id", clientRaceId)
    .maybeSingle();

  if (error) {
    if (isTableNotFound(error)) return null;
    throw error;
  }
  return data;
}

/**
 * Fetch the single race_records row for (wallet, track, carClass).
 * Returns null when the table doesn't exist yet or no row matches.
 */
async function getRaceRecords(
  supabase: SupabaseClient,
  walletAddress: string,
  trackId: string,
  carClass: string,
): Promise<RaceRecordRow | null> {
  const { data, error } = await supabase
    .from("race_records")
    .select("*")
    .eq("wallet_address", walletAddress)
    .eq("track_id", trackId)
    .eq("car_class", carClass)
    .maybeSingle();

  if (error) {
    if (isTableNotFound(error)) return null;
    throw error;
  }
  return (data as RaceRecordRow) ?? null;
}

/** Convert a DB row into the PreviousRecords shape expected by the calculator. */
function toPreviousRecords(row: RaceRecordRow | null): PreviousRecords | null {
  if (!row) return null;
  return {
    bestTotalTimeMs: row.best_total_time_ms,
    bestFirstLapMs: row.best_first_lap_ms,
    bestLapMs: row.best_lap_ms,
    totalRacesFinished: row.total_races_finished,
    totalRaceCashEarned: row.total_race_cash_earned
      ? Number(row.total_race_cash_earned)
      : undefined,
  };
}

/**
 * Upsert race_records: update best times (lower is better), increment counters.
 * Silently no-ops when the race_records table doesn't exist yet.
 */
async function upsertRaceRecords(
  supabase: SupabaseClient,
  walletAddress: string,
  trackId: string,
  carClass: string,
  totalTimeMs: number,
  firstLapMs: number,
  bestLapMs: number,
  rewardAmount: number,
  previous: RaceRecordRow | null,
): Promise<void> {
  const isFirstRace = !previous;

  const bestTotal = isFirstRace
    ? totalTimeMs
    : Math.min(
        totalTimeMs,
        previous!.best_total_time_ms ?? Infinity,
      );
  const bestFirstLap = isFirstRace
    ? firstLapMs
    : Math.min(firstLapMs, previous!.best_first_lap_ms ?? Infinity);
  const bestLap = isFirstRace
    ? bestLapMs
    : Math.min(bestLapMs, previous!.best_lap_ms ?? Infinity);
  const totalRacesFinished = (previous?.total_races_finished ?? 0) + 1;
  const totalRaceCashEarned =
    Number(previous?.total_race_cash_earned ?? 0) + rewardAmount;

  const record: RaceRecordUpsert = {
    wallet_address: walletAddress,
    track_id: trackId,
    car_class: carClass,
    best_total_time_ms: bestTotal,
    best_first_lap_ms: bestFirstLap,
    best_lap_ms: bestLap,
    total_races_finished: totalRacesFinished,
    total_race_cash_earned: totalRaceCashEarned,
  };

  const { error } = await supabase
    .from("race_records")
    .upsert(record, {
      onConflict: "wallet_address, track_id, car_class",
    });

  // Table not created yet is non-fatal — records simply won't persist until migration runs
  if (error && !isTableNotFound(error)) throw error;
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // 1. Parse payload ──────────────────────────────────────────────────────
    const body = (await request.json()) as RaceRewardPayload;

    const walletAddress = String(body.walletAddress || "");
    const raceMode = body.raceMode || "solo";
    const carId = String(body.carId || "");
    const trackId = String(body.trackId || "");
    const clientRaceId = String(body.clientRaceId || body.raceSessionId || "");
    const totalTimeMs = toPositiveInt(body.totalTimeMs);
    const bestLapMs = toPositiveInt(body.bestLapMs);
    const firstLapMs = toPositiveInt(body.firstLapMs);
    const lapsCompleted = toPositiveInt(body.lapsCompleted);
    const checkpointsCompleted = toPositiveInt(body.checkpointsCompleted);
    const placement = body.placement ? toPositiveInt(body.placement) : null;
    const wrongWayTriggered = Boolean(body.wrongWayTriggered);
    const resetCount = toPositiveInt(body.resetCount);
    const carClass = String(body.carClass || "").trim();

    // 2. Basic validation ───────────────────────────────────────────────────
    if (!isValidSolanaAddress(walletAddress))
      return jsonError("Invalid wallet address", 400);
    if (!clientRaceId || clientRaceId.length > 120)
      return jsonError("Missing race session id", 400);
    if (!carId) return jsonError("Missing car id", 400);

    const track = TRACKS.find((item) => item.id === trackId);
    if (!track) return jsonError("Unknown track", 404);

    if (!carClass || !isRecognizedCarClass(carClass)) {
      return jsonError(
        `Unrecognized car class: "${carClass}". Must be one of D, C, C+, B, B+, A, S`,
        400,
      );
    }

    const supabase = getSupabaseAdmin();
    const rewardSource = `race_reward:${clientRaceId}`;

    // 3. Duplicate check ────────────────────────────────────────────────────
    const { data: existingLedger, error: existingLedgerError } = await supabase
      .from("race_cash_ledger")
      .select("id,amount")
      .eq("wallet_address", walletAddress)
      .eq("source", rewardSource)
      .maybeSingle();
    if (existingLedgerError) throw existingLedgerError;
    if (existingLedger) {
      return NextResponse.json(
        { error: "Race reward already claimed", reward: existingLedger },
        { status: 409 },
      );
    }

    const existingReward = await tryFindRaceReward(
      supabase,
      walletAddress,
      clientRaceId,
    );
    if (existingReward) {
      return NextResponse.json(
        { error: "Race reward already claimed", reward: existingReward },
        { status: 409 },
      );
    }

    // 4. Build base reward row ──────────────────────────────────────────────
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
    } satisfies Omit<
      RaceRewardInsert,
      "reward_amount" | "reward_breakdown" | "status" | "rejection_reason"
    >;

    // 5. Reject multiplayer (no server authority) ───────────────────────────
    if (raceMode !== "solo") {
      await tryInsertRaceReward(supabase, {
        ...baseRewardRow,
        reward_amount: 0,
        reward_breakdown: { reason: "multiplayer_requires_server_authority" },
        status: "rejected",
        rejection_reason:
          "Multiplayer rewards require server-authoritative results",
      });
      return jsonError(
        "Multiplayer rewards require server-authoritative results",
        403,
      );
    }

    // 6. Player & car ownership checks ──────────────────────────────────────
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
    if (!ownedCar)
      return jsonError("Selected car does not belong to wallet", 403);

    // 7. Extended performance validation ────────────────────────────────────
    const requiredCheckpoints = track.lapCount * track.checkpoints.length;
    const validationErrors: string[] = [];

    if (lapsCompleted < track.lapCount)
      validationErrors.push("Race not completed");
    if (checkpointsCompleted < requiredCheckpoints)
      validationErrors.push("Missing checkpoints");

    // Time range checks
    if (totalTimeMs < SOLO_RACE_REWARD_CONFIG.minFinishTimeMs)
      validationErrors.push("Finish time is impossibly fast");
    if (totalTimeMs > SOLO_RACE_REWARD_CONFIG.maxFinishTimeMs)
      validationErrors.push("Finish time is too old");

    // Best lap validation
    if (bestLapMs <= 0) validationErrors.push("Missing best lap time");
    if (bestLapMs > totalTimeMs)
      validationErrors.push("Best lap time exceeds total race time");

    // First lap validation
    if (firstLapMs <= 0) validationErrors.push("Missing first lap time");
    if (firstLapMs > totalTimeMs)
      validationErrors.push("First lap time exceeds total race time");

    // Plausibility: first lap should not be impossibly faster than best lap
    if (firstLapMs > 0 && bestLapMs > 0 && firstLapMs < bestLapMs / 2) {
      validationErrors.push("First lap time is implausibly fast vs best lap");
    }

    if (validationErrors.length) {
      await tryInsertRaceReward(supabase, {
        ...baseRewardRow,
        reward_amount: 0,
        reward_breakdown: { validationErrors },
        status: "rejected",
        rejection_reason: validationErrors.join(", "),
      });
      return NextResponse.json(
        { error: validationErrors.join(", ") },
        { status: 400 },
      );
    }

    // 8. Fetch previous records (null if table doesn't exist yet) ───────────
    const previousRaceRecord = await getRaceRecords(
      supabase,
      walletAddress,
      trackId,
      carClass,
    );
    const previousRecords = toPreviousRecords(previousRaceRecord);

    // 9. Calculate performance-based reward ─────────────────────────────────
    const targetConfig = getTrackTarget(carClass, trackId);

    const breakdown: RaceRewardBreakdown = calculateSoloRaceReward({
      completed: true,
      totalTimeMs,
      bestLapMs,
      firstLapMs,
      wrongWayTriggered,
      resetCount,
      targetConfig,
      previousRecords:
        previousRecords as unknown as RaceRewardBreakdown["previousRecords"] | null,
    });

    const rewardAmount = breakdown.total;

    // 10. Insert race_rewards row (paid) ────────────────────────────────────
    const rewardRow = await tryInsertRaceReward(supabase, {
      ...baseRewardRow,
      placement: 1,
      reward_amount: rewardAmount,
      reward_breakdown: breakdown,
      status: "paid",
    });

    // 11. Update player balance ─────────────────────────────────────────────
    const currentEarned = Number(player.earned_race_cash || 0);
    const { error: balanceError } = await supabase
      .from("players")
      .update({ earned_race_cash: currentEarned + rewardAmount })
      .eq("wallet_address", walletAddress);
    if (balanceError) throw balanceError;

    // 12. Insert ledger row ─────────────────────────────────────────────────
    const ledgerReason = JSON.stringify({
      kind: "solo_race_reward",
      trackId,
      trackName: track.name,
      carId,
      carClass,
      clientRaceId,
      totalTimeMs,
      bestLapMs,
      firstLapMs,
      lapsCompleted,
      checkpointsCompleted,
      wrongWayTriggered,
      resetCount,
      placement: 1,
      earnedBonuses: breakdown.earnedBonuses,
      newRecords: breakdown.newRecords,
    });

    const { error: ledgerError } = await supabase
      .from("race_cash_ledger")
      .insert({
        wallet_address: walletAddress,
        amount: rewardAmount,
        source: rewardSource,
        cash_type: "earned",
        reason: ledgerReason,
      });
    if (ledgerError) throw ledgerError;

    // 13. Upsert race_records (gracefully no-ops if table missing) ──────────
    await upsertRaceRecords(
      supabase,
      walletAddress,
      trackId,
      carClass,
      totalTimeMs,
      firstLapMs,
      bestLapMs,
      rewardAmount,
      previousRaceRecord,
    );

    // 14. Fetch recent rewards for response ─────────────────────────────────
    let recentRewards: Array<Record<string, unknown>> = [];
    const { data: recentRewardRows, error: recentRewardsError } =
      await supabase
        .from("race_rewards")
        .select(
          "id,track_id,car_id,total_time_ms,best_lap_ms,laps_completed,reward_amount,created_at",
        )
        .eq("wallet_address", walletAddress)
        .eq("status", "paid")
        .order("created_at", { ascending: false })
        .limit(5);
    if (!recentRewardsError) recentRewards = recentRewardRows || [];

    return NextResponse.json({
      reward: rewardRow,
      rewardAmount,
      rewardBreakdown: breakdown,
      playerState: await getPlayerState(supabase, walletAddress, {
        autoSelectFallback: false,
      }),
      recentRewards,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Race reward claim failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
