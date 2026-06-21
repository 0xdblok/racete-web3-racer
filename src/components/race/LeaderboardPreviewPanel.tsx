"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatRaceTime } from "@/lib/race/format";
import { shortWallet } from "@/lib/format";
import type { LeaderboardResponse } from "@/app/api/leaderboard/route";

type Props = {
  walletAddress: string;
  carClass: string;
};

export function LeaderboardPreviewPanel({ walletAddress, carClass }: Props) {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({
      category: "best_total_time",
      trackId: "city-loop",
      carClass,
      limit: "5",
    });
    if (walletAddress) params.set("walletAddress", walletAddress);

    fetch(`/api/leaderboard?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [walletAddress, carClass]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300/60">
          Leaderboard
        </p>
        <div className="mt-3 flex items-center gap-2 text-sm text-white/40">
          <div className="size-4 animate-spin rounded-full border-2 border-fuchsia-300/40 border-t-transparent" />
          Loading leaderboard...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300/60">
          Leaderboard
        </p>
        <p className="mt-2 text-sm text-white/40">Records unavailable</p>
      </div>
    );
  }

  const { entries, currentPlayer } = data;

  return (
    <div className="rounded-2xl border border-fuchsia-300/10 bg-fuchsia-500/[0.03] p-4">
      <p className="text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300/60">
        Leaderboard
      </p>
      <p className="mt-1 text-[10px] text-white/35">
        Best Total Time · Class {carClass} · City Loop
      </p>

      {/* Top entries */}
      <div className="mt-3 divide-y divide-white/[0.05]">
        {entries.length === 0 ? (
          <p className="py-2 text-xs text-white/30">
            No racers yet. Finish a race to set your record!
          </p>
        ) : (
          entries.slice(0, 3).map((entry) => (
            <div
              key={`${entry.walletAddress}-${entry.carClass}`}
              className={`flex items-center justify-between py-1.5 text-xs ${
                entry.walletAddress === walletAddress
                  ? "text-fuchsia-200"
                  : "text-white/60"
              }`}
            >
              <span className="flex items-center gap-2">
                <b className="w-5 text-fuchsia-300/80">#{entry.rank}</b>
                <span className="font-mono">{entry.displayWallet}</span>
              </span>
              <b>
                {entry.bestTotalTimeMs != null
                  ? formatRaceTime(entry.bestTotalTimeMs)
                  : "\u2014"}
              </b>
            </div>
          ))
        )}
      </div>

      {/* Current player rank */}
      {walletAddress && (
        <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2 text-xs">
          {currentPlayer ? (
            <span className="text-white/60">
              Your rank:{" "}
              <b className="text-fuchsia-200">#{currentPlayer.rank}</b>
              {" · "}
              {currentPlayer.entry.totalRacesFinished} races
              {" · "}
              {currentPlayer.entry.totalRaceCashEarned.toLocaleString()} RC
            </span>
          ) : (
            <span className="text-white/35">
              Finish a race to get ranked
            </span>
          )}
        </div>
      )}

      <Link
        href="/leaderboard"
        className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-bold text-white/45 transition-colors hover:bg-white/[0.08] hover:text-white/70"
      >
        View full leaderboard →
      </Link>
    </div>
  );
}
