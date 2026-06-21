"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { LeaderboardFilters } from "@/components/leaderboard/LeaderboardFilters";
import type {
  LeaderboardResponse,
  LeaderboardEntry,
} from "@/app/api/leaderboard/route";

const CATEGORIES = [
  { key: "best_total_time", label: "Best Total Time" },
  { key: "best_first_lap", label: "Best First Lap" },
  { key: "best_lap", label: "Best Lap" },
  { key: "race_cash_earned", label: "Race Cash Earned" },
  { key: "races_finished", label: "Races Finished" },
] as const;

const CLASSES = ["all", "D", "C", "C+", "B", "B+", "A", "S"] as const;

const LIMITS = [10, 25, 50] as const;

export function LeaderboardPageClientInner() {
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

  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const walletAddress = publicKey?.toBase58() || "";

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        category,
        trackId: "city-loop",
        carClass,
        limit: String(limit),
      });
      if (walletAddress) params.set("walletAddress", walletAddress);

      const res = await fetch(`/api/leaderboard?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Leaderboard unavailable");
    } finally {
      setLoading(false);
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
    router.replace(qs ? `/leaderboard?${qs}` : "/leaderboard", {
      scroll: false,
    });
  }, [category, carClass, limit, router]);

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
            Global Leaderboard
          </h1>
          <p className="mt-2 text-sm text-white/50">
            City Loop records, Race Cash grinders, and class rankings
          </p>
        </div>

        {/* Nav */}
        <div className="mb-4 flex justify-center gap-3">
          <Link href="/race" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/50 hover:bg-white/10 hover:text-white">Race</Link>
          <Link href="/missions" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/50 hover:bg-white/10 hover:text-white">Missions</Link>
          <Link href="/weekly" className="rounded-full border border-amber-300/20 bg-amber-300/5 px-4 py-2 text-xs font-bold text-amber-200/70 hover:bg-amber-300/10">Weekly</Link>
          <Link href="/garage" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/50 hover:bg-white/10 hover:text-white">Garage</Link>
        </div>

        {/* Filters */}
        <LeaderboardFilters
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
            loading={loading}
            walletAddress={walletAddress}
          />
        )}

        {/* Table */}
        <LeaderboardTable
          entries={data?.entries ?? []}
          category={category}
          loading={loading}
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
}: {
  currentPlayer: LeaderboardResponse["currentPlayer"];
  hasData: boolean;
  loading: boolean;
  walletAddress: string;
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
          Your Rank
        </p>
        <p className="mt-2 text-sm text-white/50">
          Finish a race to get ranked
        </p>
      </div>
    );
  }

  const e = currentPlayer.entry;
  return (
    <div className="mb-4 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/[0.06] p-5">
      <p className="text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300/70">
        Your Rank
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Stat label="Rank" value={`#${currentPlayer.rank}`} />
        <Stat label="Class" value={e.carClass} />
        <Stat label="Races" value={String(e.totalRacesFinished)} />
        <Stat
          label="Race Cash"
          value={`${e.totalRaceCashEarned.toLocaleString()} RC`}
        />
      </div>
      <p className="mt-2 text-xs text-white/30 truncate">
        {walletAddress}
      </p>
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
