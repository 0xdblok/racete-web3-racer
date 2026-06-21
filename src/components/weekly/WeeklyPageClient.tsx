"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { shortWallet } from "@/lib/format";
import type { WeeklyLeaderboardResponse } from "@/app/api/weekly/leaderboard/route";
import { WeeklyLeaderboardTable } from "./WeeklyLeaderboardTable";
import { WeeklyFilters } from "./WeeklyFilters";

const CATEGORIES = [
  { key: "best_total_time", label: "Best Total" },
  { key: "best_first_lap", label: "Best First Lap" },
  { key: "best_lap", label: "Best Lap" },
  { key: "race_cash_earned", label: "RC Earned" },
  { key: "missions_completed", label: "Missions" },
  { key: "races_finished", label: "Races" },
] as const;

const CLASSES = ["all", "D", "C", "C+", "B", "B+", "A", "S"] as const;
const LIMITS = [10, 25, 50] as const;

type Status = "idle" | "loading" | "ready" | "error";

export function WeeklyPageClient() {
  const { publicKey, connected } = useWallet();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [category, setCategory] = useState(
    () => searchParams.get("category") || "best_total_time",
  );
  const [carClass, setCarClass] = useState(
    () => searchParams.get("carClass") || "all",
  );
  const [limit, setLimit] = useState(() => {
    const l = Number(searchParams.get("limit"));
    return (LIMITS as readonly number[]).includes(l) ? l : 10;
  });

  const [data, setData] = useState<WeeklyLeaderboardResponse | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const walletAddress = publicKey?.toBase58() || "";

  const fetchLeaderboard = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const params = new URLSearchParams({
        category,
        trackId: "city-loop",
        carClass,
        limit: String(limit),
      });
      if (walletAddress) params.set("walletAddress", walletAddress);

      const res = await fetch(`/api/weekly/leaderboard?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setData(json);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Weekly leaderboard unavailable");
      setStatus("error");
    }
  }, [category, carClass, limit, walletAddress]);

  useEffect(() => {
    void fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Sync filters to URL
  useEffect(() => {
    const p = new URLSearchParams();
    if (category !== "best_total_time") p.set("category", category);
    if (carClass !== "all") p.set("carClass", carClass);
    if (limit !== 10) p.set("limit", String(limit));
    const qs = p.toString();
    router.replace(qs ? `/weekly?${qs}` : "/weekly", { scroll: false });
  }, [category, carClass, limit, router]);

  if (!connected) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#3b0764,transparent_32%),#050509] p-6 text-white">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-lime-300">
            Wallet required
          </p>
          <h1 className="mt-3 text-4xl font-black">
            Connect wallet to see weekly competitions
          </h1>
          <p className="mt-4 text-white/60">
            Weekly leaderboards show the best racers of the current week.
          </p>
          <div className="mt-6 flex justify-center">
            <WalletMultiButton />
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#3b0764,transparent_32%),#050509] p-6 text-white">
        <div className="mx-auto max-w-md rounded-3xl border border-red-400/30 bg-red-500/10 p-8 text-center">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-red-300">
            Error
          </p>
          <p className="mt-3 text-white/70">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#3b0764,transparent_32%),#050509] p-4 text-white md:p-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-4xl font-black tracking-tight md:text-5xl">
            Weekly Competitions
          </h1>
          <p className="mt-2 text-sm text-white/50">
            {data?.weekId
              ? `Week ${data.weekId} — Compete every week for Race Cash rewards`
              : "Compete every week for Race Cash rewards"}
          </p>
        </div>

        {/* Nav */}
        <div className="mb-6 flex justify-center gap-4">
          <Link
            href="/race"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 hover:bg-white/10 hover:text-white"
          >
            Race
          </Link>
          <Link
            href="/missions"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 hover:bg-white/10 hover:text-white"
          >
            Missions
          </Link>
          <Link
            href="/leaderboard"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 hover:bg-white/10 hover:text-white"
          >
            Global
          </Link>
          <Link
            href="/garage"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 hover:bg-white/10 hover:text-white"
          >
            Garage
          </Link>
          <Link
            href="/race/multiplayer"
            className="rounded-full bg-gradient-to-r from-purple-500/70 to-cyan-400/70 px-4 py-2 text-sm font-bold text-black hover:from-purple-400 hover:to-cyan-300"
          >
            Multiplayer
          </Link>
        </div>

        {/* Filters */}
        <WeeklyFilters
          category={category}
          carClass={carClass}
          limit={limit}
          categories={CATEGORIES.map((c) => c.key)}
          classes={[...CLASSES]}
          limits={[...LIMITS]}
          onCategoryChange={setCategory}
          onCarClassChange={setCarClass}
          onLimitChange={setLimit}
        />

        {/* Your Rank card */}
        {connected && (
          <YourRankCard
            currentPlayer={data?.currentPlayer ?? null}
            hasData={data !== null}
            loading={status === "loading"}
            walletAddress={walletAddress}
            category={category}
          />
        )}

        {/* Prize Preview */}
        {data?.prizes && data.prizes.length > 0 && (
          <PrizePreviewCard prizes={data.prizes} distributionNote={data.distributionNote} />
        )}

        {/* Table */}
        <WeeklyLeaderboardTable
          entries={data?.entries ?? []}
          category={category}
          loading={status === "loading"}
          highlightedWallet={walletAddress}
        />
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Your Rank card                                                     */
/* ------------------------------------------------------------------ */

function YourRankCard({
  currentPlayer,
  hasData,
  loading,
  walletAddress,
  category,
}: {
  currentPlayer: WeeklyLeaderboardResponse["currentPlayer"];
  hasData: boolean;
  loading: boolean;
  walletAddress: string;
  category: string;
}) {
  if (loading && !hasData) {
    return (
      <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-2 text-sm text-white/40">
          <div className="size-4 animate-spin rounded-full border-2 border-fuchsia-300/40 border-t-transparent" />
          Loading your rank...
        </div>
      </div>
    );
  }

  if (!hasData) return null;

  if (!currentPlayer) {
    return (
      <div className="mb-4 rounded-2xl border border-amber-300/20 bg-amber-500/[0.06] p-5">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-amber-300/70">
          Your Weekly Rank
        </p>
        <p className="mt-2 text-sm text-white/50">
          Race this week to get ranked
        </p>
      </div>
    );
  }

  const e = currentPlayer.entry;
  const categoryLabel =
    { best_total_time: "Best Total Time", best_first_lap: "Best First Lap", best_lap: "Best Lap", race_cash_earned: "Race Cash Earned", missions_completed: "Missions Completed", races_finished: "Races Finished" }[
      category
    ] || category;

  let valueDisplay = String(e.value);
  if (["best_total_time", "best_first_lap", "best_lap"].includes(category)) {
    const ms = e.value;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis = ms % 1000;
    valueDisplay = `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
  } else if (category === "race_cash_earned") {
    valueDisplay = `${e.value.toLocaleString()} RC`;
  }

  return (
    <div className="mb-4 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/[0.06] p-5">
      <p className="text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300/70">
        Your Weekly Rank
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Stat label="Rank" value={`#${currentPlayer.rank}`} />
        <Stat label="Class" value={e.carClass} />
        <Stat label={categoryLabel} value={valueDisplay} />
        <Stat label="Races" value={String(e.racesFinished)} />
      </div>
      <p className="mt-2 text-xs text-white/30 truncate">{walletAddress}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
        {label}
      </p>
      <p className="text-sm font-black text-white">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Prize Preview card                                                 */
/* ------------------------------------------------------------------ */

function PrizePreviewCard({
  prizes,
  distributionNote,
}: {
  prizes: { rank: number; label: string; rewardAmount: number }[];
  distributionNote: string;
}) {
  return (
    <div className="mb-4 rounded-2xl border border-lime-300/20 bg-lime-500/[0.04] p-5">
      <p className="text-xs font-black uppercase tracking-[0.3em] text-lime-300/70">
        Weekly Prizes
      </p>
      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
        {prizes.map((p) => (
          <div
            key={p.rank}
            className="rounded-xl border border-lime-300/10 bg-black/20 px-3 py-3"
          >
            <p className="text-xs font-black text-lime-200/80">{p.label}</p>
            <p className="mt-1 text-lg font-black text-lime-300">
              {p.rewardAmount.toLocaleString()} RC
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-amber-300/50 italic">
        {distributionNote}
      </p>
    </div>
  );
}
