"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  findMatch,
  cancelMatchmaking,
  getState,
  subscribe,
  checkServerHealth,
  getConfiguredServerUrl,
  type MatchmakingState,
} from "@/lib/multiplayer/client";
import { MULTIPLAYER_RACE_CASH_PLACEMENT_REWARDS } from "@/config/rewards";
import type { CarConfig } from "@/config/cars";
import type { PlayerCar } from "@/types/game";

type Props = {
  selectedCar: CarConfig & { powerRating?: number };
  playerCar: PlayerCar;
  onStateChange?: (state: MatchmakingState) => void;
};

function getDisplayedServerUrl(): string {
  const url = getConfiguredServerUrl();
  if (url) return url;
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

  // Idle — show Find Match button (or not-configured state)
  if (state.status === "idle") {
    const hasServerUrl = getConfiguredServerUrl() !== null;

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

        {/* Server not configured warning */}
        {!hasServerUrl && (
          <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-500/[0.08] p-5 text-left">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-300">
              Game Server Not Configured
            </p>
            <p className="mt-2 text-sm text-amber-100/70">
              The multiplayer game server URL is not set. Set <code className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-200">NEXT_PUBLIC_GAME_SERVER_URL</code> in your Vercel environment variables.
            </p>
            <p className="mt-2 text-xs text-amber-200/40">
              For local dev: <code className="rounded bg-amber-500/15 px-1 py-0.5">ws://localhost:2567</code>
            </p>
          </div>
        )}

        <ServerHealthIndicator hasServerUrl={hasServerUrl} />

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
                <p className="text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300">Token Stake Rooms</p>
                <h3 className="mt-1 text-xl font-black text-white">Coming Soon</h3>
              </div>
              <span className="rounded-full border border-fuchsia-200/30 px-3 py-1 text-xs font-black text-fuchsia-100">Coming soon</span>
            </div>
            <p className="mt-3 text-sm text-white/65">
              Stake RACETE tokens in multiplayer rooms later. This mode is disabled; see the Token Stake Rooms preview below for current test-mode economics.
            </p>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-xs text-white/55">
              No deposits, token payouts, or Race Cash rewards are enabled for Token Stake Rooms V1 yet.
            </div>
          </div>
        </div>

        <button
          onClick={handleFindMatch}
          disabled={!connected || !getConfiguredServerUrl()}
          className="mt-6 w-full rounded-full bg-lime-300 px-6 py-3 text-base font-black text-black transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {getConfiguredServerUrl() ? "Find Match" : "Game Server Not Configured"}
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
    const isServerOffline = state.error?.includes("Could not connect") || state.error?.includes("not configured");
    return (
      <div className="mx-auto max-w-md rounded-[2rem] border border-red-400/20 bg-red-500/[0.06] p-8 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.35em] text-red-300">
          {isServerOffline ? "Server Offline" : "Matchmaking Error"}
        </p>
        <p className="mt-2 text-sm text-red-100/80">
          {isServerOffline
            ? "The multiplayer game server is currently offline or unreachable. Free Race multiplayer is coming online soon."
            : (state.error || "Unknown error")}
        </p>
        <div className="mt-5 flex justify-center gap-3">
          {isServerOffline && (
            <button
              onClick={handleFindMatch}
              className="rounded-full border border-lime-300/30 bg-lime-300/10 px-5 py-2 text-sm font-bold text-lime-200 transition hover:bg-lime-300/20"
            >
              Retry
            </button>
          )}
          <button
            onClick={handleCancel}
            className="rounded-full border border-white/10 bg-white/[0.06] px-5 py-2 text-sm font-bold text-white/80 transition hover:bg-white/10"
          >
            Back
          </button>
        </div>
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

function ServerHealthIndicator({ hasServerUrl }: { hasServerUrl: boolean }) {
  const [health, setHealth] = useState<{ ok: boolean; error?: string } | null>(null);
  const [checking, setChecking] = useState(false);

  const handleCheck = useCallback(async () => {
    if (!hasServerUrl) return;
    setChecking(true);
    const result = await checkServerHealth();
    setHealth(result);
    setChecking(false);
  }, [hasServerUrl]);

  // Auto-check once when server URL is available
  useEffect(() => {
    if (hasServerUrl) void handleCheck();
  }, [hasServerUrl, handleCheck]);

  if (!hasServerUrl) return null;

  return (
    <div className="mt-3 flex items-center justify-center gap-2">
      {health === null || checking ? (
        <span className="flex items-center gap-1.5 text-xs text-white/30">
          <div className="size-2 animate-pulse rounded-full bg-white/20" />
          Checking server...
        </span>
      ) : health.ok ? (
        <span className="flex items-center gap-1.5 text-xs text-lime-300/70">
          <div className="size-2 rounded-full bg-lime-400 shadow-[0_0_6px_#bef264]" />
          Server online
        </span>
      ) : (
        <div className="flex flex-col items-center gap-1">
          <span className="flex items-center gap-1.5 text-xs text-red-300/70">
            <div className="size-2 rounded-full bg-red-400" />
            Server offline — {health.error || "unreachable"}
          </span>
          <button
            onClick={handleCheck}
            disabled={checking}
            className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold text-white/40 hover:bg-white/5 disabled:opacity-30"
          >
            {checking ? "Checking..." : "Retry"}
          </button>
        </div>
      )}
    </div>
  );
}
