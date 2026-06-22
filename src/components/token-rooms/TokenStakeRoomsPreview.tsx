"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  RACETE_TEST_TOKEN_MINT,
  RACETE_TOKEN_MINT,
  TOKEN_ROOM_DECIMALS,
  TOKEN_ROOM_FEE_BPS,
  TOKEN_ROOM_MAX_PLAYERS,
  TOKEN_ROOM_MIN_PLAYERS,
  TOKEN_STAKE_PRESET_CONFIGS,
  TOKEN_STAKE_ROOMS_ENABLED,
  TOKEN_STAKE_ROOMS_TEST_MODE,
  TOKEN_TREASURY_WALLET,
  TOKEN_WEEKLY_REWARD_WALLET,
  calculateTokenRoomPoolBreakdown,
} from "@/config/token-rooms";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const BALANCE_FETCH_TIMEOUT_MS = 8_000;

function formatRacete(amount: number): string {
  return `${amount.toLocaleString("en-US")} RACETE`;
}

function shortAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function formatTestRaceteBalance(amount: number): string {
  const formatted = amount.toLocaleString("en-US", {
    maximumFractionDigits: TOKEN_ROOM_DECIMALS,
  });
  return `${formatted} TEST RACETE`;
}

function formatLastChecked(date: Date | null): string {
  if (!date) return "Never";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

type BalanceStatus = "disconnected" | "loading" | "ready" | "error";

export function TokenStakeRoomsPreview() {
  const { connection } = useConnection();
  const { connected, publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() || "";
  const [balanceStatus, setBalanceStatus] = useState<BalanceStatus>("disconnected");
  const [testTokenBalance, setTestTokenBalance] = useState(0);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const balanceReadIdRef = useRef(0);

  const exampleStake = 10_000;
  const examplePlayers = 6;
  const examplePool = exampleStake * examplePlayers;
  const breakdown = calculateTokenRoomPoolBreakdown(examplePool);

  const readTestTokenBalance = useCallback(async () => {
    const requestId = balanceReadIdRef.current + 1;
    balanceReadIdRef.current = requestId;

    if (!connected || !publicKey) {
      setBalanceStatus("disconnected");
      setTestTokenBalance(0);
      setBalanceError(null);
      setLastChecked(null);
      return;
    }

    setBalanceStatus("loading");
    setBalanceError(null);

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let nextStatus: BalanceStatus = "ready";

    try {
      // Query both Tokenkeg and Token-2022 token programs.
      // Token-2022 mints (owner=TokenzQ) are not returned by
      // a Tokenkeg-only balance reader.
      const fetchBoth = Promise.allSettled([
        connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID }),
        connection.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_2022_PROGRAM_ID }),
      ]);

      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Token balance RPC read timed out")), BALANCE_FETCH_TIMEOUT_MS);
      });

      const results = await Promise.race([fetchBoth, timeout]);
      if (balanceReadIdRef.current !== requestId) return;

      const rejectedResults = results.filter((result) => result.status === "rejected");
      for (const result of rejectedResults) {
        console.warn("[TokenStakeRoomsPreview] token account query rejected:", result.reason);
      }
      if (rejectedResults.length > 0) {
        throw new Error("One or more token account RPC reads failed");
      }

      let balance = 0;

      for (const result of results) {
        if (result.status !== "fulfilled") continue;

        const accounts = result.value.value as Array<{
          account: {
            data: {
              parsed: {
                info: {
                  mint?: string;
                  tokenAmount?: { uiAmount?: number | null; amount?: string; decimals?: number };
                };
              };
            };
          };
        }>;
        if (!Array.isArray(accounts)) continue;

        for (const account of accounts) {
          const info = account.account.data.parsed.info;
          if (info.mint !== RACETE_TEST_TOKEN_MINT) continue;

          const tokenAmount = info.tokenAmount;
          if (tokenAmount?.uiAmount != null) {
            balance += tokenAmount.uiAmount;
          } else if (tokenAmount?.amount != null && tokenAmount.decimals != null) {
            balance += Number(tokenAmount.amount) / 10 ** tokenAmount.decimals;
          }
        }
      }

      setTestTokenBalance(balance);
      setLastChecked(new Date());
    } catch (err) {
      if (balanceReadIdRef.current !== requestId) return;
      console.warn("[TokenStakeRoomsPreview] balance fetch failed:", err);
      setTestTokenBalance(0);
      setBalanceError("Balance unavailable — RPC read failed.");
      nextStatus = "error";
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (balanceReadIdRef.current === requestId) {
        setBalanceStatus(nextStatus);
      }
    }
  }, [connected, connection, publicKey]);

  // Auto-fetch on wallet connect / reconnect.
  useEffect(() => {
    void readTestTokenBalance();
    return () => {
      balanceReadIdRef.current += 1;
    };
  }, [readTestTokenBalance]);

  return (
    <section className="w-full max-w-4xl rounded-[2rem] border border-cyan-300/20 bg-cyan-300/[0.05] p-6 text-white shadow-2xl shadow-cyan-950/20">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-200">
              Token Stake Rooms
            </span>
            <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-amber-200">
              Coming Soon / Test Mode
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-black">SPL token stake races are disabled.</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/65">
            Token rooms are in test/spec mode. No real deposits are enabled. Free Multiplayer and Race Cash rewards stay
            separate.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-xs text-white/60">
          <p className="font-bold text-white">Feature flags</p>
          <p className="mt-1">Enabled: {String(TOKEN_STAKE_ROOMS_ENABLED)}</p>
          <p>Test mode: {String(TOKEN_STAKE_ROOMS_TEST_MODE)}</p>
        </div>
      </div>

      {/* Read-only test token balance */}
      <div className="mt-5 rounded-2xl border border-lime-300/20 bg-lime-300/[0.06] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-lime-200/70">
              Test RACETE Balance
            </p>

            <div className="mt-2 text-2xl font-black text-lime-200">
              {balanceStatus === "loading" && "Loading test balance…"}
              {balanceStatus === "ready" && formatTestRaceteBalance(testTokenBalance)}
              {balanceStatus === "disconnected" && "Connect wallet to check"}
              {balanceStatus === "error" && "Balance unavailable"}
            </div>

            {balanceStatus === "ready" && (
              <p className="mt-1 text-[11px] text-lime-50/45">
                Last checked: {formatLastChecked(lastChecked)}
              </p>
            )}

            <p className="mt-2 text-xs text-lime-50/55">
              Read-only balance check. Token deposits are not enabled yet.
            </p>

            {balanceStatus === "error" && (
              <p className="mt-2 rounded-xl border border-red-300/20 bg-red-400/10 px-3 py-2 text-xs text-red-100/80">
                {balanceError || "Balance unavailable — RPC read failed."}
              </p>
            )}

            <button
              onClick={() => void readTestTokenBalance()}
              disabled={!connected}
              className={`mt-3 rounded-full border px-4 py-2 text-xs font-bold transition
                ${
                  connected
                    ? "border-lime-300/40 bg-lime-300/[0.10] text-lime-200 hover:border-lime-300/60 hover:bg-lime-300/[0.18]"
                    : "cursor-not-allowed border-white/10 bg-white/[0.04] text-white/35"
                }`}
            >
              {balanceStatus === "loading" ? "Refreshing…" : "Refresh balance"}
            </button>
          </div>

          <dl className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-4 text-xs">
            <TokenConfigRow
              label="Connected wallet"
              value={walletAddress ? shortAddress(walletAddress) : "Not connected"}
            />
            <TokenConfigRow label="Test token mint" value={RACETE_TEST_TOKEN_MINT} />
            <TokenConfigRow label="Production mint" value="Not provided yet" muted />
          </dl>
        </div>
      </div>

      {/* Test-only warning */}
      <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-3 text-xs text-amber-100/70">
        ⚠ This checks only the temporary test token. Production token rooms are not live.
      </div>

      {/* Disabled stake presets */}
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {TOKEN_STAKE_PRESET_CONFIGS.map((preset) => (
          <div
            key={preset.amount}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 opacity-70"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-white/35">Disabled stake preset</p>
            <p className="mt-1 text-lg font-black text-cyan-100">{preset.label}</p>
          </div>
        ))}
      </div>

      {/* Pool distribution + config */}
      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-white/40">Pool distribution</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Metric label="Creator fee" value={`${TOKEN_ROOM_FEE_BPS.creatorFeeBps / 100}%`} muted />
            <Metric label="Weekly reward pool" value={`${TOKEN_ROOM_FEE_BPS.weeklyRewardBps / 100}%`} />
            <Metric label="Treasury fee" value={`${TOKEN_ROOM_FEE_BPS.treasuryFeeBps / 100}%`} />
            <Metric label="Player payout pool" value={`${TOKEN_ROOM_FEE_BPS.playerPayoutBps / 100}%`} highlight />
          </div>
          <p className="mt-4 text-xs text-white/45">
            Example: {examplePlayers} players × {formatRacete(exampleStake)} = {formatRacete(examplePool)} pool →{" "}
            {formatRacete(breakdown.playerPayoutPoolAmount)} player payout pool.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-white/40">Foundation config</p>
          <dl className="mt-4 space-y-3 text-xs">
            <TokenConfigRow
              label="Players"
              value={`${TOKEN_ROOM_MIN_PLAYERS}-${TOKEN_ROOM_MAX_PLAYERS}`}
            />
            <TokenConfigRow label="Treasury wallet" value={TOKEN_TREASURY_WALLET} />
            <TokenConfigRow label="Weekly wallet" value={TOKEN_WEEKLY_REWARD_WALLET} />
          </dl>
        </div>
      </div>

      {/* Disabled safety state */}
      <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100/80">
        <strong className="text-amber-200">Disabled safety state:</strong> Create Token Room, Join Token Room, and Deposit
        actions are intentionally unavailable. Phase B.2 only reads the connected wallet's test token balance.
      </div>

      {/* Disabled action buttons */}
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          disabled
          className="cursor-not-allowed rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white/35"
        >
          Create Token Room
        </button>
        <button
          disabled
          className="cursor-not-allowed rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white/35"
        >
          Join Token Room
        </button>
        <button
          disabled
          className="cursor-not-allowed rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white/35"
        >
          Deposit Disabled
        </button>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  highlight = false,
  muted = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">{label}</p>
      <p
        className={`mt-1 text-xl font-black ${
          highlight ? "text-lime-300" : muted ? "text-white/45" : "text-cyan-200"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function TokenConfigRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div>
      <dt className="text-white/35">{label}</dt>
      <dd className={`mt-1 break-all font-mono ${muted ? "text-white/35" : "text-white/70"}`}>
        {value}
      </dd>
    </div>
  );
}
