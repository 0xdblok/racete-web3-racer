import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isRecognizedCarClass } from "@/config/rewards";
import {
  getCurrentWeekWindow,
  parseWeekId,
  getWeekId,
  parseWeeklyCategory,
  TIME_CATEGORIES,
  type WeeklyCategory,
} from "@/lib/weekly";
import { WEEKLY_PRIZES } from "@/config/weekly";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type WeeklyEntry = {
  rank: number;
  walletAddress: string;
  displayWallet: string;
  carClass: string;
  /** The primary stat value for the selected category. */
  value: number;
  bestTotalTimeMs: number | null;
  bestFirstLapMs: number | null;
  bestLapMs: number | null;
  raceCashEarned: number;
  missionsCompleted: number;
  racesFinished: number;
};

export type WeeklyLeaderboardResponse = {
  weekId: string;
  weekStart: string;
  weekEnd: string;
  category: WeeklyCategory;
  trackId: string;
  carClass: string;
  limit: number;
  entries: WeeklyEntry[];
  currentPlayer: {
    rank: number;
    entry: WeeklyEntry;
  } | null;
  prizes: {
    rank: number;
    label: string;
    rewardAmount: number;
  }[];
  /** V1: prizes are preview only, no auto-distribution. */
  distributionNote: string;
};

type RaceRewardWeekRow = {
  wallet_address: string;
  car_id: string;
  total_time_ms: number;
  best_lap_ms: number;
  reward_breakdown: Record<string, unknown> | null;
};

type LedgerWeekRow = {
  wallet_address: string;
  amount: number | string;
};

type MissionWeekRow = {
  wallet_address: string;
};

