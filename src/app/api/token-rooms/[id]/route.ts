import { NextRequest, NextResponse } from "next/server";
import {
  fetchDryRunRoom,
  isMissingTokenRoomTableError,
  validateWalletAddress,
  tokenRoomBasePayload,
} from "../_shared";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const walletAddress = validateWalletAddress(request.nextUrl.searchParams.get("walletAddress"));

  try {
    const room = await fetchDryRunRoom(id);

    if (!room) {
      return NextResponse.json(
        {
          ...tokenRoomBasePayload(),
          error: "Dry-run token room not found",
          room: null,
        },
        { status: 404 },
      );
    }

    const currentPlayer = walletAddress ? room.players.find((player) => player.walletAddress === walletAddress) || null : null;
    const needsDeposit = Boolean(currentPlayer && currentPlayer.dbDepositStatus !== "confirmed");
    const readyToRace = room.allDepositsConfirmed || room.dryRunStatus === "ready_to_race";

    return NextResponse.json({
      ...tokenRoomBasePayload(),
      room,
      depositWallet: room.depositWallet,
      currentWallet: walletAddress,
      currentPlayer,
      needsDeposit,
      allDepositsConfirmed: room.allDepositsConfirmed,
      readyToRace,
      warning: "RACETE deposits are real. Payouts are admin-reviewed/manual in this MVP.",
      dryRunNotice: "Token room DB lifecycle active. RACETE deposits are real only after wallet-signed deposit; payouts remain manual/admin-reviewed.",
    });
  } catch (error) {
    if (isMissingTokenRoomTableError(error)) {
      return NextResponse.json({
        ...tokenRoomBasePayload(),
        rooms: [],
        room: null,
        error: "Token room tables are not available yet.",
        message: "Apply the Phase A migration before using DB-backed dry-run rooms.",
      });
    }

    console.error("[token-rooms/detail] failed", error);
    return NextResponse.json(
      {
        ...tokenRoomBasePayload(),
        error: "Failed to load dry-run token room",
      },
      { status: 500 },
    );
  }
}
