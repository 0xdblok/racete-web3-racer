"use client";

import Link from "next/link";
import type { RaceResult } from "@/lib/race/useRaceLoop";

type RaceResultsOverlayProps = {
  result: RaceResult;
  formatRaceTime: (ms: number) => string;
  carName: string;
  trackName: string;
  onRaceAgain: () => void;
  /** Multiplayer-ready placement. Defaults to 1 for solo/local runs. */
  placement?: number;
  totalPlayers?: number;
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

function StatBox({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${accent ? "border-lime-300/25 bg-lime-300/[0.08]" : "border-white/10 bg-white/[0.04]"}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">{label}</p>
      <p className={`mt-1 text-lg font-black ${accent ? "text-lime-200" : "text-white"}`}>{value}</p>
    </div>
  );
}
