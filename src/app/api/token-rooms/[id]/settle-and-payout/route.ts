import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  fetchDryRunRoom,
  isMissingTokenRoomTableError,
  tokenRoomBasePayload,
  writeTokenRoomEvent,
} from "../../_shared";
import {
  buildSettlementPreview,
  executePayoutRows,
  fetchRoomPayoutRows,
  insertPendingPayoutRows,
  loadVaultSigner,
  markManualReview,
  updateRoomSettlementAmounts,
} from "../../_settlement";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const lockId = crypto.randomUUID();
  const supabase = getSupabaseAdmin();

  try {
    const room = await fetchDryRunRoom(id);
    if (!room) return NextResponse.json({ ...tokenRoomBasePayload(), error: "Token room not found" }, { status: 404 });
    if (["paid", "paid_out", "completed"].includes(room.status)) {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "Token room is already paid", room }, { status: 409 });
    }
    if (room.status === "manual_review") {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "Token room is in manual review; automatic payout blocked", room }, { status: 409 });
    }
    if (!room.allDepositsConfirmed) {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "All deposits must be confirmed before payout", room }, { status: 409 });
    }

    const existingPayouts = await fetchRoomPayoutRows(room.roomId);
    if (existingPayouts.some((row) => row.status === "paid" || row.status === "confirmed" || row.payout_signature || row.tx_signature)) {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "Token room already has paid payout rows; refusing duplicate settlement", room, payouts: existingPayouts }, { status: 409 });
    }

    // Validate server-only signer before taking the execution lock or creating new rows.
    loadVaultSigner();

    const { preview } = await buildSettlementPreview(room.roomId);
    const { data: lockedRooms, error: lockError } = await supabase
      .from("token_rooms")
      .update({ status: "finalizing", settlement_lock_id: lockId, settlement_locked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("room_id", room.roomId)
      .in("status", ["results_recorded", "settlement_pending", "locked", "racing", "payout_failed"])
      .is("settlement_lock_id", null)
      .select("room_id");
    if (lockError) throw lockError;
    if (!lockedRooms || lockedRooms.length !== 1) {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "Settlement is already locked or room is not settleable" }, { status: 409 });
    }

    await updateRoomSettlementAmounts(preview, "payout_pending");

    const payoutRowsAfterLock = await fetchRoomPayoutRows(room.roomId);
    if (payoutRowsAfterLock.length === 0) {
      await insertPendingPayoutRows(preview, room.status === "racing_mock" ? undefined : null);
    }

    await writeTokenRoomEvent({
      roomId: room.roomId,
      eventType: "token_room_settlement_calculated",
      payload: { settlementPreview: preview, roomScopedDepositsOnly: true },
    });

    const paid = await executePayoutRows(room.roomId);
    const finalPayouts = await fetchRoomPayoutRows(room.roomId);
    const unpaid = finalPayouts.filter((row) => row.status !== "paid" && row.status !== "confirmed");
    const finalStatus = unpaid.length === 0 ? "paid" : "payout_failed";
    await supabase
      .from("token_rooms")
      .update({
        status: finalStatus,
        paid_at: finalStatus === "paid" ? new Date().toISOString() : null,
        settlement_lock_id: null,
        payout_execution_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        manual_review_reason: finalStatus === "paid" ? null : "One or more payout rows failed; manual review required.",
      })
      .eq("room_id", room.roomId)
      .eq("settlement_lock_id", lockId);

    await writeTokenRoomEvent({
      roomId: room.roomId,
      eventType: finalStatus === "paid" ? "token_room_payouts_paid" : "token_room_payouts_failed",
      severity: finalStatus === "paid" ? "info" : "error",
      payload: { paid, unpaidCount: unpaid.length },
    });

    const updatedRoom = await fetchDryRunRoom(room.roomId);
    return NextResponse.json({ ...tokenRoomBasePayload(), room: updatedRoom, settlementPreview: preview, payouts: finalPayouts, paid });
  } catch (error) {
    if (isMissingTokenRoomTableError(error)) {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "Token room tables are not available yet." }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Settlement and payout failed";
    console.error("[token-rooms/settle-and-payout] failed", message);
    if (message.includes("No valid finishers") || message.includes("manual review")) {
      await markManualReview(id, message);
    } else {
      await supabase
        .from("token_rooms")
        .update({ status: "payout_failed", settlement_lock_id: null, manual_review_reason: message, updated_at: new Date().toISOString() })
        .eq("room_id", id);
    }
    return NextResponse.json({ ...tokenRoomBasePayload(), error: message }, { status: 400 });
  }
}
