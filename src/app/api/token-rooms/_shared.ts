import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  RACETE_TEST_TOKEN_MINT,
  RACETE_TOKEN_MINT,
  TOKEN_ROOM_DECIMALS,
  TOKEN_ROOM_DISABLED_MESSAGE,
  TOKEN_ROOM_FEE_BPS,
  TOKEN_ROOM_MAX_PLAYERS,
  TOKEN_ROOM_MIN_PLAYERS,
  TOKEN_STAKE_PRESET_CONFIGS,
  TOKEN_STAKE_PRESETS,
  TOKEN_STAKE_ROOMS_ENABLED,
  TOKEN_STAKE_ROOMS_TEST_MODE,
  TOKEN_TREASURY_WALLET,
  TOKEN_WEEKLY_REWARD_WALLET,
  getActiveTokenMint,
  getTokenRoomMode,
  toTokenBaseUnits,
} from "@/config/token-rooms";
import type { TokenStakeAmount } from "@/types/token-rooms";

export const WALLET_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const DRY_RUN_ROOM_STATUSES = ["created", "depositing"] as const;
const ROOM_TTL_HOURS = 2;

type DbTokenRoomRow = {
  id: string;
  room_id: string;
  token_mint: string;
  stake_amount: string | number;
  stake_decimals: number;
  stake_preset: string;
  creator_wallet_address: string;
  min_players: number;
  max_players: number;
  confirmed_player_count: number;
  status: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

type DbTokenRoomPlayerRow = {
  id: string;
  room_id: string;
  wallet_address: string;
  is_creator: boolean;
  status: string;
  deposit_status: string;
  joined_at: string;
  created_at: string;
};

export type DryRunTokenRoomPlayer = {
  walletAddress: string;
  isCreator: boolean;
  status: string;
  dryRunDepositStatus: "not_required";
  dbDepositStatus: string;
  joinedAt: string;
};

export type DryRunTokenRoom = {
  id: string;
  roomId: string;
  tokenMint: string;
  stakeAmount: number;
  stakeAmountBaseUnits: string;
  stakePreset: TokenStakeAmount;
  maxPlayers: number;
  playerCount: number;
  confirmedPlayerCount: number;
  status: string;
  dryRunStatus: "waiting" | "full" | "closed";
  creatorWalletAddress: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  players: DryRunTokenRoomPlayer[];
};

export function tokenRoomConfigPayload() {
  return {
    testTokenMint: RACETE_TEST_TOKEN_MINT,
    productionTokenMint: RACETE_TOKEN_MINT,
    activeTokenMint: getActiveTokenMint(),
    treasuryWallet: TOKEN_TREASURY_WALLET,
    weeklyRewardWallet: TOKEN_WEEKLY_REWARD_WALLET,
    stakePresets: TOKEN_STAKE_PRESET_CONFIGS,
    feeBps: TOKEN_ROOM_FEE_BPS,
    minPlayers: TOKEN_ROOM_MIN_PLAYERS,
    maxPlayers: TOKEN_ROOM_MAX_PLAYERS,
    decimals: TOKEN_ROOM_DECIMALS,
    dryRun: {
      enabled: TOKEN_STAKE_ROOMS_TEST_MODE,
      realDepositsEnabled: false,
      message: "Dry-run room only. No RACETE deposit will be requested or transferred.",
    },
  };
}

export function tokenRoomBasePayload() {
  return {
    enabled: TOKEN_STAKE_ROOMS_ENABLED,
    testMode: TOKEN_STAKE_ROOMS_TEST_MODE,
    mode: getTokenRoomMode(),
    dryRunEnabled: TOKEN_STAKE_ROOMS_TEST_MODE,
    realDepositsEnabled: false,
    message: TOKEN_ROOM_DISABLED_MESSAGE,
    dryRunMessage: "Dry-run room only. No RACETE deposit will be requested or transferred.",
    config: tokenRoomConfigPayload(),
  };
}

export function tokenRoomDisabledResponse(action: string, status = 403) {
  return NextResponse.json(
    {
      ...tokenRoomBasePayload(),
      action,
      error: TOKEN_ROOM_DISABLED_MESSAGE,
      message: "Token Stake Rooms real-money actions are disabled. No deposits, transfers, payouts, or real room actions are enabled.",
    },
    { status },
  );
}

export function tokenRoomDryRunUnavailableResponse(action: string, status = 403) {
  return NextResponse.json(
    {
      ...tokenRoomBasePayload(),
      action,
      error: "Token Stake Rooms dry-run mode is unavailable.",
      message: "Dry-run room lifecycle requires TOKEN_STAKE_ROOMS_TEST_MODE=true. Real token movement remains disabled.",
    },
    { status },
  );
}

export function isMissingTokenRoomTableError(error: unknown): boolean {
  const maybe = error as { code?: string; message?: string; details?: string } | null;
  const text = `${maybe?.code || ""} ${maybe?.message || ""} ${maybe?.details || ""}`.toLowerCase();
  return text.includes("pgrst205") || text.includes("42p01") || text.includes("token_rooms") && text.includes("does not exist");
}

export function validateWalletAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return WALLET_RE.test(trimmed) ? trimmed : null;
}

