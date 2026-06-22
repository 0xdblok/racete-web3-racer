import { NextResponse } from "next/server";
import {
  fetchDryRunRooms,
  isMissingTokenRoomTableError,
  tokenRoomBasePayload,
} from "../_shared";

export async function GET() {
  try {
    const rooms = (await fetchDryRunRooms()).filter((room) => room.dryRunStatus === "waiting");

    return NextResponse.json({
      ...tokenRoomBasePayload(),
      rooms,
    });
  } catch (error) {
    if (isMissingTokenRoomTableError(error)) {
      return NextResponse.json(
        {
          ...tokenRoomBasePayload(),
          rooms: [],
          error: "Token room tables are not available yet.",
          message: "Phase C.1 dry-run listing requires the Phase A token_rooms migration to be applied manually.",
        },
        { status: 503 },
      );
    }

    const message = error instanceof Error ? error.message : "Token room listing failed";
    return NextResponse.json(
      {
        ...tokenRoomBasePayload(),
        rooms: [],
        error: "Token room listing failed",
        message,
      },
      { status: 500 },
    );
  }
}
