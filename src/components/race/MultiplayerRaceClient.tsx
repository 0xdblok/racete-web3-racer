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
import { getState, sendMovement, subscribe, type MatchmakingState } from "@/lib/multiplayer/client";
import { formatRaceTime, type RaceResult, type RaceProgress } from "@/lib/race/useRaceLoop";
import type { CarState } from "@/components/race/RaceScene";
import type { PlayerInitResponse } from "@/types/game";

// Dynamic import: RaceScene pulls in @react-three/* and may fail on some browsers.
// Load it only when racing view is active to avoid crashing the whole page on initial render.
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

  const handleRaceProgress = useCallback((progress: RaceProgress) => {
    setRaceProgress(progress);
  }, []);

  const handleRaceFinish = useCallback((result: RaceResult) => {
    setRaceResult(result);
  }, []);

  const handleRaceAgain = useCallback(() => {
    setRaceResult(null);
    setRaceProgress(null);
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

  // Network sync: send local car transform at 15Hz (not every frame)
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
      // Racing transition handled by onRaceStart callback from LobbyPanel
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

  // Loading (also guard the initial idle state when wallet is already connected)
  if (status === "loading" || (connected && status === "idle")) {
    return <MultiplayerShell><Panel>Loading garage state...</Panel></MultiplayerShell>;
  }

  // Error
  if (error) {
    return <MultiplayerShell><Panel tone="error">{error}</Panel></MultiplayerShell>;
  }

  // No selected car
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

  // Matchmaking view — extra guard against incomplete state
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
          onProgress={handleRaceProgress}
          onFinish={handleRaceFinish}
        />
        {raceResult && (
          <RaceResultsOverlay
            result={raceResult}
            formatRaceTime={formatRaceTime}
            carName={selectedCatalogCar.name}
            trackName={CITY_LOOP_TRACK.name}
            onRaceAgain={handleRaceAgain}
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
