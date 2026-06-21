"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { CARS } from "@/config/cars";
import { formatNumber, shortWallet } from "@/lib/format";
import type { PlayerInitResponse } from "@/types/game";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Status = "idle" | "loading" | "ready" | "error";

/* ------------------------------------------------------------------ */
/*  Landing Page                                                        */
/* ------------------------------------------------------------------ */

export function LandingPageClient() {
  const { publicKey, connected } = useWallet();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<PlayerInitResponse | null>(null);

  const walletAddress = publicKey?.toBase58() || "";
  const selectedCar = state?.selectedCar;
  const selectedCarId = selectedCar?.car_id || null;
  const earnedRC = Number(state?.player.earned_race_cash || 0);
  const purchasedRC = Number(state?.player.purchased_race_cash || 0);
  const totalRC = earnedRC + purchasedRC;
  const ownedCarCount = state?.ownedCars.length || 0;
  const selectedCatalogCar = useMemo(
    () => CARS.find((c) => c.id === selectedCarId) || null,
    [selectedCarId],
  );
  const pr = selectedCar?.power_rating || selectedCatalogCar?.basePowerRating || 0;

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Player init failed");
      setStatus("error");
    }
  }, [walletAddress]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (connected && walletAddress) void initPlayer();
      if (!connected) {
        setState(null);
        setStatus("idle");
        setError(null);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [connected, initPlayer, walletAddress]);

  /* ---------------------------------------------------------------- */
  /*  Next action logic                                                */
  /* ---------------------------------------------------------------- */

  const nextAction = useMemo((): {
    title: string;
    description: string;
    cta: string;
    href: string;
    icon: string;
  } | null => {
    if (!connected || status !== "ready") return null;
    if (!selectedCarId) {
      return {
        title: "Choose your first car",
        description: "Head to the garage to select your starter car.",
        cta: "Open Garage",
        href: "/garage",
        icon: "🏎️",
      };
    }
    if (ownedCarCount < 2) {
      return {
        title: "Start your first race",
        description: `Race the ${selectedCatalogCar?.name || "City Loop"} and earn Race Cash.`,
        cta: "Start Racing",
        href: "/race",
        icon: "🏁",
      };
    }
    if (ownedCarCount < 4) {
      return {
        title: "Expand your garage",
        description: `${3 - ownedCarCount} more cars to build a competitive fleet.`,
        cta: "View Garage",
        href: "/garage",
        icon: "🏎️",
      };
    }
    return {
      title: "Race & climb the ranks",
      description: "Compete in multiplayer and climb the weekly leaderboards.",
      cta: "View Weekly",
      href: "/weekly",
      icon: "🏆",
    };
  }, [connected, status, selectedCarId, selectedCatalogCar, ownedCarCount]);

  /* ---------------------------------------------------------------- */
  /*  Render: Disconnected                                              */
  /* ---------------------------------------------------------------- */

  if (!connected) {
    return (
      <DisconnectedLanding />
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render: Loading / Error                                           */
  /* ---------------------------------------------------------------- */

  if (status === "loading" || (connected && status === "idle")) {
    return <LandingShell><Panel>Loading your garage...</Panel></LandingShell>;
  }

  if (error || status === "error") {
    return (
      <LandingShell>
        <Panel tone="error">{error || "Could not load player state"}</Panel>
        <button
          onClick={() => void initPlayer()}
          className="mt-4 rounded-full bg-fuchsia-400 px-6 py-3 text-sm font-black text-black hover:bg-fuchsia-300"
        >
          Retry
        </button>
      </LandingShell>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render: Connected Dashboard                                       */
  /* ---------------------------------------------------------------- */

  return (
    <LandingShell>
      {/* ── Nav ────────────────────────────────────────────────── */}
      <GameNav selectedCarId={selectedCarId} />

      {/* ── Hero dashboard ─────────────────────────────────────── */}
      <section className="rounded-[2rem] border border-fuchsia-400/25 bg-[radial-gradient(circle_at_top_right,#5b21b6,transparent_45%),linear-gradient(135deg,#10101a,#050509)] p-8 shadow-2xl shadow-fuchsia-950/40">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.35em] text-lime-300">
              {walletAddress ? shortWallet(walletAddress) : "Not connected"}
            </p>
            <h1 className="mt-3 max-w-2xl text-4xl font-black leading-tight md:text-5xl">
              Race. Earn. Upgrade. Climb.
            </h1>
            {selectedCatalogCar && (
              <p className="mt-3 text-lg text-white/60">
                {selectedCatalogCar.name} · Class {selectedCatalogCar.class} · Power Rating {pr}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {selectedCarId ? (
              <Link
                href="/race"
                className="rounded-full bg-fuchsia-400 px-6 py-3 text-sm font-black text-black hover:bg-fuchsia-300"
              >
                Start Racing
              </Link>
            ) : (
              <Link
                href="/garage"
                className="rounded-full bg-lime-300 px-6 py-3 text-sm font-black text-black hover:bg-lime-200"
              >
                Choose Car
              </Link>
            )}
            <Link
              href="/race/multiplayer"
              className="rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 px-5 py-3 text-sm font-black text-black hover:from-purple-400 hover:to-cyan-300"
            >
              Find Match
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats row ──────────────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Garage" value={`${ownedCarCount} cars`} sub="Build your collection" />
        <Stat label="Race Cash" value={formatNumber(totalRC)} sub={`${formatNumber(earnedRC)} earned`} />
      </section>

      {/* ── Next action ────────────────────────────────────────── */}
      {nextAction && (
        <Link href={nextAction.href} className="block group">
          <section className="rounded-[2rem] border border-lime-300/20 bg-lime-300/[0.04] p-6 transition-colors hover:bg-lime-300/[0.08] hover:border-lime-300/30">
            <div className="flex items-center gap-4">
              <span className="text-3xl">{nextAction.icon}</span>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-lime-300/80">Next action</p>
                <h2 className="mt-1 text-xl font-black">{nextAction.title}</h2>
                <p className="mt-1 text-sm text-white/50">{nextAction.description}</p>
              </div>
              <div className="rounded-full bg-lime-400 px-5 py-2.5 text-sm font-black text-black group-hover:bg-lime-300">
                {nextAction.cta} →
              </div>
            </div>
          </section>
        </Link>
      )}

      {/* ── Quick links ────────────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickLinkCard
          icon="🏁"
          title="Solo Race"
          description="Practice the City Loop. Earn up to 320 RC per race."
          href={selectedCarId ? "/race" : "/garage"}
          cta={selectedCarId ? "Race Now" : "Select Car"}
        />
        <QuickLinkCard
          icon="⚡"
          title="Multiplayer"
          description="Race 2-6 players online. Server-authoritative results."
          href="/race/multiplayer"
          cta="Find Match"
        />
        <QuickLinkCard
          icon="🎯"
          title="Missions"
          description="Complete hard objectives. Earn bonus Race Cash."
          href="/missions"
          cta="View Missions"
        />
        <QuickLinkCard
          icon="🏆"
          title="Weekly"
          description="Compete for weekly leaderboard prizes."
          href="/weekly"
          cta="View Rankings"
        />
        <QuickLinkCard
          icon="📊"
          title="Leaderboard"
          description="Global best times and top earners."
          href="/leaderboard"
          cta="View Leaderboard"
        />
        <QuickLinkCard
          icon="🏎️"
          title="Garage"
          description={`${ownedCarCount} cars. Buy, upgrade, customize.`}
          href="/garage"
          cta="Open Garage"
          dimmed={ownedCarCount === 0}
        />
      </section>

      {/* ── Coming soon ────────────────────────────────────────── */}
      <section className="rounded-[2rem] border border-white/5 bg-white/[0.02] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/30">Coming soon</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <ComingSoonCard icon="💰" title="Token Stake Rooms" description="Stake your Pump.fun token to enter high-stakes races." />
          <ComingSoonCard icon="🔒" title="Token-Gated Races" description="Premium races with bigger Race Cash rewards." />
          <ComingSoonCard icon="🚗" title="More Cars & Tracks" description="New vehicles and circuits coming in future updates." />
        </div>
      </section>

      <div className="flex justify-center">
        <WalletMultiButton />
      </div>
    </LandingShell>
  );
}

/* ================================================================== */
/*  Disconnected landing (no wallet)                                    */
/* ================================================================== */

function DisconnectedLanding() {
  return (
    <LandingShell>
      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="rounded-[2rem] border border-fuchsia-400/25 bg-[radial-gradient(circle_at_top_right,#5b21b6,transparent_45%),linear-gradient(135deg,#10101a,#050509)] p-8 shadow-2xl shadow-fuchsia-950/40 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.35em] text-lime-300">
          Solana Web3 Racing
        </p>
        <h1 className="mt-4 text-5xl font-black leading-tight md:text-7xl">
          Race. Earn. Upgrade. Climb.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-white/70">
          A Web3 racing game where every race earns Race Cash, upgrades your garage,
          and pushes you up the weekly leaderboards.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <WalletMultiButton />
          <Link
            href="/leaderboard"
            className="rounded-full border border-white/15 px-5 py-3 text-sm text-white/70 hover:bg-white/10"
          >
            View Leaderboard
          </Link>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────── */}
      <section>
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black">How it works</h2>
          <p className="mt-2 text-white/50">Three steps from wallet to winner&apos;s circle.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          <HowItWorksCard
            step="1"
            icon="🔌"
            title="Connect wallet"
            description="Link your Solana wallet. Get your free starter car instantly."
          />
          <HowItWorksCard
            step="2"
            icon="🏁"
            title="Race & earn"
            description="Solo or multiplayer. Every finish earns Race Cash for your garage."
          />
          <HowItWorksCard
            step="3"
            icon="🏆"
            title="Upgrade & climb"
            description="Upgrade cars, complete missions, and fight for weekly leaderboard prizes."
          />
        </div>
      </section>

      {/* ── Game modes ─────────────────────────────────────────── */}
      <section>
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black">Game modes</h2>
          <p className="mt-2 text-white/50">Choose how you want to race.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <GameModeCard
            icon="🏁"
            title="Solo Race"
            description="Practice laps. Beat your PB. Master the City Loop. Earn up to 320 RC per race."
            active
          />
          <GameModeCard
            icon="⚡"
            title="Multiplayer"
            description="2-6 player free races. Server-authoritative results. Real competition."
            active
          />
          <GameModeCard
            icon="🏆"
            title="Weekly Competitions"
            description="Climb weekly leaderboards for prizes. Best time, most RC, most missions."
            active
          />
          <GameModeCard
            icon="💰"
            title="Token Stake Rooms"
            description="Coming soon. Stake Pump.fun token to enter high-stakes premium races."
            comingSoon
          />
        </div>
      </section>

      {/* ── Progression ────────────────────────────────────────── */}
      <section>
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black">Progression</h2>
          <p className="mt-2 text-white/50">Every race moves you forward.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ProgressionCard icon="🚗" title="Starter car" description="Free Street Rat. Class D. Your first ride." />
          <ProgressionCard icon="💵" title="Race Cash" description="Earn RC from every finish. Spend on cars and upgrades." />
          <ProgressionCard icon="🔧" title="Upgrades" description="Engine, tires, nitro, handling. Levels 1-10." />
          <ProgressionCard icon="📈" title="Power Rating" description="Higher PR = faster laps. Matchmaking respects your bracket." />
        </div>
      </section>

      {/* ── Competitive loop ───────────────────────────────────── */}
      <section>
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black">Compete &amp; climb</h2>
          <p className="mt-2 text-white/50">Racing is better with competition.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ProgressionCard icon="⏱️" title="Personal records" description="Beat your best lap and total time. Earn PB bonuses." />
          <ProgressionCard icon="🌍" title="Global leaderboards" description="See how you stack up against every racer." />
          <ProgressionCard icon="📊" title="Weekly rankings" description="Fresh competitions every week. Multiple categories." />
          <ProgressionCard icon="💰" title="Multiplayer rewards" description="Place 1st-6th for RC payouts. Server-verified, no cheating." />
        </div>
      </section>

      {/* ── Coming soon ────────────────────────────────────────── */}
      <section className="rounded-[2rem] border border-white/5 bg-white/[0.02] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/30 text-center">Coming soon</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <ComingSoonCard icon="💰" title="Token Stake Rooms" description="Stake Pump.fun token to enter high-stakes races with bigger prizes." />
          <ComingSoonCard icon="🔒" title="Token-Gated Races" description="Premium races with higher Race Cash rewards." />
          <ComingSoonCard icon="🚗" title="More Cars & Tracks" description="New vehicles, new circuits, new challenges." />
        </div>
      </section>

      {/* ── Bottom CTA ─────────────────────────────────────────── */}
      <div className="flex justify-center">
        <WalletMultiButton />
      </div>
    </LandingShell>
  );
}

/* ================================================================== */
/*  Sub-components (shared)                                             */
/* ================================================================== */

function LandingShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#050509] text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6">
        {children}
      </div>
    </main>
  );
}

function GameNav({ selectedCarId }: { selectedCarId: string | null }) {
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 sm:px-6">
      <Link href="/" className="text-lg font-black tracking-[0.2em] text-fuchsia-300">
        RACETE
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <NavLink href={selectedCarId ? "/race" : "/garage"} highlight={!!selectedCarId}>
          {selectedCarId ? "Race" : "Garage"}
        </NavLink>
        <NavLink href="/garage">Garage</NavLink>
        <NavLink href="/missions">Missions</NavLink>
        <NavLink href="/leaderboard">Leaderboard</NavLink>
        <NavLink href="/weekly">Weekly</NavLink>
        <NavLink href="/race/multiplayer" gradient>
          Multiplayer
        </NavLink>
        <div className="ml-2">
          <WalletMultiButton />
        </div>
      </div>
    </nav>
  );
}

