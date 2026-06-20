"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getState,
  toggleReady,
  cancelMatchmaking,
  subscribe,
  type MatchmakingState,
} from "@/lib/multiplayer/client";
import { shortWallet } from "@/lib/format";
import type { LobbyPlayer } from "@/types/multiplayer";

type Props = {
  walletAddress: string;
  onRaceStart?: () => void;
};

export function LobbyPanel({ walletAddress, onRaceStart }: Props) {
  const [state, setState] = useState<MatchmakingState>(getState);
  const [localReady, setLocalReady] = useState(false);

  useEffect(() => {
    const unsub = subscribe(() => {
      const s = getState();
      setState(s);
    });
    return unsub;
  }, []);

  // Navigate to race when status switches to racing
  useEffect(() => {
    if (state.room?.status === "racing") {
      onRaceStart?.();
    }
  }, [state.room?.status, onRaceStart]);

  const handleToggleReady = useCallback(() => {
    const next = !localReady;
    setLocalReady(next);
    toggleReady(next);
  }, [localReady]);

  const handleLeave = useCallback(() => {
    cancelMatchmaking();
  }, []);

  if (!state.room) return null;

  const room = state.room;
  const isCountdown = room.status === "countdown";
  const isLobby = room.status === "lobby";
  const readyCount = room.players.filter((p) => p.ready).length;
  const myPlayer = room.players.find(
    (p) => p.sessionId === state.sessionId
  );
  const isReady = myPlayer?.ready ?? localReady;

  return (
    <div className="mx-auto max-w-lg rounded-[2rem] border border-white/10 bg-[#0a0a12]/90 p-6 text-white backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-lime-300">
            {isCountdown ? "Starting..." : "Lobby"}
          </p>
          <h2 className="mt-1 text-2xl font-black">
            {room.raceClass !== "open" ? `Class ${room.raceClass}` : "Open"} Race
          </h2>
        </div>
        <div className="rounded-full bg-white/[0.06] px-4 py-2 text-center">
          <p className="text-xs text-white/40">Players</p>
          <p className="text-xl font-black text-lime-300">
            {room.players.length}/{room.maxPlayers}
          </p>
        </div>
      </div>

      {/* Countdown bar */}
      {isCountdown && (
        <div className="mt-4 rounded-xl border border-lime-300/20 bg-lime-300/[0.04] px-4 py-3 text-center">
          <p className="text-sm text-lime-200/70">Race starting in</p>
          <p className="text-5xl font-black text-lime-300 tabular-nums">
            {room.countdownSeconds}
          </p>
        </div>
      )}

      {/* Player list */}
      <div className="mt-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-white/30">
          Racers {isCountdown ? `(${readyCount} ready)` : ""}
        </p>
        {room.players.map((player: LobbyPlayer) => (
          <PlayerRow
            key={player.sessionId}
            player={player}
            isYou={player.walletAddress === walletAddress}
          />
        ))}
        {/* Empty slots */}
        {Array.from({ length: room.maxPlayers - room.players.length }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="flex items-center gap-3 rounded-xl border border-dashed border-white/[0.06] px-4 py-2.5 text-white/15"
          >
            <span className="text-sm">Waiting for player...</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-5 flex gap-3">
        {isLobby && (
          <button
            onClick={handleToggleReady}
            className={`flex-1 rounded-full px-5 py-3 text-sm font-black transition ${
              isReady
                ? "bg-lime-300 text-black hover:bg-lime-200"
                : "border border-lime-300/30 bg-lime-300/[0.06] text-lime-200 hover:bg-lime-300/15"
            }`}
          >
            {isReady ? "✓ Ready" : "Ready Up"}
          </button>
        )}
        {isCountdown && (
          <div className="flex-1 rounded-full border border-lime-300/10 bg-lime-300/[0.03] px-5 py-3 text-center text-sm font-bold text-lime-200/60">
            Race starting...
          </div>
        )}
        <button
          onClick={handleLeave}
          className="rounded-full border border-red-400/15 bg-red-500/[0.06] px-5 py-3 text-sm font-bold text-red-200/70 transition hover:bg-red-500/15"
        >
          Leave
        </button>
      </div>
    </div>
  );
}

function PlayerRow({ player, isYou }: { player: LobbyPlayer; isYou: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 transition ${
        player.ready
          ? "border-lime-300/25 bg-lime-300/[0.06]"
          : "border-white/[0.06] bg-white/[0.02]"
      }`}
    >
      {/* Ready indicator */}
      <div
        className={`size-3 rounded-full border-2 ${
          player.ready
            ? "border-lime-300 bg-lime-400 shadow-[0_0_8px_#bef264]"
            : "border-white/20 bg-transparent"
        }`}
      />

      {/* Wallet */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white truncate">
          {shortWallet(player.walletAddress)}
          {isYou && <span className="ml-1.5 text-xs text-lime-300/80">(you)</span>}
        </p>
        <p className="text-xs text-white/50">{player.carName}</p>
      </div>

      {/* Class + PR */}
      <div className="text-right">
        <p className="text-xs font-bold text-white/60">{player.carClass}</p>
        <p className="text-xs text-lime-200/70 tabular-nums">PR {player.powerRating}</p>
      </div>
    </div>
  );
}
