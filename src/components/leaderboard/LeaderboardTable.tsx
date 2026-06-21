"use client";

import { formatRaceTime } from "@/lib/race/format";
import type { LeaderboardEntry } from "@/app/api/leaderboard/route";

type Props = {
  entries: LeaderboardEntry[];
  category: string;
  loading: boolean;
  highlightedWallet: string;
};

const COLUMNS = [
  { key: "rank", label: "Rank" },
  { key: "racer", label: "Racer" },
  { key: "class", label: "Class" },
  { key: "main", label: "" }, // dynamic label
  { key: "bestTotal", label: "Best Total" },
  { key: "bestFirstLap", label: "Best First Lap" },
  { key: "bestLap", label: "Best Lap" },
  { key: "races", label: "Races" },
  { key: "cash", label: "Race Cash" },
] as const;

function getMainStat(entry: LeaderboardEntry, category: string): string {
  switch (category) {
    case "best_total_time":
      return entry.bestTotalTimeMs != null
        ? formatRaceTime(entry.bestTotalTimeMs)
        : "\u2014";
    case "best_first_lap":
      return entry.bestFirstLapMs != null
        ? formatRaceTime(entry.bestFirstLapMs)
        : "\u2014";
    case "best_lap":
      return entry.bestLapMs != null
        ? formatRaceTime(entry.bestLapMs)
        : "\u2014";
    case "race_cash_earned":
      return `${entry.totalRaceCashEarned.toLocaleString()} RC`;
    case "races_finished":
      return String(entry.totalRacesFinished);
    default:
      return "\u2014";
  }
}

function getMainLabel(category: string): string {
  switch (category) {
    case "best_total_time":
      return "Best Total";
    case "best_first_lap":
      return "Best First Lap";
    case "best_lap":
      return "Best Lap";
    case "race_cash_earned":
      return "Race Cash";
    case "races_finished":
      return "Races";
    default:
      return "Score";
  }
}

export function LeaderboardTable({
  entries,
  category,
  loading,
  highlightedWallet,
}: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex h-10 items-center gap-4 border-b border-white/[0.04] last:border-0"
          >
            <div className="h-3 w-8 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-8 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-12 animate-pulse rounded bg-white/10" />
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
        <p className="text-sm font-black uppercase tracking-[0.3em] text-white/40">
          No racers yet
        </p>
        <p className="mt-2 text-xs text-white/30">
          Finish a race to appear on the leaderboard
        </p>
      </div>
    );
  }

  const mainLabel = getMainLabel(category);

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04]">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-[10px] font-black uppercase tracking-[0.2em] text-white/35">
            {COLUMNS.map((col) => {
              const label = col.key === "main" ? mainLabel : col.label;
              return (
                <th
                  key={col.key}
                  className={`whitespace-nowrap px-4 py-3 ${
                    col.key === "racer" ? "" : ""
                  }`}
                >
                  {label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {entries.map((entry) => {
            const isHighlighted =
              highlightedWallet &&
              entry.walletAddress === highlightedWallet;
            return (
              <tr
                key={`${entry.walletAddress}-${entry.carClass}`}
                className={`transition-colors ${
                  isHighlighted
                    ? "bg-fuchsia-500/[0.08] ring-1 ring-fuchsia-400/20"
                    : "hover:bg-white/[0.03]"
                }`}
              >
                <td className="px-4 py-3 font-black">
                  <span
                    className={`${
                      entry.rank <= 3
                        ? "text-fuchsia-300"
                        : "text-white/60"
                    }`}
                  >
                    #{entry.rank}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-white/70">
                  {entry.displayWallet}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-md border border-white/10 bg-black/20 px-2 py-0.5 text-xs font-bold text-white/50">
                    {entry.carClass}
                  </span>
                </td>
                <td className="px-4 py-3 font-black text-white">
                  {getMainStat(entry, category)}
                </td>
                <td className="px-4 py-3 text-white/50">
                  {entry.bestTotalTimeMs != null
                    ? formatRaceTime(entry.bestTotalTimeMs)
                    : "\u2014"}
                </td>
                <td className="px-4 py-3 text-white/50">
                  {entry.bestFirstLapMs != null
                    ? formatRaceTime(entry.bestFirstLapMs)
                    : "\u2014"}
                </td>
                <td className="px-4 py-3 text-white/50">
                  {entry.bestLapMs != null
                    ? formatRaceTime(entry.bestLapMs)
                    : "\u2014"}
                </td>
                <td className="px-4 py-3 text-white/50">
                  {entry.totalRacesFinished}
                </td>
                <td className="px-4 py-3 text-white/50">
                  {entry.totalRaceCashEarned.toLocaleString()} RC
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
