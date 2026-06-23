import { NextRequest, NextResponse } from "next/server";
import {
  PublicKey,
} from "@solana/web3.js";
import {
  getActiveTokenMint,
  getTokenRoomDepositWallet,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_ROOM_DECIMALS,
} from "@/config/token-rooms";
import {
  fetchDryRunRoom,
  isMissingTokenRoomTableError,
  isWalletInRoom,
  tokenRoomBasePayload,
  tokenRoomDryRunUnavailableResponse,
  validateWalletAddress,
} from "../_shared";

function parseBodyWallet(value: unknown): string | null {
  return validateWalletAddress(value);
}

function setupError(message: string, status = 503) {
  return NextResponse.json(
    {
      ...tokenRoomBasePayload(),
      error: message,
      message,
    },
    { status },
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const roomId = typeof body.roomId === "string" && body.roomId.trim() ? body.roomId.trim() : null;
    const walletAddress = parseBodyWallet(body.walletAddress);

    if (!roomId) {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "roomId is required" }, { status: 400 });
    }
    if (!walletAddress) {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "Valid walletAddress is required" }, { status: 400 });
    }

    const depositWallet = getTokenRoomDepositWallet();
    if (!depositWallet) {
      return setupError("TOKEN_ROOM_DEPOSIT_WALLET is not configured. Deposits are unavailable until the public vault wallet is set.");
    }

    try {
      // Validate configured public keys before any DB work that could imply a deposit is possible.
      new PublicKey(depositWallet);
      new PublicKey(getActiveTokenMint());
      new PublicKey(walletAddress);
    } catch {
      return setupError("Token room deposit wallet or mint configuration is invalid.");
    }

    const room = await fetchDryRunRoom(roomId);
    if (!room) {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "Token room not found" }, { status: 404 });
    }
    if (room.tokenMint !== getActiveTokenMint()) {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "Room mint does not match active RACETE test mint" }, { status: 409 });
    }
    if (!isWalletInRoom(room, walletAddress)) {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "Wallet is not a member of this token room" }, { status: 403 });
    }

    const player = room.players.find((entry) => entry.walletAddress === walletAddress);
    if (player?.dbDepositStatus === "confirmed") {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "Deposit already confirmed for this wallet and room", room }, { status: 409 });
    }

    return NextResponse.json({
      ...tokenRoomBasePayload(),
      realDepositsEnabled: true,
      testDepositsEnabled: true,
      roomId: room.roomId,
      walletAddress,
      depositWallet,
      mint: getActiveTokenMint(),
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      amountUi: room.stakeAmount,
      amountBaseUnits: room.stakeAmountBaseUnits,
      decimals: TOKEN_ROOM_DECIMALS,
      destinationTokenAccount: null,
      instructions: [
        "Build a user-signed Token-2022 transferChecked transaction for the exact stake amount.",
        "Destination token account must be owned by TOKEN_ROOM_DEPOSIT_WALLET.",
        "After wallet sends the transaction, call /api/token-rooms/confirm-deposit with the returned tx signature.",
      ],
      warning: "You are depositing RACETE for this room only. Payouts are not automatic yet.",
      room,
    });
  } catch (error) {
    if (isMissingTokenRoomTableError(error)) {
      return NextResponse.json({ ...tokenRoomBasePayload(), error: "Token room tables are not available" }, { status: 503 });
    }
    console.error("[token-rooms/deposit-intent] failed:", error);
    return NextResponse.json({ ...tokenRoomBasePayload(), error: "Deposit intent failed" }, { status: 500 });
  }
}
