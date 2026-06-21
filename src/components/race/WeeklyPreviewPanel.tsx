"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { WeeklyLeaderboardResponse } from "@/app/api/weekly/leaderboard/route";

type Props = {
  walletAddress: string;
  carClass: string;
};

export function WeeklyPreviewPanel({ walletAddress, carClass }: Props) {
  const [data, setData] = useState<WeeklyLeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWeekly = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        category: "best_total_time",
        trackId: "city-loop",
        carClass,
        limit: "3",
        walletAddress,
      });
      const res = await fetch(`/api/weekly/leaderboard?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // non-fatal — preview is optional
    } finally {
      setLoading(false);
    }
  }, [walletAddress, carClass]);

  useEffect(() => {
    void fetchWeekly();
  }, [fetchWeekly]);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="size-3 animate-spin rounded-full border-2 border-amber-300/30 border-t-transparent" />
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/30">
            Weekly...
          </p>
        </div>
      </div>
    );
  }

  if (!data || data.entries.length === 0) {
    return (
      <div className="rounded-xl border border-amber-300/15 bg-amber-500/[0.04] p-4 backdrop-blur">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300/60">
          Weekly
        </p>
        <p className="mt-1 text-xs text-white/35">
          No racers yet this week — be the first!
        </p>
      </div>
    );
  }

  const top3 = data.entries.slice(0, 3);
  const player = data.currentPlayer;

  return (
    <div className="rounded-xl border border-amber-300/15 bg-amber-500/[0.04] p-4 backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300/60">
          Weekly {data.weekId}
        </p>
        <Link
          href="/weekly"
          className="text-[10px] font-bold text-amber-300/50 hover:text-amber-200 underline"
        >
          Full rankings →
        </Link>
      </div>

      {/* Top 3 */}
      <div className="space-y-1.5">
        {top3.map((entry) => (
          <div
            key={entry.walletAddress}
            className={`flex items-center gap-2 rounded-lg px-2 py-1 text-xs ${
              player && entry.walletAddress === player.entry.walletAddress
                ? "bg-amber-400/10"
                : ""
            }`}
          >
            <span className="w-5 text-center font-black text-white/40">
              #{entry.rank}
            </span>
            <span className="flex-1 truncate font-mono text-[11px] text-white/60">
              {entry.displayWallet}
            </span>
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-black text-white/40">
              {entry.carClass}
            </span>
            <span className="font-mono text-[11px] text-amber-200/70 tabular-nums">
              {formatShort(entry.value)}
            </span>
          </div>
        ))}
      </div>

      {/* Your rank */}
      {player && (
        <div className="mt-2 rounded-lg border border-fuchsia-400/15 bg-fuchsia-500/[0.06] px-2 py-1.5">
          <p className="text-[10px] font-bold text-fuchsia-300/60">
            You: #{player.rank} this week • {formatShort(player.entry.value)}
          </p>
        </div>
      )}
      {!player && (
        <p className="mt-2 text-[10px] text-white/25">
          Finish a race this week to get ranked
        </p>
      )}
    </div>
  );
}

function formatShort(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
