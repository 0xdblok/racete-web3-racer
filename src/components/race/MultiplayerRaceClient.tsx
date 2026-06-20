"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { CARS } from "@/config/cars";
import { CITY_LOOP_TRACK } from "@/config/tracks";
import { RaceHud } from "@/components/race/RaceHud";
import { RaceScene } from "@/components/race/RaceScene";
import { MatchmakingPanel } from "@/components/multiplayer/MatchmakingPanel";
import { LobbyPanel } from "@/components/multiplayer/LobbyPanel";
import { getState, type MatchmakingState } from "@/lib/multiplayer/client";
import type { CarState } from "@/components/race/RaceScene";
import type { PlayerInitResponse } from "@/types/game";

type Status = "idle" | "loading" | "ready" | "error";
type View = "matchmaking" | "lobby" | "racing";

type Telemetry = {
  speed: number;
  nitroFuel: number;
  nitroCooldown: boolean;
  drifting: boolean;
};

export function MultiplayerRaceClient() {
  const { publicKey, connected } = useWallet();
  const [playerState, setPlayerState] = useState<PlayerInitResponse | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [view, setView] = useState<View>("matchmaking");
  const carStateRef = useRef<CarState | null>(null);
  const walletAddress = publicKey?.toBase58() || "";

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

  // Loading
  if (status === "loading") {
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

  // Matchmaking view
  if (view === "matchmaking") {
    return (
      <MultiplayerShell>
        <MatchmakingPanel
          selectedCar={{ ...selectedCatalogCar!, powerRating: playerState!.selectedCar!.power_rating ?? selectedCatalogCar!.basePowerRating }}
          playerCar={playerState!.selectedCar!}
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
    return (
      <main className="relative min-h-screen bg-[#050509] p-2 text-white">
        <RaceHud
          walletAddress={walletAddress}
          car={selectedCatalogCar}
          selectedCar={playerState.selectedCar}
          track={CITY_LOOP_TRACK}
          telemetry={telemetry}
          multiplayer
        />
        <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 gap-3">
          <span className="rounded-full border border-lime-300/20 bg-black/50 px-4 py-2 text-xs text-lime-200/70 backdrop-blur">
            Multiplayer — Room: {getState().roomId?.slice(0, 12) ?? "—"}
          </span>
        </div>
        <RaceScene
          car={selectedCatalogCar}
          selectedCar={playerState.selectedCar}
          track={CITY_LOOP_TRACK}
          carRef={carStateRef}
        />
      </main>
    );
  }

  return <MultiplayerShell><Panel>Preparing multiplayer shell...</Panel></MultiplayerShell>;
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
