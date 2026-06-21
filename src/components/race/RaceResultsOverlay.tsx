"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { RaceResult } from "@/lib/race/useRaceLoop";
import type { RaceRewardBreakdown } from "@/config/rewards";

export type RewardClaimState = {
  status: "idle" | "claiming" | "paid" | "error";
  rewardAmount?: number;
  rewardBreakdown?: RaceRewardBreakdown;
  message?: string;
  completedObjectives?: Array<{
    objectiveId: string;
    title: string;
    rewardAmount: number;
  }>;
};

type RaceResultsOverlayProps = {
  result: RaceResult;
  formatRaceTime: (ms: number) => string;
  carName: string;
  trackName: string;
  onRaceAgain: () => void;
  placement?: number;
  totalPlayers?: number;
  rewardClaim?: RewardClaimState;
};

export function getOrdinal(value: number): string {
  const normalized = Math.max(1, Math.floor(value));
  const mod100 = normalized % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${normalized}th`;
  switch (normalized % 10) {
    case 1:  return `${normalized}st`;
    case 2:  return `${normalized}nd`;
    case 3:  return `${normalized}rd`;
    default: return `${normalized}th`;
  }
}

function getPlacementTitle(placement: number): string {
  return placement === 1 ? "Winner" : `${getOrdinal(placement)} Place`;
}

function getBonusValue(name: string, breakdown: RaceRewardBreakdown): number {
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

// ── Animated count-up ──────────────────────────────────────────────

function AnimatedRC({ target }: { target: number }) {
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (target <= 0) {
      setDisplay(target);
      return;
    }
    const duration = 800;
    const start = performance.now();
    let raf = 0;

    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out
      setDisplay(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return <span className="tabular-nums">{display}</span>;
}

// ── Format helper ──────────────────────────────────────────────────

function formatMsDisplay(ms: number): string {
  const safeMs = Math.max(0, Math.round(ms));
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const fraction = Math.floor((safeMs % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${fraction.toString().padStart(2, "0")}`;
}

