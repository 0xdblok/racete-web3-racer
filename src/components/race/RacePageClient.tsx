"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { CARS } from "@/config/cars";
import { CITY_LOOP_TRACK } from "@/config/tracks";
import { shortWallet } from "@/lib/format";
import { RaceHud } from "@/components/race/RaceHud";
import type { CarState } from "@/components/race/RaceScene";
import type { PlayerInitResponse } from "@/types/game";

const RaceScene = dynamic(
  () => import("@/components/race/RaceScene").then((mod) => ({ default: mod.RaceScene })),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-screen text-white/60">Loading 3D race engine…</div> },
);

type Status = "idle" | "loading" | "ready" | "error";

type Telemetry = {
  speed: number;
  nitroFuel: number;
  nitroCooldown: boolean;
  drifting: boolean;
};

export function RacePageClient() {
  const { publicKey, connected } = useWallet();
  const [state, setState] = useState<PlayerInitResponse | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const carStateRef = useRef<CarState | null>(null);
  const walletAddress = publicKey?.toBase58() || "";

  // Bridge: poll carStateRef every frame to push telemetry to React state
  useEffect(() => {
    let raf = 0;
    function poll() {
      const cs = carStateRef.current;
      if (cs) {
        setTelemetry({
          speed: cs.speed,
          nitroFuel: 0, // updated from controller separately if needed
          nitroCooldown: false,
          drifting: cs.drifting,
        });
      }
      raf = requestAnimationFrame(poll);
    }
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, []);

  const selectedCatalogCar = useMemo(() => {
    if (!state?.selectedCar) return null;
    return CARS.find((car) => car.id === state.selectedCar?.car_id) || null;
  }, [state]);

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
      setState(data);
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
        setState(null);
        setStatus("idle");
        setError(null);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [connected, loadPlayer, walletAddress]);

  if (!connected) {
    return (
      <RaceShell>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center text-white">
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-lime-300">Wallet required</p>
          <h1 className="mt-3 text-4xl font-black">Connect wallet to load your selected car.</h1>
          <p className="mt-4 text-white/60">The solo shell uses your garage-selected car from Supabase.</p>
          <div className="mt-6 flex justify-center"><WalletMultiButton /></div>
        </div>
      </RaceShell>
    );
  }

  if (status === "loading") {
    return <RaceShell><Panel>Loading garage state for {shortWallet(walletAddress)}...</Panel></RaceShell>;
  }

  if (error) {
    return <RaceShell><Panel tone="error">{error}</Panel></RaceShell>;
  }

  if (status === "ready" && (!state?.selectedCar || !selectedCatalogCar)) {
    return (
      <RaceShell>
        <div className="mx-auto max-w-xl rounded-[2rem] border border-amber-300/25 bg-amber-300/10 p-8 text-center text-white">
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-amber-200">No selected car</p>
          <h1 className="mt-3 text-4xl font-black">Select a car in garage first.</h1>
          <p className="mt-4 text-white/65">Choose one owned car as active, then return to this solo race shell.</p>
          <Link href="/garage" className="mt-6 inline-flex rounded-full bg-lime-300 px-5 py-3 text-sm font-black text-black hover:bg-lime-200">Back to garage</Link>
        </div>
      </RaceShell>
    );
  }

  if (state?.selectedCar && selectedCatalogCar) {
    return (
      <main className="relative min-h-screen bg-[#050509] p-2 text-white">
        <RaceHud walletAddress={walletAddress} car={selectedCatalogCar} selectedCar={state.selectedCar} track={CITY_LOOP_TRACK} telemetry={telemetry} />
        <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 gap-3">
          <Link href="/garage" className="rounded-full border border-white/15 bg-black/50 px-4 py-2 text-sm text-white/80 backdrop-blur hover:bg-white/10">Garage</Link>
          <button onClick={() => void loadPlayer()} className="rounded-full border border-lime-300/35 bg-black/50 px-4 py-2 text-sm font-bold text-lime-100 backdrop-blur hover:bg-lime-300/10">Refresh car</button>
        </div>
        <RaceScene car={selectedCatalogCar} selectedCar={state.selectedCar} track={CITY_LOOP_TRACK} carRef={carStateRef} />
      </main>
    );
  }

  return <RaceShell><Panel>Preparing race shell...</Panel></RaceShell>;
}

function RaceShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#3b0764,transparent_32%),#050509] p-6 text-white">
      {children}
    </main>
  );
}

function Panel({ children, tone = "normal" }: { children: React.ReactNode; tone?: "normal" | "error" }) {
  const className = tone === "error" ? "border-red-400/30 bg-red-500/10 text-red-100" : "border-white/10 bg-white/[0.04] text-white/70";
  return <div className={`rounded-3xl border p-6 ${className}`}>{children}</div>;
}
