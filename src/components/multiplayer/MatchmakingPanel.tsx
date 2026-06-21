"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  findMatch,
  cancelMatchmaking,
  getState,
  subscribe,
  type MatchmakingState,
} from "@/lib/multiplayer/client";
import { publicEnv } from "@/lib/env";
import { MULTIPLAYER_RACE_CASH_PLACEMENT_REWARDS } from "@/config/rewards";
import { DEFAULT_TOKEN_STAKE_TIER, TOKEN_STAKE_SYMBOL, calculateStakePotPreview } from "@/config/stake-races";
import type { CarConfig } from "@/config/cars";
import type { PlayerCar } from "@/types/game";

type Props = {
  selectedCar: CarConfig & { powerRating?: number };
  playerCar: PlayerCar;
  onStateChange?: (state: MatchmakingState) => void;
};

function getDisplayedServerUrl(): string {
  if (publicEnv.gameServerUrl) return publicEnv.gameServerUrl;
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.hostname}:2567`;
  }
  return "not configured";
}

function ordinal(position: number): string {
  const mod100 = position % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${position}th`;
  if (position % 10 === 1) return `${position}st`;
  if (position % 10 === 2) return `${position}nd`;
  if (position % 10 === 3) return `${position}rd`;
  return `${position}th`;
}

const stakePreview = calculateStakePotPreview(DEFAULT_TOKEN_STAKE_TIER.stakeAmount, DEFAULT_TOKEN_STAKE_TIER.maxPlayers);