// ── Main component ─────────────────────────────────────────────────

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
  const isClaiming = rewardClaim?.status === "claiming";
  const isPaid = rewardClaim?.status === "paid";
  const isError = rewardClaim?.status === "error";
  const total = rewardClaim?.rewardAmount ?? rewardClaim?.rewardBreakdown?.total ?? 0;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#050509]/85 p-2 sm:p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg rounded-[2rem] sm:rounded-[2.5rem] border border-lime-300/20 bg-[#0a0a12]/95 p-5 sm:p-8 text-center shadow-2xl shadow-lime-300/10 my-2">
        {/* Header */}
        <p className="text-xs sm:text-sm font-black uppercase tracking-[0.3em] sm:tracking-[0.4em] text-lime-300">
          Race Complete
        </p>
        <h2 className="mt-2 sm:mt-3 text-4xl sm:text-6xl font-black text-white drop-shadow-[0_0_30px_rgba(190,242,100,0.25)]">
          {title}
        </h2>
        <p className="mt-1 sm:mt-2 text-base sm:text-lg font-black uppercase tracking-[0.15em] sm:tracking-[0.25em] text-fuchsia-300">
          {ordinal} Place{fieldSize}
        </p>
        <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-white/55">
          {carName} · {trackName}
        </p>

        {/* Stat grid */}
        <div className="mt-5 sm:mt-8 grid grid-cols-3 gap-2 sm:gap-3">
          <StatBox label="Total Time" value={formatRaceTime(result.totalTimeMs)} accent />
          <StatBox label="Best Lap" value={result.bestLapTimeMs > 0 ? formatRaceTime(result.bestLapTimeMs) : "—"} />
          <StatBox label="First Lap" value={result.firstLapTimeMs > 0 ? formatRaceTime(result.firstLapTimeMs) : "—"} accent />
        </div>
        <div className="mt-2 sm:mt-3 grid grid-cols-3 gap-2 sm:gap-3">
          <StatBox label="Laps" value={`${result.lapsCompleted}`} />
          <StatBox label="Checkpoints" value={`${result.checkpointsPassed}`} />
          <StatBox
            label="Position"
            value={result.resetCount > 0 ? `${ordinal}${fieldSize} · ${result.resetCount} reset(s)` : `${ordinal}${fieldSize}`}
            accent={safePlacement === 1}
          />
        </div>

        {hasCleanIssues && (
          <p className="mt-2 text-[11px] sm:text-xs text-amber-300/70">
            {result.wrongWayTriggered && "⚠ Wrong way triggered. "}
            {result.resetCount > 0 && `⚠ ${result.resetCount} reset(s). `}
            <span className="text-white/40">(bonus affected)</span>
          </p>
        )}

        {/* ── Claiming state ── */}
        {isClaiming && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-center gap-3">
              <div className="size-5 animate-spin rounded-full border-2 border-lime-300/40 border-t-lime-300" />
              <p className="text-sm font-bold text-lime-200/80 animate-pulse">
                Calculating rewards...
              </p>
            </div>
            {total > 0 && (
              <p className="mt-3 text-2xl font-black text-white/50">
                +{total} RC
              </p>
            )}
          </div>
        )}

        {/* ── Paid: big RC + bonuses ── */}
        {isPaid && (
          <RewardBoxPaid total={total} breakdown={rewardClaim!.rewardBreakdown} />
        )}

        {/* ── Error ── */}
        {isError && (
          <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/10 p-4">
            <p className="text-sm font-bold text-red-200">
              {rewardClaim!.message || "Reward claim failed"}
            </p>
          </div>
        )}

        {/* ── New PB badges ── */}
        {isPaid && rewardClaim?.rewardBreakdown?.newRecords && (
          <NewPBBadges
            newRecords={rewardClaim.rewardBreakdown.newRecords}
            previousRecords={rewardClaim.rewardBreakdown.previousRecords}
          />
        )}

        {/* ── Missions completed ── */}
        {rewardClaim?.completedObjectives && rewardClaim.completedObjectives.length > 0 && (
          <CompletedObjectivesBox objectives={rewardClaim.completedObjectives} />
        )}

        {/* ── Buttons ── */}
        <div className="mt-6 sm:mt-8 flex flex-col gap-2 sm:gap-3">
          <button
            onClick={onRaceAgain}
            className="w-full rounded-full bg-lime-300 px-6 py-3 text-sm font-black text-black hover:bg-lime-200 active:scale-[0.98] transition-all"
          >
            Race Again
          </button>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <Link href="/garage" className="rounded-full border border-white/15 bg-white/[0.06] px-4 sm:px-5 py-3 text-xs sm:text-sm font-bold text-white hover:bg-white/10 text-center transition-colors">
              Garage
            </Link>
            <Link href="/missions" className="rounded-full border border-lime-300/25 bg-lime-300/[0.06] px-4 sm:px-5 py-3 text-xs sm:text-sm font-bold text-lime-200 hover:bg-lime-300/15 text-center transition-colors">
              Missions
            </Link>
            <Link href="/leaderboard" className="rounded-full border border-white/15 bg-white/[0.06] px-4 sm:px-5 py-3 text-xs sm:text-sm font-bold text-white hover:bg-white/10 text-center transition-colors">
              Leaderboard
            </Link>
            <Link href="/race/multiplayer" className="rounded-full border border-fuchsia-300/25 bg-fuchsia-500/[0.08] px-4 sm:px-5 py-3 text-xs sm:text-sm font-bold text-fuchsia-100 hover:bg-fuchsia-500/15 text-center transition-colors">
              Multiplayer
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Paid reward box with count-up ──────────────────────────────────

