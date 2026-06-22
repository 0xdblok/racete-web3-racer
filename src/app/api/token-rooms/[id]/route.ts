import { NextResponse } from "next/server";
import {
  fetchDryRunRoom,
  isMissingTokenRoomTableError,
  tokenRoomBasePayload,
} from "../_shared";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

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

    return NextResponse.json({
      ...tokenRoomBasePayload(),
      room,
      dryRunNotice: "Dry-run room only. No RACETE deposit, transfer, or payout will happen.",
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