export function MatchmakingPanel({ selectedCar, playerCar, onStateChange }: Props) {
  const { publicKey, connected } = useWallet();
  const [state, setState] = useState<MatchmakingState>(getState);
  const walletAddress = publicKey?.toBase58() || "";

  // Subscribe to multiplayer state changes
  useEffect(() => {
    const unsub = subscribe(() => {
      const s = getState();
      setState(s);
      onStateChange?.(s);
    });
    return unsub;
  }, [onStateChange]);

  const handleFindMatch = useCallback(() => {
    if (!connected || !walletAddress) return;
    findMatch({
      walletAddress,
      selectedCarId: selectedCar.id,
      carName: selectedCar.name,
      carClass: selectedCar.class,
      powerRating: playerCar.power_rating ?? selectedCar.basePowerRating,
    });
  }, [connected, walletAddress, selectedCar, playerCar]);

  const handleCancel = useCallback(() => {
    cancelMatchmaking();
  }, []);

  // Idle — show Find Match button
  if (state.status === "idle") {
    return (
      <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.35em] text-lime-300">
          Multiplayer
        </p>
        <h2 className="mt-2 text-2xl font-black text-white">
          Race against others
        </h2>
        <p className="mt-2 text-sm text-white/60">
          {selectedCar.class}-class &middot; PR {playerCar.power_rating ?? selectedCar.basePowerRating}
        </p>
        {!publicEnv.gameServerUrl && (
          <p className="mt-2 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-200/80">
            No game server URL configured. Using auto-detect ({getDisplayedServerUrl()}).
          </p>
        )}

        <div className="mt-6 grid gap-4 text-left lg:grid-cols-2">
          <div className="rounded-3xl border border-lime-300/20 bg-lime-300/[0.06] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-lime-300">Free Race</p>
                <h3 className="mt-1 text-xl font-black text-white">Race Cash for everyone</h3>
              </div>
              <span className="rounded-full bg-lime-300 px-3 py-1 text-xs font-black text-black">Active</span>
            </div>
            <p className="mt-3 text-sm text-white/65">
              No on-chain stake. Finish placement decides off-chain Race Cash rewards.
            </p>
            <PlacementRewardsList />
          </div>

          <div className="rounded-3xl border border-fuchsia-300/20 bg-fuchsia-500/[0.07] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300">Token Stake Race</p>
                <h3 className="mt-1 text-xl font-black text-white">On-chain pot later + Race Cash</h3>
              </div>
              <span className="rounded-full border border-fuchsia-200/30 px-3 py-1 text-xs font-black text-fuchsia-100">Coming soon</span>
            </div>
            <p className="mt-3 text-sm text-white/65">
              Stake {TOKEN_STAKE_SYMBOL} for the future on-chain prize pool. Everyone still earns Race Cash by placement.
            </p>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/70">
              <p className="font-bold text-white">
                Stake preview: {DEFAULT_TOKEN_STAKE_TIER.stakeAmount} {TOKEN_STAKE_SYMBOL} × {DEFAULT_TOKEN_STAKE_TIER.maxPlayers} players = {stakePreview.pool} {TOKEN_STAKE_SYMBOL}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {stakePreview.payouts.filter((payout) => payout.amount > 0).map((payout) => (
                  <div key={payout.placement} className="flex justify-between rounded-xl bg-white/[0.04] px-3 py-2">
                    <span>{ordinal(payout.placement)}</span>
                    <b>{payout.amount} {TOKEN_STAKE_SYMBOL}</b>
                  </div>
                ))}
                <div className="flex justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-white/55">
                  <span>Platform fee</span>
                  <b>{stakePreview.platformFee} {TOKEN_STAKE_SYMBOL}</b>
                </div>
              </div>
            </div>
            <PlacementRewardsList compact />
          </div>
        </div>

        <button
          onClick={handleFindMatch}
          disabled={!connected}
          className="mt-6 w-full rounded-full bg-lime-300 px-6 py-3 text-base font-black text-black transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Find Match
        </button>
        {!connected && (
          <p className="mt-3 text-xs text-amber-300/80">Connect wallet first</p>
        )}
      </div>
    );
  }

  // Connecting
  if (state.status === "connecting") {
    return (
      <div className="mx-auto max-w-md rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center">
        <div className="mx-auto mb-4 size-10 animate-spin rounded-full border-2 border-lime-300 border-t-transparent" />
        <p className="text-lg font-bold text-white">Connecting to game server...</p>
        <p className="mt-2 text-xs text-white/40">{getDisplayedServerUrl()}</p>
      </div>
    );
  }

  // Searching
  if (state.status === "searching") {
    return (
      <div className="mx-auto max-w-md rounded-[2rem] border border-lime-300/20 bg-lime-300/[0.03] p-8 text-center">
        <div className="mx-auto mb-4 size-10 animate-spin rounded-full border-2 border-lime-300 border-t-transparent" />
        <p className="text-lg font-bold text-lime-200">Searching for players...</p>
        <p className="mt-1 text-sm text-white/50">
          Room: <code className="text-lime-300/70">{state.roomId?.slice(0, 12) ?? "—"}</code>
        </p>
        <p className="mt-1 text-xs text-white/40">
          Players: {state.room?.players.length ?? 0} / {state.room?.maxPlayers ?? 4}
        </p>
        <button
          onClick={handleCancel}
          className="mt-5 rounded-full border border-red-400/25 bg-red-500/10 px-5 py-2 text-sm font-bold text-red-200 transition hover:bg-red-500/20"
        >
          Cancel
        </button>
      </div>
    );
  }

  // Error
  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-md rounded-[2rem] border border-red-400/20 bg-red-500/[0.06] p-8 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.35em] text-red-300">
          Matchmaking Error
        </p>
        <p className="mt-2 text-sm text-red-100/80">{state.error || "Unknown error"}</p>
        <button
          onClick={handleCancel}
          className="mt-5 rounded-full border border-white/10 bg-white/[0.06] px-5 py-2 text-sm font-bold text-white/80 transition hover:bg-white/10"
        >
          Go back
        </button>
      </div>
    );
  }

  // Disconnected
  if (state.status === "disconnected") {
    return (
      <div className="mx-auto max-w-md rounded-[2rem] border border-amber-400/20 bg-amber-500/[0.06] p-8 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.35em] text-amber-300">
          Disconnected
        </p>
        <p className="mt-2 text-sm text-amber-100/70">
          {state.error || "Lost connection to game server."}
        </p>
        <button
          onClick={handleCancel}
          className="mt-5 rounded-full border border-white/10 bg-white/[0.06] px-5 py-2 text-sm font-bold text-white/80 transition hover:bg-white/10"
        >
          Back to matchmaking
        </button>
      </div>
    );
  }

  // Joined (lobby, countdown, racing, ended)
  return null;
}

function PlacementRewardsList({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`mt-4 grid gap-2 ${compact ? "grid-cols-2 text-xs" : "sm:grid-cols-2 text-sm"}`}>
      {Object.entries(MULTIPLAYER_RACE_CASH_PLACEMENT_REWARDS).map(([placement, reward]) => (
        <div key={placement} className="flex justify-between rounded-xl bg-black/25 px-3 py-2 text-white/70">
          <span>{ordinal(Number(placement))}</span>
          <b className="text-lime-200">+{reward} RC</b>
        </div>
      ))}
    </div>
  );
}
