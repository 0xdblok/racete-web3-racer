import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
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
  validateWalletAddress,
  writeTokenRoomEvent,
} from "../_shared";

const SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;

function getSolanaConnection() {
  const endpoint = (process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC || "https://solana-rpc.publicnode.com").trim();
  return new Connection(endpoint, "confirmed");
}

function jsonError(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ...tokenRoomBasePayload(), error: message, message, ...extra }, { status });
}

function keyToString(key: unknown): string {
  if (typeof key === "string") return key;
  const maybe = key as { pubkey?: { toBase58?: () => string } | string };
  if (typeof maybe?.pubkey === "string") return maybe.pubkey;
  if (maybe?.pubkey && typeof maybe.pubkey.toBase58 === "function") return maybe.pubkey.toBase58();
  return String(key || "");
}

function getTokenBalanceAmount(balances: any[] | null | undefined, accountIndex: number, mint: string): bigint | null {
  const entry = (balances || []).find((balance) => Number(balance.accountIndex) === accountIndex && balance.mint === mint);
  const amount = entry?.uiTokenAmount?.amount;
  if (typeof amount !== "string") return null;
  try {
    return BigInt(amount);
  } catch {
    return null;
  }
}

function getTokenBalanceOwner(balances: any[] | null | undefined, accountIndex: number, mint: string): string | null {
  const entry = (balances || []).find((balance) => Number(balance.accountIndex) === accountIndex && balance.mint === mint);
  return typeof entry?.owner === "string" ? entry.owner : null;
}

function collectParsedInstructions(parsedTx: any): any[] {
  const topLevel = parsedTx?.transaction?.message?.instructions || [];
  const inner = (parsedTx?.meta?.innerInstructions || []).flatMap((entry: any) => entry.instructions || []);
  return [...topLevel, ...inner].filter(Boolean);
}

function findToken2022Transfer(parsedTx: any, expectedMint: string, expectedAmount: bigint) {
  for (const instruction of collectParsedInstructions(parsedTx)) {
    const programId = String(instruction.programId?.toString?.() || instruction.programId || "");
    const parsed = instruction.parsed;
    if (programId !== TOKEN_2022_PROGRAM_ID || !parsed?.info) continue;
    if (!["transfer", "transferChecked"].includes(parsed.type)) continue;

    const info = parsed.info;
    const amountString = info.tokenAmount?.amount || info.amount;
    let amount: bigint;
    try {
      amount = BigInt(String(amountString));
    } catch {
      continue;
    }
    if (amount !== expectedAmount) continue;
    if (info.mint && info.mint !== expectedMint) continue;

    return {
      type: parsed.type,
      amount,
      mint: info.mint || expectedMint,
      source: String(info.source || ""),
      destination: String(info.destination || ""),
      authority: String(info.authority || info.owner || ""),
    };
  }
  return null;
}

