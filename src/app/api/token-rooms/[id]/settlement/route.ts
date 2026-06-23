import { NextResponse } from "next/server";
import {
  fetchDryRunRoom,
  isMissingTokenRoomTableError,
  tokenRoomBasePayload,
} from "../../_shared";
import { buildSettlementPreview, fetchRoomPayoutRows } from "../../_settlement";
import { getTokenRoomVaultPrivateKeyBase64 } from "@/config/token-rooms";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const room = await fetchDryRunRoom(id);
    if (!room) return NextResponse.json({ ...tokenRoomBasePayload(), error: "Token room not found" }, { status: 404 });
    const payouts = await fetchRoomPayoutRows(id);
    let settlementPreview = null;
    let previewError = null;
    try {
      settlementPreview = (await buildSettlementPreview(id)).preview;
    } catch (error) {
      previewError = error instanceof Error ? error.message : "Settlement preview unavailable";
    }

    return NextResponse.json({
      ...tokenRoomBasePayload(),
      autoPayoutEnabled: Boolean(getTokenRoomVaultPrivateKeyBase64()),
      room,
      settlementPreview,
      previewError,
      payouts,
      manualReviewReason: room.status === "manual_review" ? "Room is in manual review. Automatic payout is blocked." : null,
    });
  } catch (error) {
    if (isMissingTokenRoomTableError(error)) {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "Token room tables are not available yet." }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Settlement lookup failed";
    return NextResponse.json({ ...tokenRoomBasePayload(), error: message }, { status: 500 });
  }
}
