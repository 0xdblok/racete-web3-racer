import crypto from "node:crypto";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  getActiveTokenMint,
  getPlayerPayoutSplit,
  getTokenRoomDepositWallet,
  getTokenRoomVaultPrivateKeyBase64,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_ROOM_DECIMALS,
  TOKEN_ROOM_FEE_BPS,
  TOKEN_TREASURY_WALLET,
  TOKEN_WEEKLY_REWARD_WALLET,
} from "@/config/token-rooms";
import { fetchDryRunRoom, writeTokenRoomEvent } from "./_shared";

export type TokenRoomRaceResultInput = {
  walletAddress: string;
  placement?: number;
  finishStatus: "finished" | "dnf" | "dq" | "disconnected";
  finishTimeMs?: number;
  laps?: number;
  checkpoints?: number;
};

export type SettlementRow = {
  payoutType: "weekly_reward_pool" | "treasury_fee" | "winner_payout" | "rounding_dust";
  recipientWallet: string;
  amountBaseUnits: bigint;
  placement?: number | null;
  payoutRank?: number | null;
  walletAddress?: string | null;
};

export type SettlementPreview = {
  roomId: string;
  totalPoolBaseUnits: string;
  weeklyAmountBaseUnits: string;
  treasuryAmountBaseUnits: string;
  playerPayoutPoolBaseUnits: string;
  roundingDustBaseUnits: string;
  rows: Array<{
    payoutType: SettlementRow["payoutType"];
    recipientWallet: string;
    walletAddress?: string | null;
    amountBaseUnits: string;
    placement?: number | null;
    payoutRank?: number | null;
  }>;
};

type DbRoom = {
  room_id: string;
  token_mint: string;
  status: string;
  race_id?: string | null;
  max_players: number;
  confirmed_player_count: number;
  manual_review_reason?: string | null;
};

type DbPlayer = {
  room_id: string;
  wallet_address: string;
  deposit_status: string;
  final_race_status?: string | null;
  placement?: number | null;
  payout_rank?: number | null;
  finish_time_ms?: number | null;
  suspicious_events?: number | null;
  speed_violations?: number | null;
  teleport_violations?: number | null;
  checkpoint_violations?: number | null;
  out_of_order_violations?: number | null;
  dq_reason?: string | null;
};

type DbDeposit = {
  room_id: string;
  wallet_address: string;
  status: string;
  amount_base_units?: string | number | null;
  stake_amount?: string | number | null;
};

export function toBigIntAmount(value: string | number | null | undefined): bigint {
  if (value === null || value === undefined) return BigInt(0);
  return BigInt(String(value).split(".")[0]);
}

function bps(amount: bigint, bpsValue: number): bigint {
  return (amount * BigInt(bpsValue)) / BigInt(10_000);
}