async function verifyDepositTransaction({
  txSignature,
  walletAddress,
  expectedAmountBaseUnits,
  expectedMint,
  depositWallet,
}: {
  txSignature: string;
  walletAddress: string;
  expectedAmountBaseUnits: string;
  expectedMint: string;
  depositWallet: string;
}) {
  const connection = getSolanaConnection();
  const [signatureStatus, parsedTx] = await Promise.all([
    connection.getSignatureStatuses([txSignature], { searchTransactionHistory: true }),
    connection.getParsedTransaction(txSignature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }),
  ]);

  const status = signatureStatus.value[0];
  if (!status) throw new Error("Transaction signature was not found on Solana RPC.");
  if (status.err) throw new Error("Transaction failed on-chain.");
  if (status.confirmationStatus !== "confirmed" && status.confirmationStatus !== "finalized") {
    throw new Error("Transaction is not confirmed yet.");
  }
  if (!parsedTx) throw new Error("Confirmed transaction details are unavailable from RPC.");
  if (parsedTx.meta?.err) throw new Error("Transaction metadata indicates failure.");

  const expectedAmount = BigInt(expectedAmountBaseUnits);
  const transfer = findToken2022Transfer(parsedTx, expectedMint, expectedAmount);
  if (!transfer) throw new Error("No exact Token-2022 RACETE transfer for this room stake was found.");
  if (transfer.mint !== expectedMint) throw new Error("Transfer mint does not match RACETE test mint.");
  if (!transfer.source || !transfer.destination) throw new Error("Transfer source or destination token account is missing.");
  if (transfer.authority && transfer.authority !== walletAddress) throw new Error("Transfer authority does not match player wallet.");

  const destinationInfo = await connection.getParsedAccountInfo(new PublicKey(transfer.destination), "confirmed");
  const destinationParsed = (destinationInfo.value?.data as any)?.parsed?.info;
  if (!destinationParsed) throw new Error("Destination token account could not be parsed.");
  if (destinationParsed.owner !== depositWallet) throw new Error("Destination token account is not owned by TOKEN_ROOM_DEPOSIT_WALLET.");
  if (destinationParsed.mint !== expectedMint) throw new Error("Destination token account mint does not match RACETE test mint.");

  const accountKeys = (parsedTx.transaction.message.accountKeys || []).map(keyToString);
  const destinationIndex = accountKeys.findIndex((key: string) => key === transfer.destination);
  const sourceIndex = accountKeys.findIndex((key: string) => key === transfer.source);
  if (destinationIndex < 0) throw new Error("Destination token account was not present in transaction account keys.");

  const preDestination = getTokenBalanceAmount(parsedTx.meta?.preTokenBalances, destinationIndex, expectedMint) ?? BigInt(0);
  const postDestination = getTokenBalanceAmount(parsedTx.meta?.postTokenBalances, destinationIndex, expectedMint);
  if (postDestination === null) throw new Error("Destination post-token balance was not found in transaction metadata.");
  if (postDestination - preDestination !== expectedAmount) throw new Error("Destination did not receive the exact expected RACETE amount.");

  if (sourceIndex >= 0) {
    const sourceOwner = getTokenBalanceOwner(parsedTx.meta?.preTokenBalances, sourceIndex, expectedMint);
    if (sourceOwner && sourceOwner !== walletAddress) throw new Error("Source token account owner does not match player wallet.");
  }

  return {
    sourceTokenAccount: transfer.source,
    destinationTokenAccount: transfer.destination,
    vaultTokenAccount: transfer.destination,
    amountBaseUnits: expectedAmount.toString(),
    tokenProgram: TOKEN_2022_PROGRAM_ID,
    slot: status.slot || parsedTx.slot,
    confirmationLevel: status.confirmationStatus || "confirmed",
    blockTimeIso: parsedTx.blockTime ? new Date(parsedTx.blockTime * 1000).toISOString() : null,
    rawVerification: {
      transferType: transfer.type,
      sourceTokenAccount: transfer.source,
      destinationTokenAccount: transfer.destination,
      authority: transfer.authority || null,
      destinationOwner: destinationParsed.owner,
      destinationMint: destinationParsed.mint,
      destinationDelta: expectedAmount.toString(),
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
    const walletAddress = validateWalletAddress(body.walletAddress);
    const txSignature = typeof body.txSignature === "string" ? body.txSignature.trim() : "";

    if (!roomId) return jsonError("roomId is required", 400);
    if (!walletAddress) return jsonError("Valid walletAddress is required", 400);
    if (!SIGNATURE_RE.test(txSignature)) return jsonError("Valid txSignature is required", 400);

    const depositWallet = getTokenRoomDepositWallet();
    if (!depositWallet) return jsonError("TOKEN_ROOM_DEPOSIT_WALLET is not configured. Deposits are unavailable.", 503);

    const room = await fetchDryRunRoom(roomId);
    if (!room) return jsonError("Token room not found", 404);
    if (room.tokenMint !== getActiveTokenMint()) return jsonError("Room mint does not match active RACETE test mint", 409);
    if (!isWalletInRoom(room, walletAddress)) return jsonError("Wallet is not a member of this token room", 403, { room });

    const player = room.players.find((entry) => entry.walletAddress === walletAddress);
    if (player?.dbDepositStatus === "confirmed") return jsonError("Deposit already confirmed for this wallet and room", 409, { room });

    const supabase = getSupabaseAdmin();
    const { data: reusedRows, error: reusedError } = await supabase
      .from("token_deposits")
      .select("id, room_id, wallet_address, status")
      .or(`tx_signature.eq.${txSignature},deposit_signature.eq.${txSignature}`)
      .limit(1);
    if (reusedError) throw reusedError;
    if ((reusedRows || []).length > 0) return jsonError("Transaction signature has already been used for a token room deposit", 409);

    const verification = await verifyDepositTransaction({
      txSignature,
      walletAddress,
      expectedAmountBaseUnits: room.stakeAmountBaseUnits,
      expectedMint: getActiveTokenMint(),
      depositWallet,
    });

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const { data: deposit, error: depositError } = await supabase
      .from("token_deposits")
      .insert({
        room_id: room.roomId,
        wallet_address: walletAddress,
        player_wallet: walletAddress,
        token_mint: getActiveTokenMint(),
        mint: getActiveTokenMint(),
        stake_amount: verification.amountBaseUnits,
        amount_base_units: verification.amountBaseUnits,
        amount_ui: room.stakeAmount,
        source_token_account: verification.sourceTokenAccount,
        destination_token_account: verification.destinationTokenAccount,
        vault_token_account: verification.vaultTokenAccount,
        deposit_wallet: depositWallet,
        token_program: verification.tokenProgram,
        deposit_signature: txSignature,
        tx_signature: txSignature,
        signature_status: "confirmed",
        slot: verification.slot,
        block_time: verification.blockTimeIso,
        confirmation_level: verification.confirmationLevel,
        status: "confirmed",
        raw_verification: verification.rawVerification,
        submitted_at: now,
        detected_at: now,
        confirmed_at: now,
        expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (depositError) throw depositError;

    const { error: playerError } = await supabase
      .from("token_room_players")
      .update({
        status: "deposit_confirmed",
        deposit_status: "confirmed",
        deposit_id: deposit.id,
        deposit_confirmed_at: now,
        updated_at: now,
      })
      .eq("room_id", room.roomId)
      .eq("wallet_address", walletAddress)
      .neq("deposit_status", "confirmed");
    if (playerError) throw playerError;

    const { data: confirmedRows, error: countError } = await supabase
      .from("token_room_players")
      .select("wallet_address, deposit_status")
      .eq("room_id", room.roomId);
    if (countError) throw countError;

    const confirmedCount = (confirmedRows || []).filter((entry) => entry.deposit_status === "confirmed").length;
    const playerCount = (confirmedRows || []).length;
    const allDepositsConfirmed = playerCount > 0 && confirmedCount === playerCount;
    const confirmedPoolAmount = (BigInt(room.stakeAmountBaseUnits) * BigInt(confirmedCount)).toString();

    const { error: roomUpdateError } = await supabase
      .from("token_rooms")
      .update({
        status: allDepositsConfirmed ? "locked" : "depositing",
        confirmed_player_count: confirmedCount,
        confirmed_pool_amount: confirmedPoolAmount,
        vault_token_account: verification.vaultTokenAccount,
        updated_at: now,
        locked_at: allDepositsConfirmed ? now : null,
      })
      .eq("room_id", room.roomId);
    if (roomUpdateError) throw roomUpdateError;

    await writeTokenRoomEvent({
      roomId: room.roomId,
      walletAddress,
      eventType: "deposit_confirmed",
      payload: {
        txSignature,
        amountBaseUnits: verification.amountBaseUnits,
        depositWallet,
        tokenProgram: verification.tokenProgram,
        allDepositsConfirmed,
      },
    });

    const updatedRoom = await fetchDryRunRoom(room.roomId);
    return NextResponse.json({
      ...tokenRoomBasePayload(),
      realDepositsEnabled: true,
      testDepositsEnabled: true,
      depositConfirmed: true,
      txSignature,
      allDepositsConfirmed,
      warning: "RACETE deposits are real. Automatic payouts execute only after verified valid results.",
      room: updatedRoom,
    });
  } catch (error) {
    if (isMissingTokenRoomTableError(error)) return jsonError("Token room deposit tables are not available", 503);
    console.error("[token-rooms/confirm-deposit] failed:", error);
    return jsonError(error instanceof Error ? error.message : "Deposit confirmation failed", 400);
  }
}
