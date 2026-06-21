import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { isValidSolanaAddress } from "@/lib/solana-payments";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getPlayerState } from "@/lib/player-state";
import {
  MULTIPLAYER_RACE_CASH_PLACEMENT_REWARDS,
  isRecognizedCarClass,
} from "@/config/rewards";
import { TRACKS } from "@/config/tracks";

// ── Types ───────────────────────────────────────────────────────────────────

type SignedRewardBody = {
  payload: {
    version: number;
    raceMode: string;
    roomId: string;
    serverRaceId: string;
    walletAddress: string;
    trackId: string;
    carId: string;
    carClass: string;
    placement: number;
    totalPlayers: number;
    totalTimeMs: number;
    bestLapMs: number;
    firstLapMs: number;
    lapsCompleted: number;
    checkpointsCompleted: number;
    status: string;
    finishedAt: string;
    expiresAt: string;
  };
  signature: string;
};

// ── Constants ───────────────────────────────────────────────────────────────

const MIN_FINISH_TIME_MS = 30_000;
const CITY_LOOP_LAPS = 3;
const CITY_LOOP_CHECKPOINTS = 10;

// ── Helpers ─────────────────────────────────────────────────────────────────

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function canonicalJson(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

function verifySignature(
  payload: Record<string, unknown>,
  signature: string,
): boolean {
  const secret = process.env.MULTIPLAYER_REWARD_SECRET || "";
  if (!secret) {
    console.error("[MP Reward] MULTIPLAYER_REWARD_SECRET not configured");
    return false;
  }
  const canonical = canonicalJson(payload);
  const expected = createHmac("sha256", secret).update(canonical).digest("hex");

  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < signature.length; i++) {
    diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SignedRewardBody;
    const { payload, signature } = body;

    // 1. Structural validation ─────────────────────────────────────────────
    if (!payload || !signature) {
      return jsonError("Missing payload or signature", 400);
    }
    if (payload.version !== 1) {
      return jsonError("Unsupported payload version", 400);
    }

    // 2. Signature verification ────────────────────────────────────────────
    if (!verifySignature(payload, signature)) {
      return jsonError("Invalid signature — not authorized by game server", 403);
    }

    // 3. Expiry check ──────────────────────────────────────────────────────
    if (payload.expiresAt && new Date(payload.expiresAt) <= new Date()) {
      return jsonError("Reward payload has expired", 410);
    }

    // 4. Race mode check ───────────────────────────────────────────────────
    if (payload.raceMode !== "multiplayer") {
      return jsonError("Only multiplayer rewards accepted on this endpoint", 400);
    }

    // 5. Status check ──────────────────────────────────────────────────────
    if (payload.status !== "finished") {
      return jsonError("Only finished racers can claim rewards", 400);
    }

    // 6. Wallet validation ─────────────────────────────────────────────────
    if (!payload.walletAddress || !isValidSolanaAddress(payload.walletAddress)) {
      return jsonError("Invalid wallet address", 400);
    }

    // 7. Track validation ──────────────────────────────────────────────────
    const track = TRACKS.find((t) => t.id === payload.trackId);
    if (!track) return jsonError("Unknown track", 404);

    // 8. Car class validation ──────────────────────────────────────────────
    if (!payload.carClass || !isRecognizedCarClass(payload.carClass)) {
      return jsonError(`Unrecognized car class: ${payload.carClass}`, 400);
    }

    // 9. Placement validation ──────────────────────────────────────────────
    if (
      !Number.isFinite(payload.placement) ||
      payload.placement < 1 ||
      payload.placement > 6
    ) {
      return jsonError("Invalid placement", 400);
    }

    // 10. Time plausibility ────────────────────────────────────────────────
    if (payload.totalTimeMs < MIN_FINISH_TIME_MS) {
      return jsonError("Finish time is impossibly fast", 400);
    }

    // 11. Laps / checkpoints minimum ───────────────────────────────────────
    if (payload.lapsCompleted < CITY_LOOP_LAPS) {
      return jsonError("Not enough laps completed", 400);
    }
    if (payload.checkpointsCompleted < CITY_LOOP_LAPS * CITY_LOOP_CHECKPOINTS) {
      return jsonError("Not enough checkpoints completed", 400);
    }

    // 12. Server race ID required ──────────────────────────────────────────
    if (!payload.serverRaceId || !payload.roomId) {
      return jsonError("Missing server race identifier", 400);
    }

    // 13. Calculate reward from placement (server-side, not from payload) ──
    const rewardAmount = MULTIPLAYER_RACE_CASH_PLACEMENT_REWARDS[payload.placement];
    if (!rewardAmount || rewardAmount <= 0) {
      return jsonError(`No reward for placement #${payload.placement}`, 400);
    }

    const supabase = getSupabaseAdmin();
    const walletAddress = payload.walletAddress;
    const clientRaceId = `multiplayer:${payload.serverRaceId}:${walletAddress}`;
    const rewardSource = `race_reward:${clientRaceId}`;

    // 14. Idempotency check ────────────────────────────────────────────────
    const { data: existingLedger } = await supabase
      .from("race_cash_ledger")
      .select("id,amount")
      .eq("wallet_address", walletAddress)
      .eq("source", rewardSource)
      .maybeSingle();

    if (existingLedger) {
      return NextResponse.json(
        {
          error: "Multiplayer reward already claimed",
          reward: existingLedger,
        },
        { status: 409 },
      );
    }

    const { data: existingReward } = await supabase
      .from("race_rewards")
      .select("id,status,reward_amount")
      .eq("wallet_address", walletAddress)
      .eq("client_race_id", clientRaceId)
      .maybeSingle();

    if (existingReward) {
      return NextResponse.json(
        {
          error: "Multiplayer reward already claimed",
          reward: existingReward,
        },
        { status: 409 },
      );
    }

    // 15. Fetch player balance ─────────────────────────────────────────────
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("earned_race_cash")
      .eq("wallet_address", walletAddress)
      .single<{ earned_race_cash: number | string }>();

    if (playerError) throw playerError;
    const currentEarned = Number(player.earned_race_cash || 0);

    // 16. Update player balance ────────────────────────────────────────────
    const { error: balanceError } = await supabase
      .from("players")
      .update({ earned_race_cash: currentEarned + rewardAmount })
      .eq("wallet_address", walletAddress);

    if (balanceError) throw balanceError;

    // 17. Insert ledger entry ──────────────────────────────────────────────
    const ledgerReason = JSON.stringify({
      source: "multiplayer_reward",
      serverRaceId: payload.serverRaceId,
      roomId: payload.roomId,
      placement: payload.placement,
      totalPlayers: payload.totalPlayers,
      totalTimeMs: payload.totalTimeMs,
      bestLapMs: payload.bestLapMs,
      firstLapMs: payload.firstLapMs,
      carClass: payload.carClass,
      trackId: payload.trackId,
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

    // 18. Insert race_rewards row ──────────────────────────────────────────
    const { error: rewardError } = await supabase
      .from("race_rewards")
      .insert({
        wallet_address: walletAddress,
        race_mode: "multiplayer",
        track_id: payload.trackId,
        car_id: payload.carId || "unknown",
        client_race_id: clientRaceId,
        total_time_ms: payload.totalTimeMs,
        best_lap_ms: payload.bestLapMs,
        laps_completed: payload.lapsCompleted,
        checkpoints_completed: payload.checkpointsCompleted,
        placement: payload.placement,
        reward_amount: rewardAmount,
        reward_breakdown: {
          placement: payload.placement,
          totalPlayers: payload.totalPlayers,
          serverRaceId: payload.serverRaceId,
        },
        status: "paid",
      });

    if (rewardError) throw rewardError;

    // 19. Fetch updated player state ───────────────────────────────────────
    let playerState = null;
    try {
      playerState = await getPlayerState(supabase, walletAddress, {
        autoSelectFallback: false,
      });
    } catch {
      // non-fatal — balance already updated
    }

    return NextResponse.json({
      claimed: true,
      placement: payload.placement,
      rewardAmount,
      newBalance: currentEarned + rewardAmount,
      playerState,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Multiplayer reward claim failed";
    console.error("[MP Reward]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
