import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { isRecognizedCarClass } from "@/config/rewards";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Category =
  | "best_total_time"
  | "best_first_lap"
  | "best_lap"
  | "race_cash_earned"
  | "races_finished";

export type LeaderboardEntry = {
  rank: number;
  walletAddress: string;
  displayWallet: string;
  trackId: string;
  carClass: string;
  bestTotalTimeMs: number | null;
  bestFirstLapMs: number | null;
  bestLapMs: number | null;
  totalRacesFinished: number;
  totalRaceCashEarned: number;
  updatedAt: string;
};

export type LeaderboardResponse = {
  category: Category;
  trackId: string;
  carClass: string;
  limit: number;
  entries: LeaderboardEntry[];
  currentPlayer: {
    rank: number;
    entry: LeaderboardEntry;
  } | null;
};

type RaceRecordDbRow = {
  wallet_address: string;
  track_id: string;
  car_class: string;
  best_total_time_ms: number | null;
  best_first_lap_ms: number | null;
  best_lap_ms: number | null;
  total_races_finished: number;
  total_race_cash_earned: number;
  updated_at: string;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const VALID_CATEGORIES: Set<string> = new Set([
  "best_total_time",
  "best_first_lap",
  "best_lap",
  "race_cash_earned",
  "races_finished",
]);

const VALID_LIMITS: Set<number> = new Set([10, 25, 50]);

/** Column mapping for each category. */
const CATEGORY_COLUMN: Record<Category, string> = {
  best_total_time: "best_total_time_ms",
  best_first_lap: "best_first_lap_ms",
  best_lap: "best_lap_ms",
  race_cash_earned: "total_race_cash_earned",
  races_finished: "total_races_finished",
};

/** Whether lower-is-better (time) or higher-is-better (volume). */
const TIME_CATEGORIES: Set<Category> = new Set([
  "best_total_time",
  "best_first_lap",
  "best_lap",
]);

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function shortWallet(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function formatEntry(row: RaceRecordDbRow, rank: number): LeaderboardEntry {
  return {
    rank,
    walletAddress: row.wallet_address,
    displayWallet: shortWallet(row.wallet_address),
    trackId: row.track_id,
    carClass: row.car_class,
    bestTotalTimeMs: row.best_total_time_ms,
    bestFirstLapMs: row.best_first_lap_ms,
    bestLapMs: row.best_lap_ms,
    totalRacesFinished: row.total_races_finished,
    totalRaceCashEarned: Number(row.total_race_cash_earned || 0),
    updatedAt: row.updated_at,
  };
}

function parseCategory(raw: string | null): Category {
  if (raw && VALID_CATEGORIES.has(raw)) return raw as Category;
  return "best_total_time";
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
    const category = parseCategory(searchParams.get("category"));
    const trackId = searchParams.get("trackId") || "city-loop";
    const carClass = parseCarClass(searchParams.get("carClass"));
    const walletAddress = searchParams.get("walletAddress") || "";
    const limit = parseLimit(searchParams.get("limit"));

    const supabase = getSupabaseAdmin();

    // --- Build query ---
    let query = supabase
      .from("race_records")
      .select("*")
      .eq("track_id", trackId);

    if (carClass !== "all") {
      query = query.eq("car_class", carClass);
    }

    const column = CATEGORY_COLUMN[category];
    const isTime = TIME_CATEGORIES.has(category);

    // Order: time categories need non-null filter + asc; volume: desc
    if (isTime) {
      query = query
        .not(column, "is", null)
        .order(column, { ascending: true })
        .order("total_races_finished", { ascending: false })
        .order("updated_at", { ascending: true });
    } else {
      query = query
        .order(column, { ascending: false })
        .order("best_total_time_ms", { ascending: true })
        .order("updated_at", { ascending: true });
    }

    query = query.limit(limit);

    const { data: rows, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Leaderboard query failed" },
        { status: 500 },
      );
    }

    const entries: LeaderboardEntry[] = (rows as RaceRecordDbRow[] | null)?.map(
      (row, i) => formatEntry(row, i + 1),
    ) ?? [];

    // --- Current player rank ---
    let currentPlayer: LeaderboardResponse["currentPlayer"] = null;

    if (walletAddress) {
      // Fetch all matching rows to compute rank
      let rankQuery = supabase
        .from("race_records")
        .select("wallet_address, " + column)
        .eq("track_id", trackId);

      if (carClass !== "all") {
        rankQuery = rankQuery.eq("car_class", carClass);
      }

      if (isTime) {
        rankQuery = rankQuery
          .not(column, "is", null)
          .order(column, { ascending: true });
      } else {
        rankQuery = rankQuery.order(column, { ascending: false });
      }

      const { data: allRows } = await rankQuery;

      if (allRows) {
        const typed = allRows as unknown as { wallet_address: string; car_class: string }[];
        const playerIndex = typed.findIndex(
          (r) => r.wallet_address === walletAddress,
        );
        if (playerIndex !== -1) {
          const playerCarClass = typed[playerIndex]!.car_class;
          // Fetch full player record for the entry detail
          const { data: playerRow } = await supabase
            .from("race_records")
            .select("*")
            .eq("wallet_address", walletAddress)
            .eq("track_id", trackId)
            .eq("car_class", carClass === "all" ? playerCarClass : carClass)
            .maybeSingle();

          if (playerRow) {
            currentPlayer = {
              rank: playerIndex + 1,
              entry: formatEntry(playerRow as RaceRecordDbRow, playerIndex + 1),
            };
          }
        }
      }
    }

    return NextResponse.json({
      category,
      trackId,
      carClass,
      limit,
      entries,
      currentPlayer,
    } satisfies LeaderboardResponse);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load leaderboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