function NavLink({
  href,
  children,
  highlight,
  gradient,
}: {
  href: string;
  children: React.ReactNode;
  highlight?: boolean;
  gradient?: boolean;
}) {
  if (gradient) {
    return (
      <Link
        href={href}
        className="rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 px-3 py-1.5 text-xs font-bold text-black hover:from-purple-400 hover:to-cyan-300 sm:px-4 sm:text-sm"
      >
        {children}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-xs sm:px-4 sm:text-sm border transition-colors ${
        highlight
          ? "border-lime-300/30 bg-lime-300/[0.08] text-lime-200 font-bold"
          : "border-white/15 text-white/70 hover:bg-white/10"
      }`}
    >
      {children}
    </Link>
  );
}

/* ================================================================== */
/*  Cards                                                              */
/* ================================================================== */

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-200/80">{label}</p>
      <p className="mt-2 truncate text-2xl font-black">{value}</p>
      {sub && <p className="mt-1 truncate text-xs text-white/45">{sub}</p>}
    </div>
  );
}

function QuickLinkCard({
  icon,
  title,
  description,
  href,
  cta,
  dimmed,
}: {
  icon: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  dimmed?: boolean;
}) {
  return (
    <Link href={href} className="group block">
      <div
        className={`rounded-2xl border p-5 transition-colors h-full ${
          dimmed
            ? "border-white/[0.04] bg-white/[0.01] hover:border-white/10"
            : "border-white/[0.06] bg-white/[0.02] hover:border-lime-300/20 hover:bg-lime-300/[0.03]"
        }`}
      >
        <span className="text-2xl">{icon}</span>
        <h3 className="mt-3 text-base font-bold">{title}</h3>
        <p className="mt-1 text-sm text-white/50">{description}</p>
        <p className="mt-3 text-xs font-bold text-lime-300/60 group-hover:text-lime-300">
          {cta} →
        </p>
      </div>
    </Link>
  );
}

function HowItWorksCard({
  step,
  icon,
  title,
  description,
}: {
  step: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-fuchsia-400/15 text-lg font-black text-fuchsia-300">
        {step}
      </span>
      <span className="mt-4 block text-3xl">{icon}</span>
      <h3 className="mt-3 text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm text-white/50">{description}</p>
    </div>
  );
}

function GameModeCard({
  icon,
  title,
  description,
  active,
  comingSoon,
}: {
  icon: string;
  title: string;
  description: string;
  active?: boolean;
  comingSoon?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        comingSoon
          ? "border-white/[0.03] bg-white/[0.01] opacity-60"
          : active
            ? "border-lime-300/20 bg-lime-300/[0.04]"
            : "border-white/[0.06] bg-white/[0.02]"
      }`}
    >
      <span className="text-2xl">{icon}</span>
      <h3 className="mt-3 text-base font-bold">
        {title}
        {comingSoon && (
          <span className="ml-2 rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-white/30">
            Soon
          </span>
        )}
      </h3>
      <p className="mt-1 text-sm text-white/50">{description}</p>
    </div>
  );
}

function ProgressionCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <span className="text-2xl">{icon}</span>
      <h3 className="mt-3 text-base font-bold">{title}</h3>
      <p className="mt-1 text-sm text-white/50">{description}</p>
    </div>
  );
}

function ComingSoonCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-5 opacity-50">
      <span className="text-2xl">{icon}</span>
      <h3 className="mt-3 text-base font-bold text-white/60">{title}</h3>
      <p className="mt-1 text-sm text-white/30">{description}</p>
    </div>
  );
}

function Panel({ children, tone = "normal" }: { children: React.ReactNode; tone?: "normal" | "error" | "success" }) {
  const className =
    tone === "error"
      ? "border-red-400/30 bg-red-500/10 text-red-100"
      : "border-white/10 bg-white/[0.04] text-white/70";
  return (
    <div className={`rounded-3xl border p-6 text-center ${className}`}>
      {children}
    </div>
  );
}
