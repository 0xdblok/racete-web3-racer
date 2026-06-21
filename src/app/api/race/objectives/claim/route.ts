import { NextRequest, NextResponse } from "next/server";
import { isValidSolanaAddress } from "@/lib/solana-payments";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getObjectiveById } from "@/config/objectives";

// ── POST /api/race/objectives/claim ────────────────────────────────────────

type ClaimPayload = {
  walletAddress?: string;
  objectiveId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ClaimPayload;
    const walletAddress = String(body.walletAddress || "").trim();
    const objectiveId = String(body.objectiveId || "").trim();

    // 1. Validate inputs
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
    if (!objectiveId) {
      return NextResponse.json(
        { error: "Missing objective id" },
        { status: 400 },
      );
    }

    const objective = getObjectiveById(objectiveId);
    if (!objective) {
      return NextResponse.json(
        { error: `Unknown objective: ${objectiveId}` },
        { status: 404 },
      );
    }

    const supabase = getSupabaseAdmin();

    // 2. Fetch the objective progress row
    const { data: progressRow, error: fetchError } = await supabase
      .from("race_objective_progress")
      .select("*")
      .eq("wallet_address", walletAddress)
      .eq("objective_id", objectiveId)
      .maybeSingle();

    if (fetchError) {
      const code = (fetchError as { code?: string }).code;
      if (code === "PGRST205" || fetchError.message?.includes("does not exist")) {
        return NextResponse.json(
          { error: "Objectives system not available yet" },
          { status: 503 },
        );
      }
      throw fetchError;
    }

    if (!progressRow) {
      return NextResponse.json(
        { error: "Objective not found for this wallet" },
        { status: 404 },
      );
    }

    // 3. Verify completed
    if (progressRow.status !== "completed") {
      return NextResponse.json(
        { error: `Objective is not completed (status: ${progressRow.status})` },
        { status: 409 },
      );
    }

    // 4. Verify not already claimed
    if (progressRow.status === "claimed") {
      return NextResponse.json(
        { error: "Objective reward already claimed" },
        { status: 409 },
      );
    }

    const rewardAmount = Number(progressRow.reward_amount || objective.rewardAmount);

    // 5. Pay Race Cash — update player balance
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("earned_race_cash")
      .eq("wallet_address", walletAddress)
      .single<{ earned_race_cash: number | string }>();

    if (playerError) throw playerError;

    const currentEarned = Number(player.earned_race_cash || 0);
    const { error: balanceError } = await supabase
      .from("players")
      .update({ earned_race_cash: currentEarned + rewardAmount })
      .eq("wallet_address", walletAddress);

    if (balanceError) throw balanceError;

    // 6. Write ledger entry
    const ledgerReason = JSON.stringify({
      source: "race_objective",
      objectiveId,
      title: objective.title,
      walletAddress,
    });

    const { error: ledgerError } = await supabase
      .from("race_cash_ledger")
      .insert({
        wallet_address: walletAddress,
        amount: rewardAmount,
        source: `objective:${objectiveId}`,
        cash_type: "earned",
        reason: ledgerReason,
      });

    if (ledgerError) throw ledgerError;

    // 7. Update objective status to claimed
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("race_objective_progress")
      .update({
        status: "claimed",
        claimed_at: now,
        updated_at: now,
      })
      .eq("wallet_address", walletAddress)
      .eq("objective_id", objectiveId);

    if (updateError) throw updateError;

    return NextResponse.json({
      claimed: true,
      objectiveId,
      rewardAmount,
      newBalance: currentEarned + rewardAmount,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Objective claim failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
