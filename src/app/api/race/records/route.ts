import { NextRequest, NextResponse } from "next/server";
import { isValidSolanaAddress } from "@/lib/solana-payments";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getTrackTarget, SOLO_RACE_REWARD_CONFIG, type TrackTargetConfig } from "@/config/rewards";

type RaceRecordRow = {
  id: string;
  wallet_address: string;
  track_id: string;
  car_class: string;
  best_total_time_ms: number | null;
  best_first_lap_ms: number | null;
  best_lap_ms: number | null;
  total_races_finished: number;
  total_race_cash_earned: number | string;
  updated_at: string;
  created_at: string;
};

export type RecordsResponse = {
  hasRecord: boolean;
  walletAddress: string;
  trackId: string;
  carClass: string;
  records: {
    bestTotalTimeMs: number | null;
    bestFirstLapMs: number | null;
    bestLapMs: number | null;
    totalRacesFinished: number;
    totalRaceCashEarned: number;
    createdAt: string;
    updatedAt: string;
  } | null;
  targets: TrackTargetConfig & { carClass: string; trackId: string };
  bonuses: {
    targetTimeBonus: number;
    personalBestTotalBonus: number;
    personalBestFirstLapBonus: number;
    personalBestLapBonus: number;
    cleanRaceBonus: number;
    noResetBonus: number;
    noWrongWayBonus: number;
  };
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get("walletAddress") || "";
    const trackId = searchParams.get("trackId") || "city-loop";
    const carClass = searchParams.get("carClass") || "D";

    if (!isValidSolanaAddress(walletAddress)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    const targets = getTrackTarget(carClass, trackId);
    const bonuses = {
      targetTimeBonus: SOLO_RACE_REWARD_CONFIG.targetTimeTotalBonus,
      personalBestTotalBonus: SOLO_RACE_REWARD_CONFIG.personalBestTotalBonus,
      personalBestFirstLapBonus: SOLO_RACE_REWARD_CONFIG.personalBestFirstLapBonus,
      personalBestLapBonus: SOLO_RACE_REWARD_CONFIG.personalBestLapBonus,
      cleanRaceBonus: SOLO_RACE_REWARD_CONFIG.cleanRaceBonus,
      noResetBonus: SOLO_RACE_REWARD_CONFIG.noResetBonus,
      noWrongWayBonus: SOLO_RACE_REWARD_CONFIG.noWrongWayBonus,
    };

    const supabase = getSupabaseAdmin();

    const { data: record, error } = await supabase
      .from("race_records")
      .select("*")
      .eq("wallet_address", walletAddress)
      .eq("track_id", trackId)
      .eq("car_class", carClass)
      .maybeSingle<RaceRecordRow>();

    if (error || !record) {
      return NextResponse.json({
        hasRecord: false,
        walletAddress,
        trackId,
        carClass,
        records: null,
        targets: { ...targets, carClass, trackId },
        bonuses,
      });
    }

    return NextResponse.json({
      hasRecord: true,
      walletAddress,
      trackId,
      carClass,
      records: {
        bestTotalTimeMs: record.best_total_time_ms,
        bestFirstLapMs: record.best_first_lap_ms,
        bestLapMs: record.best_lap_ms,
        totalRacesFinished: record.total_races_finished,
        totalRaceCashEarned: Number(record.total_race_cash_earned || 0),
        createdAt: record.created_at,
        updatedAt: record.updated_at,
      },
      targets: { ...targets, carClass, trackId },
      bonuses,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch race records";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
