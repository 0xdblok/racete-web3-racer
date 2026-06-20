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
import type { CarConfig } from "@/config/cars";
import type { PlayerCar } from "@/types/game";

type Props = {
  selectedCar: CarConfig & { powerRating?: number };
  playerCar: PlayerCar;
  onStateChange?: (state: MatchmakingState) => void;
};

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
      <div className="mx-auto max-w-md rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.35em] text-lime-300">
          Multiplayer
        </p>
        <h2 className="mt-2 text-2xl font-black text-white">
          Race against others
        </h2>
        <p className="mt-2 text-sm text-white/60">
          {selectedCar.class}-class &middot; PR {playerCar.power_rating ?? selectedCar.basePowerRating}
        </p>
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
        <p className="mt-2 text-xs text-white/40">{process.env.NEXT_PUBLIC_GAME_SERVER_URL || "ws://localhost:2567"}</p>
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