export function validateStakeAmount(value: unknown): TokenStakeAmount | null {
  const amount = typeof value === "string" ? Number(value.replace(/,/g, "")) : Number(value);
  if (!Number.isInteger(amount)) return null;
  return (TOKEN_STAKE_PRESETS as readonly number[]).includes(amount) ? (amount as TokenStakeAmount) : null;
}

export function validateMaxPlayers(value: unknown): number | null {
  const maxPlayers = Number(value);
  if (!Number.isInteger(maxPlayers)) return null;
  if (maxPlayers < TOKEN_ROOM_MIN_PLAYERS || maxPlayers > TOKEN_ROOM_MAX_PLAYERS) return null;
  return maxPlayers;
}

export function stakePresetKey(amount: TokenStakeAmount): string {
  return String(amount);
}

export function createRoomId(): string {
  return `dry_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function getRoomExpiresAt(): string {
  return new Date(Date.now() + ROOM_TTL_HOURS * 60 * 60 * 1000).toISOString();
}

export async function ensureDryRunPlayer(walletAddress: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("players")
    .upsert(
      { wallet_address: walletAddress, last_login: new Date().toISOString() },
      { onConflict: "wallet_address", ignoreDuplicates: false },
    );

  if (error) throw error;
}

export function mapDryRunRoom(row: DbTokenRoomRow, playerRows: DbTokenRoomPlayerRow[]): DryRunTokenRoom {
  const playerCount = playerRows.length;
  const maxPlayers = Number(row.max_players);
  const status = String(row.status);
  const dryRunStatus = !DRY_RUN_ROOM_STATUSES.includes(status as (typeof DRY_RUN_ROOM_STATUSES)[number])
    ? "closed"
    : playerCount >= maxPlayers
      ? "full"
      : "waiting";

  return {
    id: row.id,
    roomId: row.room_id,
    tokenMint: row.token_mint,
    stakeAmount: Number(row.stake_preset || row.stake_amount),
    stakeAmountBaseUnits: toTokenBaseUnits(Number(row.stake_preset || row.stake_amount)),
    stakePreset: Number(row.stake_preset) as TokenStakeAmount,
    maxPlayers,
    playerCount,
    confirmedPlayerCount: Number(row.confirmed_player_count || playerCount),
    status,
    dryRunStatus,
    creatorWalletAddress: row.creator_wallet_address,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
    players: playerRows.map((player) => ({
      walletAddress: player.wallet_address,
      isCreator: Boolean(player.is_creator),
      status: player.status,
      dryRunDepositStatus: "not_required",
      dbDepositStatus: player.deposit_status,
      joinedAt: player.joined_at || player.created_at,
    })),
  };
}

export async function fetchDryRunRooms(roomId?: string) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  let query = supabase
    .from("token_rooms")
    .select(
      "id, room_id, token_mint, stake_amount, stake_decimals, stake_preset, creator_wallet_address, min_players, max_players, confirmed_player_count, status, created_at, updated_at, expires_at",
    )
    .in("status", [...DRY_RUN_ROOM_STATUSES])
    .eq("token_mint", getActiveTokenMint())
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(25);

  if (roomId) query = query.eq("room_id", roomId).limit(1);

  const { data: roomRows, error: roomError } = await query;
  if (roomError) throw roomError;

  const rooms = (roomRows || []) as DbTokenRoomRow[];
  if (rooms.length === 0) return [];

  const roomIds = rooms.map((room) => room.room_id);
  const { data: playerRows, error: playerError } = await supabase
    .from("token_room_players")
    .select("id, room_id, wallet_address, is_creator, status, deposit_status, joined_at, created_at")
    .in("room_id", roomIds)
    .order("created_at", { ascending: true });

  if (playerError) throw playerError;

  const playersByRoom = new Map<string, DbTokenRoomPlayerRow[]>();
  for (const player of (playerRows || []) as DbTokenRoomPlayerRow[]) {
    const list = playersByRoom.get(player.room_id) || [];
    list.push(player);
    playersByRoom.set(player.room_id, list);
  }

  return rooms.map((room) => mapDryRunRoom(room, playersByRoom.get(room.room_id) || []));
}