function RewardBoxPaid({ total, breakdown }: { total: number; breakdown?: RaceRewardBreakdown | null }) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  return (
    <div className="mt-5 rounded-2xl border border-lime-300/30 bg-lime-300/[0.08] p-5 animate-in fade-in">
      <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-lime-300/60">
        Race Cash Earned
      </p>
      <p className="mt-2 text-4xl sm:text-5xl font-black text-lime-200 drop-shadow-[0_0_20px_rgba(190,242,100,0.3)] tabular-nums">
        +<AnimatedRC target={total} /> RC
      </p>

      {/* Bonuses toggle */}
      {breakdown && breakdown.earnedBonuses.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="text-[10px] sm:text-xs font-bold text-lime-300/50 hover:text-lime-300/80 transition-colors"
          >
            {showBreakdown ? "Hide" : "Show"} bonus breakdown {showBreakdown ? "▲" : "▼"}
          </button>
          {showBreakdown && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {breakdown.earnedBonuses.map((bonus, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 rounded-xl bg-black/25 px-3 py-2 text-[11px] sm:text-xs">
                  <span className="text-white/70">{bonus}</span>
                  <b className="text-lime-200 shrink-0">+{getBonusValue(bonus, breakdown)}</b>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── New PB badges ──────────────────────────────────────────────────

function NewPBBadges({
  newRecords,
  previousRecords,
}: {
  newRecords: { bestTotalTimeMs?: number; bestFirstLapMs?: number; bestLapMs?: number } | null;
  previousRecords: { bestTotalTimeMs?: number; bestFirstLapMs?: number; bestLapMs?: number } | null;
}) {
  if (!newRecords || Object.keys(newRecords).length === 0) return null;

  return (
    <div className="mt-3 rounded-2xl border border-fuchsia-300/30 bg-fuchsia-500/[0.06] p-4">
      <p className="mb-3 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-300/70">
        🏆 New Personal Bests
      </p>
      <div className="space-y-2">
        {newRecords.bestTotalTimeMs !== undefined && (
          <PBBadge
            label="Total Time"
            prev={previousRecords?.bestTotalTimeMs}
            next={newRecords.bestTotalTimeMs}
          />
        )}
        {newRecords.bestFirstLapMs !== undefined && (
          <PBBadge
            label="First Lap"
            prev={previousRecords?.bestFirstLapMs}
            next={newRecords.bestFirstLapMs}
          />
        )}
        {newRecords.bestLapMs !== undefined && (
          <PBBadge
            label="Best Lap"
            prev={previousRecords?.bestLapMs}
            next={newRecords.bestLapMs}
          />
        )}
      </div>
    </div>
  );
}

function PBBadge({ label, prev, next }: { label: string; prev?: number; next: number }) {
  const diff = prev ? Math.abs(next - prev) : 0;
  const improved = prev ? next < prev : true;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-black/25 px-3 py-2 text-xs">
      <span className="font-bold text-fuchsia-200">{label}</span>
      <div className="flex items-center gap-2">
        {prev !== undefined && (
          <>
            <span className="text-white/30 line-through">{formatMsDisplay(prev)}</span>
            <span className="text-white/20">→</span>
          </>
        )}
        <b className="text-fuchsia-200">{formatMsDisplay(next)}</b>
        {improved && diff > 0 && (
          <span className="text-lime-300/80 text-[10px] font-bold">
            −{formatMsDisplay(diff)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Completed objectives box ───────────────────────────────────────

function CompletedObjectivesBox({
  objectives,
}: {
  objectives: Array<{ objectiveId: string; title: string; rewardAmount: number }>;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-fuchsia-300/25 bg-fuchsia-500/[0.06] p-4 text-left">
      <p className="mb-3 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-300/70">
        Missions Completed
      </p>
      <div className="space-y-2">
        {objectives.map((obj) => (
          <div key={obj.objectiveId} className="flex items-center justify-between gap-3 rounded-xl bg-black/25 px-3 py-2 text-[11px] sm:text-xs">
            <span className="text-white/80">{obj.title}</span>
            <b className="text-fuchsia-200 shrink-0">+{obj.rewardAmount} RC</b>
          </div>
        ))}
      </div>
      <Link
        href="/missions"
        className="mt-3 inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-lime-300/60 hover:text-lime-300 transition-colors"
      >
        Claim in Missions →
      </Link>
    </div>
  );
}

// ── Stat box ───────────────────────────────────────────────────────

function StatBox({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl sm:rounded-2xl border p-2 sm:p-3 ${accent ? "border-lime-300/25 bg-lime-300/[0.08]" : "border-white/10 bg-white/[0.04]"}`}>
      <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.15em] sm:tracking-[0.25em] text-white/40">{label}</p>
      <p className={`mt-0.5 sm:mt-1 text-base sm:text-lg font-black ${accent ? "text-lime-200" : "text-white"}`}>{value}</p>
    </div>
  );
}
