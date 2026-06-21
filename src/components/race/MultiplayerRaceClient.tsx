"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { CARS } from "@/config/cars";
import { CITY_LOOP_TRACK } from "@/config/tracks";
import { RaceHud } from "@/components/race/RaceHud";
import { RaceResultsOverlay } from "@/components/race/RaceResultsOverlay";
import { MatchmakingPanel } from "@/components/multiplayer/MatchmakingPanel";
import { LobbyPanel } from "@/components/multiplayer/LobbyPanel";
import {
  getState,
  sendMovement,
  sendCheckpoint,
  sendFinish,
  subscribe,
  type MatchmakingState,
} from "@/lib/multiplayer/client";
import { formatRaceTime } from "@/lib/race/format";
import type { RaceResult, RaceProgress } from "@/lib/race/useRaceLoop";
import type { CarState } from "@/components/race/RaceScene";
import type { PlayerInitResponse } from "@/types/game";

const RaceScene = dynamic(
  () => import("@/components/race/RaceScene").then((mod) => ({ default: mod.RaceScene })),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-screen text-white/60">Loading 3D race engine…</div> },
);

type Status = "idle" | "loading" | "ready" | "error";
type View = "matchmaking" | "lobby" | "racing";

type Telemetry = {
  speed: number;
  nitroFuel: number;
  nitroCooldown: boolean;
  drifting: boolean;
};

export class MultiplayerErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  state = { hasError: false, errorMessage: "" };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error.message };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[MultiplayerRaceClient] crashed:", error.message, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-[#050509] p-6 text-white">
          <div className="mx-auto max-w-md rounded-[2rem] border border-red-400/20 bg-red-500/[0.06] p-8 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.35em] text-red-300">Multiplayer Error</p>
            <h1 className="mt-3 text-2xl font-black">Component crashed</h1>
            <p className="mt-2 text-sm text-red-100/70">{this.state.errorMessage}</p>
            <a href="/" className="mt-6 inline-flex rounded-full bg-lime-300 px-5 py-2.5 text-sm font-black text-black">Back to home</a>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

