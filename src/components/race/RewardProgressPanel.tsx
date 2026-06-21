"use client";

import { formatRaceTime } from "@/lib/race/format";
import type { RecordsResponse } from "@/app/api/race/records/route";

type RewardProgressPanelProps = {
  data: RecordsResponse | null;
  loading: boolean;
};

type ChaseItem = {
  label: string;
  reward: number;
  requirement: string;
  status: "chaseable" | "locked" | "need-first-record";
};

export function RewardProgressPanel({ data, loading }: RewardProgressPanelProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300/60">
          Reward Progress
        </p>
        <div className="mt-3 flex items-center gap-2 text-sm text-white/40">
          <div className="size-4 animate-spin rounded-full border-2 border-fuchsia-300/40 border-t-transparent" />
          Loading rewards...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300/60">
          Reward Progress
        </p>
        <p className="mt-2 text-sm text-white/40">Connect wallet to see progress.</p>
      </div>
    );
  }

  const { records, hasRecord, targets, bonuses } = data;

  const items: ChaseItem[] = [];

  // Target time — always chaseable
  items.push({
    label: "Beat target time",
    reward: bonuses.targetTimeBonus,
    requirement: `Finish under ${formatRaceTime(targets.totalMs)}`,
    status: "chaseable",
  });

  // Personal bests — need a record first
  if (hasRecord && records) {
    if (records.bestTotalTimeMs != null) {
      items.push({
        label: "Beat your total PB",
        reward: bonuses.personalBestTotalBonus,
        requirement: `Faster than ${formatRaceTime(records.bestTotalTimeMs)}`,
        status: "chaseable",
      });
    }
    if (records.bestFirstLapMs != null) {
      items.push({
        label: "Beat your first lap PB",
        reward: bonuses.personalBestFirstLapBonus,
        requirement: `Faster than ${formatRaceTime(records.bestFirstLapMs)}`,
        status: "chaseable",
      });
    }
    if (records.bestLapMs != null) {
      items.push({
        label: "Beat your best lap PB",
        reward: bonuses.personalBestLapBonus,
        requirement: `Faster than ${formatRaceTime(records.bestLapMs)}`,
        status: "chaseable",
      });
    }
  } else {
    items.push(
      {
        label: "Beat your total PB",
        reward: bonuses.personalBestTotalBonus,
        requirement: "Set your first record first",
        status: "need-first-record",
      },
      {
        label: "Beat your first lap PB",
        reward: bonuses.personalBestFirstLapBonus,
        requirement: "Set your first record first",
        status: "need-first-record",
      },
      {
        label: "Beat your best lap PB",
        reward: bonuses.personalBestLapBonus,
        requirement: "Set your first record first",
        status: "need-first-record",
      },
    );
  }

  // Always chaseable bonuses
  items.push(
    {
      label: "Clean Race",
      reward: bonuses.cleanRaceBonus,
      requirement: "No wrong-way triggers",
      status: "chaseable",
    },
    {
      label: "No Reset",
      reward: bonuses.noResetBonus,
      requirement: "Finish without pressing reset",
      status: "chaseable",
    },
    {
      label: "No Wrong Way",
      reward: bonuses.noWrongWayBonus,
      requirement: "Perfect checkpoint route",
      status: "chaseable",
    },
  );

  return (
    <div className="rounded-2xl border border-fuchsia-300/15 bg-fuchsia-500/[0.04] p-5">
      <p className="text-xs font-black uppercase tracking-[0.3em] text-fuchsia-300/60">
        Reward Progress
      </p>
      <p className="mt-1 text-xs text-white/40">
        Bonuses you can earn in your next race
      </p>
      <div className="mt-4 grid gap-2">
        {items.map((item, idx) => (
          <div
            key={idx}
            className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs ${
              item.status === "need-first-record"
                ? "bg-white/[0.02] text-white/25"
                : "bg-black/25 text-white/70"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className={`font-bold ${
                item.status === "need-first-record" ? "text-white/35" : "text-white/80"
              }`}>
                {item.label}
              </p>
              <p className="truncate text-white/35">{item.requirement}</p>
            </div>
            <b className={`shrink-0 ${
              item.status === "need-first-record"
                ? "text-white/20"
                : "text-fuchsia-200"
            }`}>
              +{item.reward} RC
            </b>
          </div>
        ))}
      </div>
    </div>
  );
}
