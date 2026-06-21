import { NextRequest, NextResponse } from "next/server";
import { isValidSolanaAddress } from "@/lib/solana-payments";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  OBJECTIVES_V1,
  type ObjectiveConfig,
  type ObjectiveState,
  type ObjectiveProgressRow,
  type ObjectiveDifficulty,
} from "@/config/objectives";

// ── GET /api/race/objectives?walletAddress=… ───────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = (searchParams.get("walletAddress") || "").trim();

    // 1. Validate wallet
    if (!walletAddress) {
      return NextResponse.json(
        { error: "Missing wallet address" },
        { status: 400 },
      );
    }
    if (!isValidSolanaAddress(walletAddress)) {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();

    // 2. Fetch all objective progress rows for this wallet
    const { data: rows, error } = await supabase
      .from("race_objective_progress")
      .select("*")
      .eq("wallet_address", walletAddress)
      .order("created_at", { ascending: true });

    // Table not created yet → return all objectives with default state
    const isTableMissing =
      error &&
      (error.code === "PGRST205" ||
        error.message?.includes("does not exist"));

    const progressMap = new Map<string, ObjectiveProgressRow>();
    if (!isTableMissing && rows) {
      for (const row of rows) {
        progressMap.set(row.objective_id, row as ObjectiveProgressRow);
      }
    }
    if (error && !isTableMissing) throw error;

    // 3. Build full response: every objective from config, merged with DB state
    const objectives: ObjectiveState[] = OBJECTIVES_V1.map((obj) => {
      const progress = progressMap.get(obj.id);
      const status = progress?.status ?? "locked";
      return {
        objective: obj,
        status,
        progress: Number(progress?.progress ?? 0),
        target: obj.requirement,
        rewardAmount: obj.rewardAmount,
        completedAt: progress?.completed_at ?? null,
        claimedAt: progress?.claimed_at ?? null,
        difficulty: obj.difficulty,
        claimable: status === "completed",
      };
    });

    return NextResponse.json({ objectives });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch objectives";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
