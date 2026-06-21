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

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#050509]/85 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[2.5rem] border border-lime-300/20 bg-[#0a0a12]/95 p-8 text-center shadow-2xl shadow-lime-300/10">
        <p className="text-sm font-black uppercase tracking-[0.4em] text-lime-300">Race Complete</p>
        <h2 className="mt-3 text-6xl font-black text-white drop-shadow-[0_0_30px_rgba(190,242,100,0.25)]">{title}</h2>
        <p className="mt-2 text-lg font-black uppercase tracking-[0.25em] text-fuchsia-300">
          {ordinal} Place{fieldSize}
        </p>
        <p className="mt-2 text-sm text-white/55">
          You finished {ordinal} on {trackName} with {carName}.
        </p>

        <div className="mt-8 grid grid-cols-3 gap-3">
          <StatBox label="Total Time" value={formatRaceTime(result.totalTimeMs)} accent />
          <StatBox label="Best Lap" value={result.bestLapTimeMs > 0 ? formatRaceTime(result.bestLapTimeMs) : "—"} />
          <StatBox label="Laps" value={`${result.lapsCompleted}`} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatBox label="Checkpoints" value={`${result.checkpointsPassed}`} />
          <StatBox label="Position" value={`${ordinal}${fieldSize}`} accent={safePlacement === 1} />
        </div>

        {rewardClaim && (
          <RewardBox rewardClaim={rewardClaim} />
        )}

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

  return (
    <div className={`mt-5 rounded-2xl border p-4 text-left ${
      isError
        ? "border-red-400/30 bg-red-500/10"
        : isPaid
          ? "border-lime-300/30 bg-lime-300/[0.08]"
          : "border-white/10 bg-white/[0.04]"
    }`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-white/45">Race Cash Reward</p>
        <p className={`text-sm font-black ${isError ? "text-red-200" : isPaid ? "text-lime-200" : "text-white/70"}`}>
          {rewardClaim.status === "claiming" ? "Claiming..." : isPaid ? `+${rewardClaim.rewardAmount ?? breakdown?.total ?? 0} Race Cash` : "Not paid"}
        </p>
      </div>

      {breakdown && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/65">
          <RewardLine label="Finish" value={breakdown.finish} />
          <RewardLine label="Best Lap Bonus" value={breakdown.bestLap} />
          <RewardLine label="Clean Race Bonus" value={breakdown.cleanRace} />
          <RewardLine label="Fast Finish Bonus" value={breakdown.fastFinish} />
        </div>
      )}

      <p className={`mt-3 text-sm font-bold ${isError ? "text-red-200" : isPaid ? "text-lime-200" : "text-white/55"}`}>
        {rewardClaim.message || (isPaid ? `+${rewardClaim.rewardAmount ?? 0} Race Cash added.` : "Reward claim pending.")}
      </p>
    </div>
  );
}

function RewardLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-3 rounded-xl bg-black/25 px-3 py-2">
      <span>{label}</span>
      <b className="text-lime-200">+{value}</b>
    </div>
  );
}

function StatBox({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${accent ? "border-lime-300/25 bg-lime-300/[0.08]" : "border-white/10 bg-white/[0.04]"}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">{label}</p>
      <p className={`mt-1 text-lg font-black ${accent ? "text-lime-200" : "text-white"}`}>{value}</p>
    </div>
  );
}
