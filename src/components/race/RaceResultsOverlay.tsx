"use client";

import Link from "next/link";
import type { RaceResult } from "@/lib/race/useRaceLoop";

type RaceResultsOverlayProps = {
  result: RaceResult;
  formatRaceTime: (ms: number) => string;
  carName: string;
  trackName: string;
  onRaceAgain: () => void;
};

export function RaceResultsOverlay({
  result,
  formatRaceTime,
  carName,
  trackName,
  onRaceAgain,
}: RaceResultsOverlayProps) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#050509]/85 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-[2.5rem] border border-lime-300/20 bg-[#0a0a12]/95 p-8 text-center shadow-2xl shadow-lime-300/10">
        <p className="text-sm font-black uppercase tracking-[0.4em] text-lime-300">Finished</p>
        <h2 className="mt-3 text-5xl font-black text-white">{formatRaceTime(result.totalTimeMs)}</h2>
        <p className="mt-2 text-white/50">
          {carName} · {trackName}
        </p>

        <div className="mt-8 grid grid-cols-3 gap-3">
          <StatBox label="Best Lap" value={result.bestLapTimeMs > 0 ? formatRaceTime(result.bestLapTimeMs) : "—"} />
          <StatBox label="Laps" value={`${result.lapsCompleted}/${result.lapsCompleted}`} />
          <StatBox label="Checkpoints" value={`${result.checkpointsPassed}`} />
        </div>

        {/* Placement placeholder */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/40">Placement</p>
          <p className="mt-1 text-3xl font-black text-fuchsia-300">Solo Run</p>
          <p className="text-xs text-white/40">Multiplayer placement will appear here in ranked races.</p>
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

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}
