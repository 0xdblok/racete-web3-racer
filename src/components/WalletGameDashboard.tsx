"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { CARS } from "@/config/cars";
import { publicEnv } from "@/lib/env";
import { formatNumber, shortWallet } from "@/lib/format";
import type { PlayerInitResponse } from "@/types/game";

type Status = "idle" | "loading" | "ready" | "error";

export function WalletGameDashboard() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<PlayerInitResponse | null>(null);
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [tokenBalanceStatus, setTokenBalanceStatus] = useState("idle");

  const walletAddress = publicKey?.toBase58() || "";
  const ownedCarIds = useMemo(() => new Set(state?.ownedCars.map((car) => car.car_id) || []), [state]);

  const refreshTokenBalance = useCallback(async () => {
    if (!publicKey || !publicEnv.tokenMint) {
      setTokenBalance(0);
      setTokenBalanceStatus(publicEnv.tokenMint ? "idle" : "missing token mint");
      return;
    }

    setTokenBalanceStatus("loading");
    try {
      const mint = new PublicKey(publicEnv.tokenMint);
      const ata = getAssociatedTokenAddressSync(mint, publicKey);
      const account = await connection.getTokenAccountBalance(ata).catch(() => null);
      setTokenBalance(account?.value.uiAmount || 0);
      setTokenBalanceStatus("ready");
    } catch (err) {
      setTokenBalance(0);
      setTokenBalanceStatus(err instanceof Error ? err.message : "token balance failed");
    }
  }, [connection, publicKey]);

  const initPlayer = useCallback(async () => {
    if (!walletAddress) return;

    setStatus("loading");
    setError(null);

    try {
      const res = await fetch("/api/player/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Player init failed");

      setState(data);
      setStatus("ready");
      await refreshTokenBalance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Player init failed");
      setStatus("error");
    }
  }, [refreshTokenBalance, walletAddress]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (connected && walletAddress) void initPlayer();
      if (!connected) {
        setState(null);
        setStatus("idle");
        setTokenBalance(0);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [connected, initPlayer, walletAddress]);

  return (
    <main className="min-h-screen bg-[#050509] text-white">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-xl font-black tracking-[0.35em] text-fuchsia-300">RACETE</Link>
          <div className="flex items-center gap-3">
            <Link className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10" href="/garage">Garage</Link>
            <a className="rounded-full bg-lime-300 px-4 py-2 text-sm font-bold text-black hover:bg-lime-200" href={publicEnv.tokenBuyUrl} target="_blank" rel="noreferrer">Buy Token</a>
            <WalletMultiButton />
          </div>
        </nav>

        <header className="rounded-[2rem] border border-fuchsia-400/25 bg-[radial-gradient(circle_at_top_left,#5b21b6,transparent_35%),linear-gradient(135deg,#10101a,#050509)] p-8 shadow-2xl shadow-fuchsia-950/40">
          <p className="text-sm font-bold uppercase tracking-[0.4em] text-lime-300">Web3 racing foundation</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-black leading-tight md:text-7xl">Connect wallet. Claim Street Rat. Build the garage.</h1>
          <p className="mt-5 max-w-2xl text-lg text-white/70">Starter foundation: wallet identity, Supabase player profile, earned/purchased Race Cash split, Pump.fun SPL token balance, and six-car garage.</p>
        </header>

        {!connected && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <p className="mb-4 text-white/70">Connect Phantom, Backpack, or Solflare to initialize your player profile.</p>
            <WalletMultiButton />
          </div>
        )}

        {connected && (
          <section className="grid gap-4 md:grid-cols-4">
            <Stat label="Wallet" value={walletAddress ? shortWallet(walletAddress) : "-"} sub={walletAddress} />
            <Stat label="Pump.fun Token" value={formatNumber(tokenBalance)} sub={`Balance: ${tokenBalanceStatus}`} />
            <Stat label="Earned Race Cash" value={formatNumber(state?.player.earned_race_cash)} sub="Cashout-eligible later" />
            <Stat label="Purchased Race Cash" value={formatNumber(state?.player.purchased_race_cash)} sub="Not cashout eligible" />
          </section>
        )}

        {status === "loading" && <Panel>Creating/loading player profile and starter car...</Panel>}
        {error && <Panel tone="error">{error}</Panel>}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CARS.map((car) => {
            const owned = ownedCarIds.has(car.id);
            return (
              <article key={car.id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-lg shadow-black/30">
                <div className="mb-4 flex h-40 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black">
                  <div className="h-16 w-32 rounded-[45%_55%_35%_35%] border border-fuchsia-300/60 bg-fuchsia-400/15 shadow-[0_0_60px_rgba(217,70,239,0.35)]" />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black">{car.name}</h2>
                    <p className="text-sm text-white/55">Class {car.class} · PR {car.basePowerRating}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${owned ? "bg-lime-300 text-black" : "bg-white/10 text-white/70"}`}>{owned ? "Owned" : car.isStarter ? "Starter" : "Locked"}</span>
                </div>
                <p className="mt-3 text-sm text-white/65">{car.vibe}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-white/70">
                  <span>Race Cash: {formatNumber(car.priceRaceCash)}</span>
                  <span>Token: {formatNumber(car.priceToken)}</span>
                </div>
              </article>
            );
          })}
        </section>
      </section>
    </main>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-fuchsia-200/80">{label}</p>
      <p className="mt-2 truncate text-2xl font-black">{value}</p>
      {sub && <p className="mt-1 truncate text-xs text-white/45">{sub}</p>}
    </div>
  );
}

function Panel({ children, tone = "normal" }: { children: React.ReactNode; tone?: "normal" | "error" }) {
  return <div className={`rounded-3xl border p-5 ${tone === "error" ? "border-red-400/30 bg-red-500/10 text-red-100" : "border-white/10 bg-white/[0.04] text-white/70"}`}>{children}</div>;
}