function settlementHash(input: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export function serializeSettlement(preview: SettlementPreview) {
  return preview;
}

export async function fetchSettlementInputs(roomId: string) {
  const supabase = getSupabaseAdmin();
  const { data: room, error: roomError } = await supabase
    .from("token_rooms")
    .select("room_id, token_mint, status, race_id, max_players, confirmed_player_count, manual_review_reason")
    .eq("room_id", roomId)
    .maybeSingle();
  if (roomError) throw roomError;
  if (!room) throw new Error("Token room not found");

  const { data: players, error: playersError } = await supabase
    .from("token_room_players")
    .select("room_id, wallet_address, deposit_status, final_race_status, placement, payout_rank, finish_time_ms, suspicious_events, speed_violations, teleport_violations, checkpoint_violations, out_of_order_violations, dq_reason")
    .eq("room_id", roomId);
  if (playersError) throw playersError;

  const { data: deposits, error: depositError } = await supabase
    .from("token_deposits")
    .select("room_id, wallet_address, status, amount_base_units, stake_amount")
    .eq("room_id", roomId)
    .eq("status", "confirmed");
  if (depositError) throw depositError;

  return { room: room as DbRoom, players: (players || []) as DbPlayer[], deposits: (deposits || []) as DbDeposit[] };
}

export function calculateSettlement(room: DbRoom, players: DbPlayer[], deposits: DbDeposit[]): SettlementPreview {
  if (room.token_mint !== getActiveTokenMint()) throw new Error("Token room mint mismatch");
  if (!deposits.length) throw new Error("No confirmed deposits for this token room");
  if (players.length === 0) throw new Error("Token room has no players");
  if (players.some((player) => player.deposit_status !== "confirmed")) {
    throw new Error("All joined players must have confirmed deposits before settlement");
  }

  const totalPool = deposits.reduce((sum, deposit) => sum + toBigIntAmount(deposit.amount_base_units ?? deposit.stake_amount), BigInt(0));
  if (totalPool <= BigInt(0)) throw new Error("Confirmed room pool is zero");

  const suspicious = players.find((player) =>
    (player.suspicious_events || 0) > 0 ||
    (player.speed_violations || 0) > 0 ||
    (player.teleport_violations || 0) > 0 ||
    (player.checkpoint_violations || 0) > 0 ||
    (player.out_of_order_violations || 0) > 0 ||
    Boolean(player.dq_reason),
  );
  if (suspicious) throw new Error("Room requires manual review because suspicious/DQ flags exist");

  const validFinishers = players
    .filter((player) => player.final_race_status === "finished" && player.placement && player.placement > 0)
    .sort((a, b) => Number(a.placement || 999) - Number(b.placement || 999));
  if (validFinishers.length === 0) throw new Error("No valid finishers; manual review required");

  const weeklyAmount = bps(totalPool, TOKEN_ROOM_FEE_BPS.weeklyRewardBps);
  const treasuryFee = bps(totalPool, TOKEN_ROOM_FEE_BPS.treasuryFeeBps);
  const playerPayoutPool = totalPool - weeklyAmount - treasuryFee;
  const rows: SettlementRow[] = [
    { payoutType: "weekly_reward_pool", recipientWallet: TOKEN_WEEKLY_REWARD_WALLET, amountBaseUnits: weeklyAmount },
    { payoutType: "treasury_fee", recipientWallet: TOKEN_TREASURY_WALLET, amountBaseUnits: treasuryFee },
  ];

  const split = getPlayerPayoutSplit(validFinishers.length);
  let allocatedPlayerPayout = BigInt(0);
  for (const splitRow of split) {
    const finisher = validFinishers[splitRow.rank - 1];
    if (!finisher) continue;
    const amount = splitRow.rank === split.length
      ? playerPayoutPool - allocatedPlayerPayout
      : bps(playerPayoutPool, splitRow.bps);
    allocatedPlayerPayout += amount;
    rows.push({
      payoutType: "winner_payout",
      recipientWallet: finisher.wallet_address,
      walletAddress: finisher.wallet_address,
      amountBaseUnits: amount,
      placement: finisher.placement || splitRow.rank,
      payoutRank: splitRow.rank,
    });
  }

  const totalRows = rows.reduce((sum, row) => sum + row.amountBaseUnits, BigInt(0));
  const roundingDust = totalPool - totalRows;
  if (roundingDust < BigInt(0)) throw new Error("Settlement payouts exceed confirmed room pool");
  if (roundingDust > BigInt(0)) {
    rows.push({ payoutType: "rounding_dust", recipientWallet: TOKEN_TREASURY_WALLET, amountBaseUnits: roundingDust });
  }

  return {
    roomId: room.room_id,
    totalPoolBaseUnits: totalPool.toString(),
    weeklyAmountBaseUnits: weeklyAmount.toString(),
    treasuryAmountBaseUnits: treasuryFee.toString(),
    playerPayoutPoolBaseUnits: playerPayoutPool.toString(),
    roundingDustBaseUnits: roundingDust.toString(),
    rows: rows.filter((row) => row.amountBaseUnits > BigInt(0)).map((row) => ({
      payoutType: row.payoutType,
      recipientWallet: row.recipientWallet,
      walletAddress: row.walletAddress || null,
      amountBaseUnits: row.amountBaseUnits.toString(),
      placement: row.placement || null,
      payoutRank: row.payoutRank || null,
    })),
  };
}

export async function insertPendingPayoutRows(preview: SettlementPreview, raceId?: string | null) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const rows = preview.rows.map((row) => ({
    room_id: preview.roomId,
    race_id: raceId || null,
    wallet_address: row.walletAddress || null,
    recipient_wallet_address: row.recipientWallet,
    recipient_wallet: row.recipientWallet,
    token_mint: getActiveTokenMint(),
    amount: row.amountBaseUnits,
    amount_base_units: row.amountBaseUnits,
    payout_type: row.payoutType,
    placement: row.placement || null,
    payout_rank: row.payoutRank || null,
    status: "pending_execution",
    idempotency_key: `${preview.roomId}:${row.payoutType}:${row.recipientWallet}:${row.payoutRank || 0}:${row.placement || 0}`,
    metadata: { settlement: preview, noGlobalVaultBalanceMath: true },
    planned_at: now,
    created_at: now,
    updated_at: now,
  }));

  const { error } = await supabase.from("token_payouts").insert(rows);
  if (error) throw error;
}

