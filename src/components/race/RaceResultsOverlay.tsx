"use client";

import Link from "next/link";
import type { RaceResult } from "@/lib/race/useRaceLoop";
import type { RaceRewardBreakdown } from "@/config/rewards";

export type RewardClaimState = {
  status: "idle" | "claiming" | "paid" | "error";
  rewardAmount?: number;
  rewardBreakdown?: RaceRewardBreakdown;
  message?: string;
};

type RaceResultsOverlayProps = {
  result: RaceResult;
  formatRaceTime: (ms: number) => string;
  carName: string;
  trackName: string;
  onRaceAgain: () => void;
  /** Multiplayer-ready placement. Defaults to 1 for solo/local runs. */
  placement?: number;
  totalPlayers?: number;
  rewardClaim?: RewardClaimState;
};

export function getOrdinal(value: number): string {
  const normalized = Math.max(1, Math.floor(value));
  const mod100 = normalized % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${normalized}th`;

  switch (normalized % 10) {
    case 1:
      return `${normalized}st`;
    case 2:
      return `${normalized}nd`;
    case 3:
      return `${normalized}rd`;
    default:
      return `${normalized}th`;
  }
}

function getPlacementTitle(placement: number): string {
  return placement === 1 ? "Winner" : `${getOrdinal(placement)} Place`;
}

/** Map bonus short names to their values from the breakdown. */
function getBonusValue(
  name: string,
  breakdown: RaceRewardBreakdown,
): number {
  const key = name.toLowerCase();
  if (key.startsWith("finish")) return breakdown.finishReward;
  if (key.startsWith("target time")) return breakdown.targetTimeBonus;
  if (key.startsWith("personal best total time")) return breakdown.personalBestTotalBonus;
  if (key.startsWith("personal best first lap")) return breakdown.personalBestFirstLapBonus;
  if (key.startsWith("personal best lap")) return breakdown.personalBestLapBonus;
  if (key.startsWith("clean race")) return breakdown.cleanRaceBonus;
  if (key.startsWith("no resets")) return breakdown.noResetBonus;
  if (key.startsWith("no wrong way")) return breakdown.noWrongWayBonus;
  return 0;
}

export function RaceResultsOverlay({
  result,
  formatRaceTime,
  carName,
  trackName,
  onRaceAgain,
  placement = 1,
  totalPlayers,
  rewardClaim,
}: RaceResultsOverlayProps) {
  const safePlacement = Math.max(1, Math.floor(placement));
  const ordinal = getOrdinal(safePlacement);
  const title = getPlacementTitle(safePlacement);
  const fieldSize = totalPlayers ? ` / ${totalPlayers}` : "";
  const hasCleanIssues = result.wrongWayTriggered || result.resetCount > 0;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#050509]/85 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[2.5rem] border border-lime-300/20 bg-[#0a0a12]/95 p-8 text-center shadow-2xl shadow-lime-300/10">
        <p className="text-sm font-black uppercase tracking-[0.4em] text-lime-300">
          Race Complete
        </p>
        <h2 className="mt-3 text-6xl font-black text-white drop-shadow-[0_0_30px_rgba(190,242,100,0.25)]">
          {title}
        </h2>
        <p className="mt-2 text-lg font-black uppercase tracking-[0.25em] text-fuchsia-300">
          {ordinal} Place{fieldSize}
        </p>
        <p className="mt-2 text-sm text-white/55">
          You finished {ordinal} on {trackName} with {carName}.
        </p>

        {/* 3×2 stat grid: Total Time, Best Lap, First Lap / Laps, Checkpoints, Position/Resets */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          <StatBox
            label="Total Time"
            value={formatRaceTime(result.totalTimeMs)}
            accent
          />
          <StatBox
            label="Best Lap"
            value={
              result.bestLapTimeMs > 0
                ? formatRaceTime(result.bestLapTimeMs)
                : "—"
            }
          />
          <StatBox
            label="First Lap"
            value={
              result.firstLapTimeMs > 0
                ? formatRaceTime(result.firstLapTimeMs)
                : "—"
            }
            accent
          />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <StatBox label="Laps" value={`${result.lapsCompleted}`} />
          <StatBox label="Checkpoints" value={`${result.checkpointsPassed}`} />
          <StatBox
            label="Position"
            value={
              result.resetCount > 0
                ? `${ordinal}${fieldSize} · ${result.resetCount} reset(s)`
                : `${ordinal}${fieldSize}`
            }
            accent={safePlacement === 1}
          />
        </div>

        {/* Clean race note */}
        {hasCleanIssues && (
          <p className="mt-2 text-xs text-amber-300/70">
            {result.wrongWayTriggered && "⚠ Wrong way triggered. "}
            {result.resetCount > 0 && `⚠ ${result.resetCount} reset(s). `}
            <span className="text-white/40">(bonus affected)</span>
          </p>
        )}

        {rewardClaim && <RewardBox rewardClaim={rewardClaim} />}

        <div className="mt-8 flex flex-col gap-3">
          <button
            onClick={onRaceAgain}
            className="w-full rounded-full bg-lime-300 px-6 py-3 text-sm font-black text-black hover:bg-lime-200"
          >
            Race Again
          </button>
          <div className="flex gap-3">
            <Link
              href="/garage"
              className="flex-1 rounded-full border border-white/15 bg-white/[0.06] px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
            >
              Garage
            </Link>
            <Link
              href="/race/multiplayer"
              className="flex-1 rounded-full border border-fuchsia-300/30 bg-fuchsia-500/[0.12] px-5 py-3 text-sm font-bold text-fuchsia-100 hover:bg-fuchsia-500/20"
            >
              Find Match
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function RewardBox({ rewardClaim }: { rewardClaim: RewardClaimState }) {
  const breakdown = rewardClaim.rewardBreakdown;
  const isPaid = rewardClaim.status === "paid";
  const isError = rewardClaim.status === "error";
  const isClaiming = rewardClaim.status === "claiming";
  const total = rewardClaim.rewardAmount ?? breakdown?.total ?? 0;

  return (
    <div
      className={`mt-5 rounded-2xl border p-4 text-left ${
        isError
          ? "border-red-400/30 bg-red-500/10"
          : isPaid
            ? "border-lime-300/30 bg-lime-300/[0.08]"
            : "border-white/10 bg-white/[0.04]"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-white/45">
          Race Cash Reward
        </p>
        <p
          className={`text-lg font-black ${
            isError
              ? "text-red-200"
              : isPaid
                ? "text-lime-200"
                : "text-white/70"
          }`}
        >
          +{total}
        </p>
      </div>

      {/* Status message */}
      <p
        className={`mt-1 text-xs font-bold ${
          isError
            ? "text-red-200"
            : isPaid
              ? "text-lime-200/80"
              : "text-white/55"
        }`}
      >
        {isClaiming
          ? "Claiming..."
          : isError
            ? rewardClaim.message || "Reward claim failed"
            : rewardClaim.message || `+${total} Race Cash added.`}
      </p>

      {/* Earned bonuses */}
      {breakdown && breakdown.earnedBonuses.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-lime-300/60">
            Bonuses Earned
          </p>
          <div className="grid grid-cols-2 gap-2">
            {breakdown.earnedBonuses.map((bonus, idx) => {
              const value = getBonusValue(bonus, breakdown);
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 rounded-xl bg-black/25 px-3 py-2 text-xs"
                >
                  <span className="text-white/70">{bonus}</span>
                  <b className="text-lime-200 shrink-0">+{value}</b>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Missed bonuses */}
      {breakdown && breakdown.missedBonuses.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-white/25">
            Missed
          </p>
          <div className="flex flex-wrap gap-2">
            {breakdown.missedBonuses.map((bonus, idx) => (
              <span
                key={idx}
                className="rounded-lg bg-white/[0.03] px-2 py-1 text-[11px] text-white/30"
              >
                {bonus}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Personal records section */}
      {breakdown &&
        (breakdown.previousRecords || breakdown.newRecords) && (
          <div className="mt-4 border-t border-white/10 pt-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.25em] text-fuchsia-300/60">
              Personal Records
            </p>

            {/* Previous records */}
            {breakdown.previousRecords && (
              <div className="space-y-1 text-xs text-white/40">
                {breakdown.previousRecords.bestTotalTimeMs !== undefined && (
                  <p>
                    Previous Best Time:{" "}
                    <span className="text-white/60">
                      {formatMsDisplay(
                        breakdown.previousRecords.bestTotalTimeMs,
                      )}
                    </span>
                  </p>
                )}
                {breakdown.previousRecords.bestLapMs !== undefined && (
                  <p>
                    Previous Best Lap:{" "}
                    <span className="text-white/60">
                      {formatMsDisplay(
                        breakdown.previousRecords.bestLapMs,
                      )}
                    </span>
                  </p>
                )}
                {breakdown.previousRecords.bestFirstLapMs !== undefined && (
                  <p>
                    Previous Best First Lap:{" "}
                    <span className="text-white/60">
                      {formatMsDisplay(
                        breakdown.previousRecords.bestFirstLapMs,
                      )}
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* New records */}
            {breakdown.newRecords &&
              Object.keys(breakdown.newRecords).length > 0 && (
                <div className="mt-2 space-y-1">
                  {breakdown.newRecords.bestTotalTimeMs !== undefined && (
                    <p className="text-xs font-bold text-fuchsia-300">
                      🏆 New Personal Best Time!
                    </p>
                  )}
                  {breakdown.newRecords.bestLapMs !== undefined &&
                    breakdown.newRecords.bestTotalTimeMs === undefined && (
                      <p className="text-xs font-bold text-fuchsia-300">
                        🏆 New Best Lap!
                      </p>
                    )}
                  {breakdown.newRecords.bestFirstLapMs !== undefined && (
                    <p className="text-xs font-bold text-fuchsia-300">
                      🏆 New Best First Lap!
                    </p>
                  )}
                </div>
              )}
          </div>
        )}
    </div>
  );
}

function StatBox({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 ${
        accent
          ? "border-lime-300/25 bg-lime-300/[0.08]"
          : "border-white/10 bg-white/[0.04]"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-black ${
          accent ? "text-lime-200" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function formatMsDisplay(ms: number): string {
  const safeMs = Math.max(0, Math.round(ms));
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const fraction = Math.floor((safeMs % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${fraction
    .toString()
    .padStart(2, "0")}`;
}
