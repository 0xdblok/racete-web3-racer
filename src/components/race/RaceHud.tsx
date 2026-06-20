"use client";

import { useMemo } from "react";
import { formatNumber, shortWallet } from "@/lib/format";
import { resolveCarGameplayStats } from "@/lib/car-gameplay-stats";
import { formatRaceTime } from "@/lib/race/useRaceLoop";
import type { CarConfig } from "@/config/cars";
import type { TrackConfig } from "@/config/tracks";
import type { PlayerCar } from "@/types/game";
import type { RaceProgress } from "@/lib/race/useRaceLoop";

/** Convert internal game speed to display km/h.
 *  Internal maxSpeed ranges ~21 (starter) to ~85 (Bugatti).
 *  Multiply by ~3.1 to get believable km/h: 85 → 264 km/h. */
const SPEED_TO_KMH = 3.1;

type RaceHudProps = {
  walletAddress: string;
  car: CarConfig;
  selectedCar: PlayerCar;
  track: TrackConfig;
  /** Show multiplayer label instead of solo */
  multiplayer?: boolean;
  /** Live race telemetry (updated every frame from controller) */
  telemetry?: {
    speed: number;
    nitroFuel: number;
    nitroCooldown: boolean;
    drifting: boolean;
  } | null;
  /** Race progress: laps, checkpoints, timing */
  raceProgress?: RaceProgress | null;
};

export function RaceHud({
  walletAddress,
  car,
  selectedCar,
  track,
  telemetry,
  multiplayer = false,
  raceProgress,
}: RaceHudProps) {
  const stats = useMemo(
    () => resolveCarGameplayStats(car, selectedCar),
    [car, selectedCar],
  );

  const currentSpeedRaw = telemetry ? Math.abs(telemetry.speed) : 0;
  const currentSpeed = Math.round(currentSpeedRaw * SPEED_TO_KMH);
  const speedPct = telemetry ? Math.min(Math.abs(telemetry.speed) / stats.maxSpeed, 1) : 0;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-4 md:p-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-3">
        {/* Track info */}
        <div className="rounded-3xl border border-white/10 bg-black/60 p-4 shadow-2xl shadow-black/40 backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-lime-300">{multiplayer ? "Multiplayer" : "Solo Race"}</p>
          <h1 className="mt-1 text-2xl font-black text-white">{track.name}</h1>
          <p className="mt-1 max-w-sm text-sm text-white/60">{track.description}</p>
          {raceProgress && raceProgress.phase !== "waiting" && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <ProgressStat label="Lap" value={`${raceProgress.lap}/${track.lapCount}`} active />
              <ProgressStat label="Checkpoint" value={`${raceProgress.currentCheckpointIndex + 1}/${raceProgress.totalCheckpoints}`} active />
              <ProgressStat label="Time" value={formatRaceTime(raceProgress.totalRaceTimeMs)} />
              <ProgressStat label="Best Lap" value={raceProgress.bestLapTimeMs > 0 ? formatRaceTime(raceProgress.bestLapTimeMs) : "—"} />
            </div>
          )}
          {raceProgress?.wrongWayHint && (
            <p className="mt-3 inline-flex animate-pulse items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-amber-200 shadow-[0_0_15px_rgba(251,191,36,0.3)]">
              <span>⚠</span>
              Wrong way — turn around
            </p>
          )}
        </div>

        {/* Car info + telemetry */}
        <div className="grid min-w-80 gap-2 rounded-3xl border border-fuchsia-300/20 bg-black/60 p-4 text-sm text-white/75 shadow-2xl shadow-black/40 backdrop-blur">
          <div className="flex justify-between gap-4">
            <span>Wallet</span>
            <b className="text-white">{shortWallet(walletAddress)}</b>
          </div>
          <div className="flex justify-between gap-4">
            <span>Car</span>
            <b className="text-lime-200">{car.name}</b>
          </div>
          <div className="flex justify-between gap-4">
            <span>Class / PR</span>
            <b className="text-fuchsia-200">{car.class} · {formatNumber(selectedCar.power_rating)}</b>
          </div>

          {/* Speed + nitro bar */}
          <div className="border-t border-white/10 pt-2">
            <div className="flex justify-between items-end mb-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">Speed</span>
              <span className="text-lg font-black text-lime-300">{currentSpeed} <span className="text-xs text-lime-300/60">km/h</span></span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-lime-400 transition-all duration-75"
                style={{ width: `${speedPct * 100}%` }}
              />
            </div>
            {telemetry && (
              <div className="flex justify-between mt-1 text-[9px] text-white/40">
                <span>Max: {Math.round(stats.maxSpeed * SPEED_TO_KMH)} km/h</span>
                <span>
                  {telemetry.drifting ? "🌀 Drift" : telemetry.nitroCooldown ? "⏳ Nitro CD" : telemetry.nitroFuel > 0 ? "⚡ Nitro ready" : ""}
                </span>
              </div>
            )}
          </div>

          {/* Upgrade levels */}
          <div className="border-t border-white/10 pt-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/40 mb-1.5">Upgrades</p>
            <div className="grid grid-cols-4 gap-1 text-[10px] font-bold">
              <UpgradeBadge label="ENG" level={stats.engineLevel} color="text-red-300" />
              <UpgradeBadge label="TIR" level={stats.tiresLevel} color="text-blue-300" />
              <UpgradeBadge label="N2O" level={stats.nitroLevel} color="text-yellow-300" />
              <UpgradeBadge label="HDL" level={stats.handlingLevel} color="text-purple-300" />
            </div>
          </div>
        </div>

        {/* Controls helper */}
        <div className="rounded-3xl border border-white/10 bg-black/60 p-4 shadow-2xl shadow-black/40 backdrop-blur text-xs text-white/50">
          <p className="font-bold uppercase tracking-[0.25em] text-white/40 mb-2">Controls</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span>↑ Accelerate</span><span>↓ Brake/Reverse</span>
            <span>← → Steer</span><span>Space Nitro</span>
            <span>Shift Drift</span><span>R Reset</span>
            <span className="text-white/25">WASD</span><span className="text-white/25">backup</span>
            <span>Wheel / +-</span><span>Camera zoom</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function UpgradeBadge({
  label,
  level,
  color,
}: {
  label: string;
  level: number;
  color: string;
}) {
  return (
    <div className="rounded-full border border-white/10 px-2 py-0.5 text-center">
      <span className={color}>Lv{level}</span>{" "}
      <span className="text-white/40">{label}</span>
    </div>
  );
}

function ProgressStat({ label, value, active }: { label: string; value: string; active?: boolean }) {
  return (
    <div className={`rounded-xl border px-2.5 py-1.5 text-center ${active ? "border-lime-300/25 bg-lime-300/[0.08]" : "border-white/10 bg-white/[0.04]"}`}>
      <p className="text-[9px] font-bold uppercase tracking-widest text-white/40">{label}</p>
      <p className={`text-sm font-black ${active ? "text-lime-300" : "text-white"}`}>{value}</p>
    </div>
  );
}