type CarCatalogRow = {
  id: string;
  class: string;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const VALID_LIMITS: Set<number> = new Set([10, 25, 50]);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function shortWallet(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function parseLimit(raw: string | null): number {
  if (raw) {
    const n = Number(raw);
    if (VALID_LIMITS.has(n)) return n;
  }
  return 10;
}

function parseCarClass(raw: string | null): string {
  if (!raw) return "all";
  if (raw === "all") return "all";
  if (isRecognizedCarClass(raw)) return raw;
  return "all";
}

/* ------------------------------------------------------------------ */
/*  Route handler                                                      */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const weekIdRaw = searchParams.get("weekId");
    const category = parseWeeklyCategory(searchParams.get("category"));
    const trackId = searchParams.get("trackId") || "city-loop";
    const carClass = parseCarClass(searchParams.get("carClass"));
    const walletAddress = searchParams.get("walletAddress") || "";
    const limit = parseLimit(searchParams.get("limit"));

    // Resolve week window
    const week = weekIdRaw
      ? parseWeekId(weekIdRaw)
      : getCurrentWeekWindow();
    const effectiveWeekId = weekIdRaw || getWeekId();
    const weekStart = (week ?? getCurrentWeekWindow()).start;
    const weekEnd = (week ?? getCurrentWeekWindow()).end;

    const weekStartISO = weekStart.toISOString();
    const weekEndISO = weekEnd.toISOString();

    const supabase = getSupabaseAdmin();

    // ── 1. Fetch cars catalog (car_id → class map) ─────────────────────────
    const { data: carsRows } = await supabase
      .from("cars_catalog")
      .select("id, class")
      .eq("is_active", true);

    const carClassMap = new Map<string, string>();
    if (carsRows) {
      for (const row of carsRows as unknown as CarCatalogRow[]) {
        carClassMap.set(row.id, row.class);
      }
    }

    // ── 2. Query weekly race_rewards (time stats + race count) ─────────────
    const { data: rewardRows, error: rewardError } = await supabase
      .from("race_rewards")
      .select(
        "wallet_address, car_id, total_time_ms, best_lap_ms, reward_breakdown",
      )
      .eq("status", "paid")
      .eq("race_mode", "solo")
      .eq("track_id", trackId)
      .gte("created_at", weekStartISO)
      .lt("created_at", weekEndISO);

    if (rewardError) {
      const code = (rewardError as { code?: string }).code;
      if (code !== "PGRST205" && !rewardError.message?.includes("does not exist")) {
        throw rewardError;
      }
    }

    // ── 3. Query weekly ledger (race cash earned) ──────────────────────────
    // Include race_reward: and objective: sources
    const { data: ledgerRows, error: ledgerError } = await supabase
      .from("race_cash_ledger")
      .select("wallet_address, amount")
      .gt("amount", 0)
      .eq("cash_type", "earned")
      .gte("created_at", weekStartISO)
      .lt("created_at", weekEndISO);

    if (ledgerError) {
      const code = (ledgerError as { code?: string }).code;
      if (code !== "PGRST205" && !ledgerError.message?.includes("does not exist")) {
        throw ledgerError;
      }
    }

    // ── 4. Query weekly objective completions ──────────────────────────────
    const { data: missionRows, error: missionError } = await supabase
      .from("race_objective_progress")
      .select("wallet_address")
      .eq("status", "claimed")
      .gte("claimed_at", weekStartISO)
      .lt("claimed_at", weekEndISO);

    if (missionError) {
      const code = (missionError as { code?: string }).code;
      if (
        code !== "PGRST205" &&
        !missionError.message?.includes("does not exist")
      ) {
        throw missionError;
      }
    }

    // ── 5. Aggregate per wallet ────────────────────────────────────────────

    interface WalletAgg {
      bestTotalTimeMs: number | null;
      bestFirstLapMs: number | null;
      bestLapMs: number | null;
      raceCashEarned: number;
      missionsCompleted: number;
      racesFinished: number;
      carClass: string;
    }

    const walletMap = new Map<string, WalletAgg>();

    // Process race_rewards
    if (rewardRows) {
      for (const row of rewardRows as unknown as RaceRewardWeekRow[]) {
        const wal = row.wallet_address;
        const cls = carClassMap.get(row.car_id) || "D";
        let agg = walletMap.get(wal);
        if (!agg) {
          agg = {
            bestTotalTimeMs: null,
            bestFirstLapMs: null,
            bestLapMs: null,
            raceCashEarned: 0,
            missionsCompleted: 0,
            racesFinished: 0,
            carClass: cls,
          };
          walletMap.set(wal, agg);
        }

        // Best total time (lower is better)
        if (
          agg.bestTotalTimeMs === null ||
          row.total_time_ms < agg.bestTotalTimeMs
        ) {
          agg.bestTotalTimeMs = row.total_time_ms;
        }

        // Best lap (lower is better)
        if (
          agg.bestLapMs === null ||
          row.best_lap_ms < agg.bestLapMs
        ) {
          agg.bestLapMs = row.best_lap_ms;
        }

        // First lap (extract from reward_breakdown JSON)
        if (row.reward_breakdown) {
          const rb = row.reward_breakdown as Record<string, unknown>;
          const firstLap = (rb as { firstLapMs?: number }).firstLapMs;
          if (typeof firstLap === "number" && firstLap > 0) {
            if (
              agg.bestFirstLapMs === null ||
              firstLap < agg.bestFirstLapMs
            ) {
              agg.bestFirstLapMs = firstLap;
            }
          }
        }

        // Race count
        agg.racesFinished += 1;

        // Use the best class (highest tier) as player's primary class
        // Simple heuristic: keep the class of the car used in the best total time
        if (agg.bestTotalTimeMs === row.total_time_ms) {
          agg.carClass = cls;
        }
      }
    }

    // Process ledger (race cash earned)
    if (ledgerRows) {
      for (const row of ledgerRows as unknown as LedgerWeekRow[]) {
        const wal = row.wallet_address;
        let agg = walletMap.get(wal);
        if (!agg) {
          agg = {
            bestTotalTimeMs: null,
            bestFirstLapMs: null,
            bestLapMs: null,
            raceCashEarned: 0,
            missionsCompleted: 0,
            racesFinished: 0,
            carClass: "D",
          };
          walletMap.set(wal, agg);
        }
        agg.raceCashEarned += Number(row.amount || 0);
      }
    }

    // Process missions
    if (missionRows) {
      const missionCounts = new Map<string, number>();
      for (const row of missionRows as unknown as MissionWeekRow[]) {
        const wal = row.wallet_address;
        missionCounts.set(wal, (missionCounts.get(wal) || 0) + 1);
      }
      for (const [wal, count] of missionCounts) {
        let agg = walletMap.get(wal);
        if (!agg) {
          agg = {
            bestTotalTimeMs: null,
            bestFirstLapMs: null,
            bestLapMs: null,
            raceCashEarned: 0,
            missionsCompleted: 0,
            racesFinished: 0,
            carClass: "D",
          };
          walletMap.set(wal, agg);
        }
        agg.missionsCompleted = count;
      }
    }

    // ── 6. Build entries ───────────────────────────────────────────────────
    let allEntries: WeeklyEntry[] = [];

    for (const [wal, agg] of walletMap) {
      // Apply car class filter
      if (carClass !== "all" && agg.carClass !== carClass) continue;

      let value: number;
      switch (category) {
        case "best_total_time":
          value = agg.bestTotalTimeMs ?? 0;
          if (agg.bestTotalTimeMs === null) continue;
          break;
        case "best_first_lap":
          value = agg.bestFirstLapMs ?? 0;
          if (agg.bestFirstLapMs === null) continue;
          break;
        case "best_lap":
          value = agg.bestLapMs ?? 0;
          if (agg.bestLapMs === null) continue;
          break;
        case "race_cash_earned":
          value = agg.raceCashEarned;
          if (agg.raceCashEarned <= 0) continue;
          break;
        case "missions_completed":
          value = agg.missionsCompleted;
          if (agg.missionsCompleted <= 0) continue;
          break;
        case "races_finished":
          value = agg.racesFinished;
          if (agg.racesFinished <= 0) continue;
          break;
      }

      allEntries.push({
        rank: 0, // will be set after sort
        walletAddress: wal,
        displayWallet: shortWallet(wal),
        carClass: agg.carClass,
        value,
        bestTotalTimeMs: agg.bestTotalTimeMs,
        bestFirstLapMs: agg.bestFirstLapMs,
        bestLapMs: agg.bestLapMs,
        raceCashEarned: agg.raceCashEarned,
        missionsCompleted: agg.missionsCompleted,
        racesFinished: agg.racesFinished,
      });
    }

    // Sort
    const isTime = TIME_CATEGORIES.has(category);
    allEntries.sort((a, b) => {
      if (isTime) {
        // Lower is better — time categories
        if (a.value !== b.value) return a.value - b.value;
        // Tiebreak: more races finished
        if (a.racesFinished !== b.racesFinished)
          return b.racesFinished - a.racesFinished;
        // Then more RC earned
        if (a.raceCashEarned !== b.raceCashEarned)
          return b.raceCashEarned - a.raceCashEarned;
        return 0;
      } else {
        // Higher is better — volume categories
        if (a.value !== b.value) return b.value - a.value;
        // Tiebreak: better total time
        const aTime = a.bestTotalTimeMs ?? Infinity;
        const bTime = b.bestTotalTimeMs ?? Infinity;
        if (aTime !== bTime) return aTime - bTime;
        // Then more races finished
        if (a.racesFinished !== b.racesFinished)
          return b.racesFinished - a.racesFinished;
        return 0;
      }
    });

    // Assign ranks
    const ranked = allEntries.map((entry, i) => ({ ...entry, rank: i + 1 }));

    // Apply limit
    const entries = ranked.slice(0, limit);

    // ── 7. Current player rank ─────────────────────────────────────────────
    let currentPlayer: WeeklyLeaderboardResponse["currentPlayer"] = null;
    if (walletAddress) {
      const playerEntry = ranked.find(
        (e) => e.walletAddress === walletAddress,
      );
      if (playerEntry) {
        currentPlayer = { rank: playerEntry.rank, entry: playerEntry };
      }
    }

    // ── 8. Prizes preview ─────────────────────────────────────────────────
    const prizes = WEEKLY_PRIZES[category]?.prizes ?? [];

    return NextResponse.json({
      weekId: effectiveWeekId,
      weekStart: weekStartISO,
      weekEnd: weekEndISO,
      category,
      trackId,
      carClass,
      limit,
      entries,
      currentPlayer,
      prizes,
      distributionNote:
        "V1 preview — weekly prizes are not auto-distributed yet. Manual admin payout in future iteration.",
    } satisfies WeeklyLeaderboardResponse);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load weekly leaderboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
