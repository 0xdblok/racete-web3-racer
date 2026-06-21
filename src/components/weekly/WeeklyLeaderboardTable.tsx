"use client";

import type { WeeklyEntry } from "@/app/api/weekly/leaderboard/route";
import type { WeeklyCategory } from "@/lib/weekly";

function formatTimeMs(ms: number | null): string {
  if (ms === null || ms <= 0) return "—";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${minutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

export function WeeklyLeaderboardTable({
  entries,
  category,
  loading,
  highlightedWallet,
}: {
  entries: WeeklyEntry[];
  category: string;
  loading: boolean;
  highlightedWallet: string;
}) {
  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3 text-white/40">
          <div className="size-5 animate-spin rounded-full border-2 border-fuchsia-300/40 border-t-transparent" />
          <span className="text-sm">Loading weekly leaderboard...</span>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
        <p className="text-2xl">🏁</p>
        <p className="mt-3 text-sm font-black uppercase tracking-[0.3em] text-white/30">
          No weekly racers yet
        </p>
        <p className="mt-2 text-xs text-white/30">
          Finish a race this week to rank on the weekly leaderboard
        </p>
      </div>
    );
  }

  // Column widths: Rank(8) Racer(20) Class(8) MainStat(16) BestTotal(14) BestLap(14) Races(8) RC(10) Missions(8)
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-white/[0.02]">
      <table className="w-full min-w-[800px] text-left text-xs">
        <thead>
          <tr className="border-b border-white/[0.06] text-white/30">
            <th className="px-4 py-3 font-black uppercase tracking-[0.2em]">
              #
            </th>
            <th className="px-4 py-3 font-black uppercase tracking-[0.2em]">
              Racer
            </th>
            <th className="px-4 py-3 font-black uppercase tracking-[0.2em]">
              Class
            </th>
            <th className="px-4 py-3 font-black uppercase tracking-[0.2em]">
              {getMainStatHeader(category)}
            </th>
            <th className="px-4 py-3 font-black uppercase tracking-[0.2em]">
              Best Total
            </th>
            <th className="px-4 py-3 font-black uppercase tracking-[0.2em]">
              Best Lap
            </th>
            <th className="px-4 py-3 font-black uppercase tracking-[0.2em]">
              Races
            </th>
            <th className="px-4 py-3 font-black uppercase tracking-[0.2em]">
              RC
            </th>
            <th className="px-4 py-3 font-black uppercase tracking-[0.2em]">
              Missions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {entries.map((entry) => {
            const isHighlighted = highlightedWallet && entry.walletAddress === highlightedWallet;
            const mainValue = formatMainValue(category, entry.value);
            return (
              <tr
                key={entry.walletAddress}
                className={`transition-colors hover:bg-white/[0.03] ${
                  isHighlighted ? "bg-fuchsia-500/[0.08]" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-black ${
                      entry.rank === 1
                        ? "bg-yellow-400/20 text-yellow-300"
                        : entry.rank === 2
                          ? "bg-slate-300/15 text-slate-300"
                          : entry.rank === 3
                            ? "bg-amber-600/15 text-amber-400"
                            : "text-white/50"
                    }`}
                  >
                    {entry.rank}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-white/70">
                  {entry.displayWallet}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-black text-white/60">
                    {entry.carClass}
                  </span>
                </td>
                <td
                  className={`px-4 py-3 font-mono text-sm ${
                    isHighlighted
                      ? "font-black text-fuchsia-300"
                      : "font-bold text-white"
                  }`}
                >
                  {mainValue}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-white/50">
                  {formatTimeMs(entry.bestTotalTimeMs)}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-white/50">
                  {formatTimeMs(entry.bestLapMs)}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-white/50">
                  {entry.racesFinished}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-white/50">
                  {entry.raceCashEarned.toLocaleString()}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-white/50">
                  {entry.missionsCompleted}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function getMainStatHeader(category: string): string {
  const map: Record<string, string> = {
    best_total_time: "Best Total",
    best_first_lap: "Best 1st Lap",
    best_lap: "Best Lap",
    race_cash_earned: "RC Earned",
    missions_completed: "Missions",
    races_finished: "Races",
  };
  return map[category] || category;
}

function formatMainValue(category: string, value: number): string {
  if (
    ["best_total_time", "best_first_lap", "best_lap"].includes(category)
  ) {
    return formatTimeMs(value);
  }
  if (category === "race_cash_earned") {
    return `${value.toLocaleString()} RC`;
  }
  return String(value);
}