function MultiplayerRaceClientInner() {
  const { publicKey, connected } = useWallet();
  const [playerState, setPlayerState] = useState<PlayerInitResponse | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [view, setView] = useState<View>("matchmaking");
  const [multiplayerState, setMultiplayerState] = useState<MatchmakingState>(() => getState());
  const [raceProgress, setRaceProgress] = useState<RaceProgress | null>(null);
  const [raceResult, setRaceResult] = useState<RaceResult | null>(null);
  const [raceKey, setRaceKey] = useState(0);
  const carStateRef = useRef<CarState | null>(null);
  const walletAddress = publicKey?.toBase58() || "";
  const finishRequestedRef = useRef(false);

  const handleRaceProgress = useCallback((progress: RaceProgress) => {
    setRaceProgress(progress);
  }, []);

  // Server-authoritative finish: send finish event to Colyseus
  const handleRaceFinish = useCallback((result: RaceResult) => {
    if (finishRequestedRef.current) return;
    finishRequestedRef.current = true;

    setRaceResult(result);
    sendFinish({
      totalTimeMs: result.totalTimeMs,
      bestLapMs: result.bestLapTimeMs,
      firstLapMs: result.firstLapTimeMs,
    });
  }, []);

  // Send checkpoint events to server
  const handleCheckpoint = useCallback((checkpointId: string, _lap: number, _passed: number) => {
    sendCheckpoint(checkpointId);
  }, []);

  const handleRaceAgain = useCallback(() => {
    setRaceResult(null);
    setRaceProgress(null);
    setTelemetry(null);
    carStateRef.current = null;
    finishRequestedRef.current = false;
    setRaceKey((k) => k + 1);
  }, []);

  useEffect(() => {
    return subscribe(() => {
      const state = getState();
      setMultiplayerState(state);
      if (state.room?.status === "racing") {
        setView("racing");
      }
      if (state.status === "idle" || state.status === "error" || state.status === "disconnected") {
        setView("matchmaking");
      }
      // When server sends race_results, show final state
      if (state.raceResults || state.room?.status === "finished") {
        // Keep in racing view — results overlay handles the transition
      }
    });
  }, []);

  // Bridge: poll carStateRef for telemetry
  useEffect(() => {
    let raf = 0;
    function poll() {
      const cs = carStateRef.current;
      if (cs) {
        setTelemetry({ speed: cs.speed, nitroFuel: 0, nitroCooldown: false, drifting: cs.drifting });
      }
      raf = requestAnimationFrame(poll);
    }
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Network sync: send local car transform at 15Hz
  useEffect(() => {
    if (view !== "racing") return;
    const interval = window.setInterval(() => {
      const cs = carStateRef.current;
      if (!cs) return;
      sendMovement({
        x: cs.position.x,
        y: cs.position.y,
        z: cs.position.z,
        yaw: cs.rotation.y,
        speed: cs.speed,
        isNitro: cs.nitroActive,
        isDrifting: cs.drifting,
      });
    }, 1000 / 15);
    return () => window.clearInterval(interval);
  }, [view]);

  const selectedCatalogCar = useMemo(() => {
    if (!playerState?.selectedCar) return null;
    return CARS.find((car) => car.id === playerState.selectedCar?.car_id) || null;
  }, [playerState]);

  const loadPlayer = useCallback(async () => {
    if (!walletAddress) return;
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/player/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load player state");
      setPlayerState(data);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load race state");
      setStatus("error");
    }
  }, [walletAddress]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (connected && walletAddress) void loadPlayer();
      if (!connected) {
        setPlayerState(null);
        setStatus("idle");
        setError(null);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [connected, loadPlayer, walletAddress]);

  const handleLobbyStateChange = useCallback(
    (s: MatchmakingState) => {
      if (s.status === "searching" || s.status === "joined") {
        setView("lobby");
      } else if (s.status === "idle" || s.status === "error" || s.status === "disconnected") {
        setView("matchmaking");
      }
    },
    [],
  );

  const handleRaceStart = useCallback(() => {
    setView("racing");
  }, []);

  // Not connected
  if (!connected) {
    return (
      <MultiplayerShell>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center text-white">
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-lime-300">Wallet required</p>
          <h1 className="mt-3 text-4xl font-black">Connect wallet to race.</h1>
          <div className="mt-6 flex justify-center"><WalletMultiButton /></div>
        </div>
      </MultiplayerShell>
    );
  }

  if (status === "loading" || (connected && status === "idle")) {
    return <MultiplayerShell><Panel>Loading garage state...</Panel></MultiplayerShell>;
  }

  if (error) {
    return <MultiplayerShell><Panel tone="error">{error}</Panel></MultiplayerShell>;
  }

  if (status === "ready" && (!playerState?.selectedCar || !selectedCatalogCar)) {
    return (
      <MultiplayerShell>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-amber-300/25 bg-amber-300/10 p-8 text-center text-white">
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-amber-200">No selected car</p>
          <h1 className="mt-3 text-4xl font-black">Select a car in garage first.</h1>
          <Link href="/garage" className="mt-6 inline-flex rounded-full bg-lime-300 px-5 py-3 text-sm font-black text-black hover:bg-lime-200">Back to garage</Link>
        </div>
      </MultiplayerShell>
    );
  }

  // Matchmaking view
  if (view === "matchmaking") {
    if (!selectedCatalogCar || !playerState?.selectedCar) {
      return (
        <MultiplayerShell>
          <div className="mx-auto max-w-xl rounded-[2rem] border border-amber-300/25 bg-amber-300/10 p-8 text-center text-white">
            <p className="text-sm font-bold uppercase tracking-[0.35em] text-amber-200">No selected car</p>
            <h1 className="mt-3 text-4xl font-black">Select a car in garage first.</h1>
            <Link href="/garage" className="mt-6 inline-flex rounded-full bg-lime-300 px-5 py-3 text-sm font-black text-black hover:bg-lime-200">Back to garage</Link>
          </div>
        </MultiplayerShell>
      );
    }

    return (
      <MultiplayerShell>
        <MatchmakingPanel
          selectedCar={{ ...selectedCatalogCar, powerRating: playerState.selectedCar.power_rating ?? selectedCatalogCar.basePowerRating }}
          playerCar={playerState.selectedCar}
          onStateChange={handleLobbyStateChange}
        />
      </MultiplayerShell>
    );
  }

  // Lobby view
  if (view === "lobby") {
    return (
      <MultiplayerShell>
        <LobbyPanel walletAddress={walletAddress} onRaceStart={handleRaceStart} />
      </MultiplayerShell>
    );
  }

  // Racing view
  if (view === "racing" && selectedCatalogCar && playerState?.selectedCar) {
    const room = multiplayerState.room;
    const sessionId = multiplayerState.sessionId;
    const players = room?.players ?? [];
    const localPlayer = players.find((p) => p.sessionId === sessionId);
    const remotePlayers = players.filter((p) => p.sessionId !== sessionId && p.raceStatus !== "disconnected");
    const localSpawn = localPlayer
      ? { x: localPlayer.x, y: localPlayer.y, z: localPlayer.z, yaw: localPlayer.yaw }
      : undefined;

    return (
      <main className="relative min-h-screen bg-[#050509] p-2 text-white">
        <RaceHud
          walletAddress={walletAddress}
          car={selectedCatalogCar}
          selectedCar={playerState.selectedCar}
          track={CITY_LOOP_TRACK}
          telemetry={telemetry}
          multiplayer
          raceProgress={raceProgress}
        />
        <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 gap-3">
          <span className="rounded-full border border-lime-300/20 bg-black/50 px-4 py-2 text-xs text-lime-200/70 backdrop-blur">
            Multiplayer sync active · Room: {multiplayerState.roomId?.slice(0, 12) ?? "—"} · Players: {players.length}/6 · Remote: {remotePlayers.length} · 15Hz
          </span>
        </div>
        <RaceScene
          key={raceKey}
          car={selectedCatalogCar}
          selectedCar={playerState.selectedCar}
          track={CITY_LOOP_TRACK}
          carRef={carStateRef}
          remotePlayers={remotePlayers}
          localSpawn={localSpawn}
          autoStart={false}
          onProgress={handleRaceProgress}
          onFinish={handleRaceFinish}
          onCheckpoint={handleCheckpoint}
        />
        {raceResult && (
          <MultiplayerResultsOverlay
            raceResult={raceResult}
            multiplayerState={multiplayerState}
            carName={selectedCatalogCar.name}
            trackName={CITY_LOOP_TRACK.name}
            onRaceAgain={handleRaceAgain}
            placement={multiplayerState.myFinishResult?.placement ?? 1}
            totalPlayers={Math.max(players.length, 1)}
            sessionId={sessionId}
          />
        )}
      </main>
    );
  }

  return <MultiplayerShell><Panel>Preparing multiplayer shell...</Panel></MultiplayerShell>;
}

export function MultiplayerRaceClient() {
  return (
    <MultiplayerErrorBoundary>
      <MultiplayerRaceClientInner />
    </MultiplayerErrorBoundary>
  );
}

/* ------------------------------------------------------------------ */
/*  Multiplayer Results Overlay                                        */
/* ------------------------------------------------------------------ */

function MultiplayerResultsOverlay({
  raceResult,
  multiplayerState,
  carName,
  trackName,
  onRaceAgain,
  placement,
  totalPlayers,
  sessionId,
}: {
  raceResult: RaceResult;
  multiplayerState: MatchmakingState;
  carName: string;
  trackName: string;
  onRaceAgain: () => void;
  placement: number;
  totalPlayers: number;
  sessionId: string | null;
}) {
  const finishResult = multiplayerState.myFinishResult;
  const serverResults = multiplayerState.raceResults;
  const roomResults = multiplayerState.room?.results;
  const signedReward = multiplayerState.signedReward;

  const [claimStatus, setClaimStatus] = useState<"idle" | "claiming" | "claimed" | "error">("idle");
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimedAmount, setClaimedAmount] = useState<number | null>(null);

  const handleClaim = useCallback(async () => {
    if (!signedReward) return;
    setClaimStatus("claiming");
    setClaimError(null);
    try {
      const res = await fetch("/api/race/reward/multiplayer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signedReward),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          // Already claimed — treat as success
          setClaimStatus("claimed");
          setClaimedAmount(typeof data.reward?.amount === "number" ? data.reward.amount : null);
          return;
        }
        throw new Error(data.error || "Claim failed");
      }
      setClaimStatus("claimed");
      setClaimedAmount(data.rewardAmount);
    } catch (err) {
      setClaimStatus("error");
      setClaimError(err instanceof Error ? err.message : "Failed to claim reward");
    }
  }, [signedReward]);

  // Show server results if available
  const results = serverResults ?? roomResults ?? [];
  const hasServerResults = results.length > 0;
  const isFinished = finishResult?.accepted === true;
  const canClaim = signedReward !== null && claimStatus === "idle" && isFinished;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-[#0a0a12]/95 p-8 text-white shadow-2xl">
        {/* Header */}
        <p className="text-center text-sm font-bold uppercase tracking-[0.35em] text-cyan-300">
          Multiplayer Race Results
        </p>
        <h2 className="mt-2 text-center text-2xl font-black">{trackName}</h2>

        {/* Your finish */}
        {finishResult?.accepted ? (
          <div className="mt-4 rounded-2xl border border-lime-300/20 bg-lime-500/[0.06] p-4 text-center">
            <p className="text-sm text-lime-200/80">You finished</p>
            <p className="mt-1 text-4xl font-black text-lime-300">
              #{finishResult.placement}
            </p>
            <p className="mt-1 font-mono text-lg text-white">
              {formatRaceTime(finishResult.totalTimeMs)}
            </p>
            {finishResult.bestLapMs > 0 && (
              <p className="mt-1 text-xs text-white/40">
                Best Lap: {formatRaceTime(finishResult.bestLapMs)} · First Lap: {formatRaceTime(finishResult.firstLapMs)}
              </p>
            )}
          </div>
        ) : finishResult && !finishResult.accepted ? (
          <div className="mt-4 rounded-2xl border border-red-300/20 bg-red-500/[0.06] p-4 text-center">
            <p className="text-sm text-red-200/80">Finish rejected</p>
            <p className="mt-1 text-xs text-red-300/60">{finishResult.error}</p>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <p className="text-sm text-white/50">Waiting for server confirmation...</p>
          </div>
        )}

        {/* Server leaderboard */}
        {hasServerResults && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/30">Race Standings</p>
            {results
              .filter((r) => r.placement > 0)
              .map((r) => (
                <div
                  key={r.sessionId}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                    r.sessionId === sessionId
                      ? "border-fuchsia-400/20 bg-fuchsia-500/[0.06]"
                      : r.placement === 1
                        ? "border-yellow-400/15 bg-yellow-500/[0.04]"
                        : "border-white/[0.06] bg-white/[0.02]"
                  }`}
                >
                  <span className="w-6 text-center text-sm font-black text-white/50">#{r.placement}</span>
                  <span className="flex-1 truncate text-xs font-mono text-white/60">{r.displayWallet}</span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-black text-white/40">{r.carClass}</span>
                  {r.status === "finished" ? (
                    <span className="font-mono text-xs text-lime-200/80 tabular-nums">{formatRaceTime(r.totalTimeMs)}</span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase text-red-300/60">DNF</span>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* Reward claim section */}
        {isFinished && (
          <div className="mt-4 rounded-xl border border-lime-300/20 bg-lime-500/[0.04] p-4 text-center">
            {claimStatus === "idle" && canClaim && (
              <button
                onClick={handleClaim}
                className="w-full rounded-full bg-lime-400 px-5 py-3 text-sm font-black text-black hover:bg-lime-300 transition-colors"
              >
                Claim Multiplayer Reward
              </button>
            )}
            {claimStatus === "idle" && !canClaim && !signedReward && (
              <div className="flex items-center justify-center gap-2">
                <div className="size-3 animate-spin rounded-full border-2 border-lime-300/40 border-t-transparent" />
                <p className="text-xs text-lime-200/60">Waiting for reward payload...</p>
              </div>
            )}
            {claimStatus === "claiming" && (
              <div className="flex items-center justify-center gap-2">
                <div className="size-4 animate-spin rounded-full border-2 border-lime-300 border-t-transparent" />
                <p className="text-sm font-bold text-lime-200">Claiming reward...</p>
              </div>
            )}
            {claimStatus === "claimed" && (
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-lime-300">Reward Claimed</p>
                <p className="mt-1 text-3xl font-black text-lime-300">
                  +{claimedAmount?.toLocaleString() ?? "—"} RC
                </p>
                <p className="mt-1 text-[10px] text-lime-200/40">Place #{finishResult?.placement} · Multiplayer Free Race</p>
              </div>
            )}
            {claimStatus === "error" && (
              <div>
                <p className="text-xs font-bold text-red-300">{claimError || "Claim failed"}</p>
                <button
                  onClick={handleClaim}
                  className="mt-2 rounded-full border border-lime-300/30 bg-lime-300/10 px-4 py-1.5 text-xs font-bold text-lime-200 hover:bg-lime-300/20"
                >
                  Retry Claim
                </button>
              </div>
            )}
          </div>
        )}

        {/* DNF / no reward */}
        {finishResult && !finishResult.accepted && !isFinished && (
          <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-500/[0.03] p-3 text-center">
            <p className="text-xs font-bold text-amber-300/60">
              No reward for this race
            </p>
            <p className="mt-1 text-[10px] text-amber-200/30">
              {finishResult.error || "Finish was not accepted by server"}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex gap-3">
          <button
            onClick={onRaceAgain}
            className="flex-1 rounded-full bg-fuchsia-400 px-5 py-3 text-sm font-black text-black hover:bg-fuchsia-300"
          >
            Race Again
          </button>
          <Link
            href="/"
            className="rounded-full border border-white/15 px-5 py-3 text-sm text-white/70 hover:bg-white/10"
          >
            Exit
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shell + Panel helpers                                              */
/* ------------------------------------------------------------------ */

function MultiplayerShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#0f172a,transparent_40%),#050509] p-6 text-white">
      {children}
    </main>
  );
}

function Panel({ children, tone = "normal" }: { children: React.ReactNode; tone?: "normal" | "error" }) {
  const className =
    tone === "error"
      ? "border-red-400/30 bg-red-500/10 text-red-100"
      : "border-white/10 bg-white/[0.04] text-white/70";
  return <div className={`rounded-3xl border p-6 ${className}`}>{children}</div>;
}