export async function markManualReview(roomId: string, reason: string) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  await supabase
    .from("token_rooms")
    .update({ status: "manual_review", manual_review_reason: reason, updated_at: now, finalized_at: now })
    .eq("room_id", roomId);
  await writeTokenRoomEvent({ roomId, eventType: "manual_review", severity: "warning", payload: { reason } });
}

export function loadVaultSigner() {
  const secret = getTokenRoomVaultPrivateKeyBase64();
  if (!secret) throw new Error("TOKEN_ROOM_VAULT_PRIVATE_KEY_BASE64 is not configured");
  const bytes = Buffer.from(secret, "base64");
  const signer = Keypair.fromSecretKey(Uint8Array.from(bytes));
  const expectedVault = getTokenRoomDepositWallet();
  if (signer.publicKey.toBase58() !== expectedVault) {
    throw new Error("Vault signer public key does not match TOKEN_ROOM_DEPOSIT_WALLET");
  }
  return signer;
}

export function getTokenConnection() {
  const rpc = (process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC || "https://solana-rpc.publicnode.com").trim();
  return new Connection(rpc, "confirmed");
}

export async function executePayoutRows(roomId: string) {
  const supabase = getSupabaseAdmin();
  const signer = loadVaultSigner();
  const connection = getTokenConnection();
  const mint = new PublicKey(getActiveTokenMint());
  const tokenProgram = new PublicKey(TOKEN_2022_PROGRAM_ID);
  const vaultOwner = new PublicKey(getTokenRoomDepositWallet());
  const vaultAta = getAssociatedTokenAddressSync(mint, vaultOwner, false, tokenProgram, ASSOCIATED_TOKEN_PROGRAM_ID);

  const { data: payoutRows, error } = await supabase
    .from("token_payouts")
    .select("id, room_id, payout_type, recipient_wallet_address, amount, amount_base_units, status, payout_signature, tx_signature, execution_attempts")
    .eq("room_id", roomId)
    .in("status", ["pending_execution", "failed"])
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = payoutRows || [];
  const vaultBalance = await connection.getTokenAccountBalance(vaultAta);
  const needed = rows.reduce((sum, row) => sum + toBigIntAmount(row.amount_base_units ?? row.amount), BigInt(0));
  if (toBigIntAmount(vaultBalance.value.amount) < needed) {
    throw new Error("Vault RACETE balance is lower than unpaid payout total");
  }

  const paid: Array<{ id: string; txSignature: string; recipientWallet: string; amountBaseUnits: string; payoutType: string }> = [];
  for (const row of rows) {
    if (row.payout_signature || row.tx_signature) continue;
    const amount = toBigIntAmount(row.amount_base_units ?? row.amount);
    if (amount <= BigInt(0)) continue;

    const now = new Date().toISOString();
    const lockId = crypto.randomUUID();
    const { error: lockError } = await supabase
      .from("token_payouts")
      .update({ status: "executing", execution_lock_id: lockId, execution_locked_at: now, execution_attempts: Number(row.execution_attempts || 0) + 1, updated_at: now })
      .eq("id", row.id)
      .in("status", ["pending_execution", "failed"])
      .is("payout_signature", null);
    if (lockError) throw lockError;

    try {
      const recipient = new PublicKey(row.recipient_wallet_address);
      const destAta = getAssociatedTokenAddressSync(mint, recipient, false, tokenProgram, ASSOCIATED_TOKEN_PROGRAM_ID);
      const transaction = new Transaction();
      const destInfo = await connection.getAccountInfo(destAta);
      if (!destInfo) {
        transaction.add(createAssociatedTokenAccountInstruction(signer.publicKey, destAta, recipient, mint, tokenProgram, ASSOCIATED_TOKEN_PROGRAM_ID));
      }
      transaction.add(createTransferCheckedInstruction(vaultAta, mint, destAta, signer.publicKey, amount, TOKEN_ROOM_DECIMALS, [], tokenProgram));
      const txSignature = await sendAndConfirmTransaction(connection, transaction, [signer], { commitment: "confirmed" });
      const paidAt = new Date().toISOString();
      const signatureStatus = await connection.getSignatureStatus(txSignature, { searchTransactionHistory: true });
      await supabase
        .from("token_payouts")
        .update({
          status: "paid",
          payout_signature: txSignature,
          tx_signature: txSignature,
          signature_status: signatureStatus.value?.confirmationStatus || "confirmed",
          paid_at: paidAt,
          confirmed_at: paidAt,
          sent_at: paidAt,
          updated_at: paidAt,
          failure_reason: null,
        })
        .eq("id", row.id)
        .eq("execution_lock_id", lockId);
      paid.push({ id: row.id, txSignature, recipientWallet: row.recipient_wallet_address, amountBaseUnits: amount.toString(), payoutType: row.payout_type });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payout execution failed";
      await supabase
        .from("token_payouts")
        .update({ status: "failed", failure_reason: message, failed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("execution_lock_id", lockId);
      throw error;
    }
  }

  return paid;
}

export async function buildSettlementPreview(roomId: string) {
  const { room, players, deposits } = await fetchSettlementInputs(roomId);
  return { room, players, deposits, preview: calculateSettlement(room, players, deposits) };
}

export async function updateRoomSettlementAmounts(preview: SettlementPreview, status: string) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  const totalPayout = preview.rows.reduce((sum, row) => sum + toBigIntAmount(row.amountBaseUnits), BigInt(0));
  const { error } = await supabase
    .from("token_rooms")
    .update({
      status,
      confirmed_pool_amount: preview.totalPoolBaseUnits,
      weekly_reward_amount: preview.weeklyAmountBaseUnits,
      treasury_fee_amount: preview.treasuryAmountBaseUnits,
      player_payout_pool_amount: preview.playerPayoutPoolBaseUnits,
      payout_total_amount: totalPayout.toString(),
      settlement_calculated_at: now,
      settlement_hash: settlementHash(preview),
      updated_at: now,
    })
    .eq("room_id", preview.roomId);
  if (error) throw error;
}

export async function fetchRoomPayoutRows(roomId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("token_payouts")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function fetchRoomWithSettlement(roomId: string) {
  const room = await fetchDryRunRoom(roomId);
  const payouts = await fetchRoomPayoutRows(roomId);
  return { room, payouts };
}
