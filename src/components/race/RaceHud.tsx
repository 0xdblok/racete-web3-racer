import { useMemo } from "react";
import { formatNumber, shortWallet } from "@/lib/format";
import { resolveCarGameplayStats } from "@/lib/car-gameplay-stats";
import type { CarConfig } from "@/config/cars";
import type { TrackConfig } from "@/config/tracks";
import type { PlayerCar } from "@/types/game";

type RaceHudProps = {
  walletAddress: string;
  car: CarConfig;
  selectedCar: PlayerCar;
  track: TrackConfig;
};

export function RaceHud({ walletAddress, car, selectedCar, track }: RaceHudProps) {
  const stats = useMemo(
    () => resolveCarGameplayStats(car, selectedCar),
    [car, selectedCar],
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-4 md:p-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-3">
        {/* Track info */}
        <div className="rounded-3xl border border-white/10 bg-black/60 p-4 shadow-2xl shadow-black/40 backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-lime-300">Solo shell</p>
          <h1 className="mt-1 text-2xl font-black text-white">{track.name}</h1>
          <p className="mt-1 max-w-sm text-sm text-white/60">{track.description}</p>
        </div>

        {/* Car info + upgrades + resolved stats */}
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
            <b className="text-fuchsia-200">
              {car.class} · {formatNumber(selectedCar.power_rating)}
            </b>
          </div>
          <div className="flex justify-between gap-4">
            <span>Laps</span>
            <b className="text-white">0 / {track.lapCount}</b>
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

          {/* Resolved driving stats */}
          <div className="border-t border-white/10 pt-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-lime-200/60 mb-1.5">Driving stats</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
              <StatRow label="Max Speed" value={stats.maxSpeed} />
              <StatRow label="Accel" value={stats.acceleration} />
              <StatRow label="Brake" value={stats.brakeForce} />
              <StatRow label="Steer" value={stats.steering} />
              <StatRow label="Grip" value={stats.grip} />
              <StatRow label="Drift" value={stats.driftFactor} />
              <StatRow label="Nitro Pwr" value={stats.nitroPower} />
              <StatRow label="Nitro Dur" value={`${stats.nitroDuration}s`} />
            </div>
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

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between">
      <span className="text-white/40">{label}</span>
      <span className="text-lime-200 font-bold">{value}</span>
    </div>
  );
}
