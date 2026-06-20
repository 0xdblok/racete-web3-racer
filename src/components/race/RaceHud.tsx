import { formatNumber, shortWallet } from "@/lib/format";
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
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-4 md:p-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-3">
        <div className="rounded-3xl border border-white/10 bg-black/60 p-4 shadow-2xl shadow-black/40 backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-lime-300">Solo shell</p>
          <h1 className="mt-1 text-2xl font-black text-white">{track.name}</h1>
          <p className="mt-1 max-w-sm text-sm text-white/60">{track.description}</p>
        </div>
        <div className="grid min-w-72 gap-2 rounded-3xl border border-fuchsia-300/20 bg-black/60 p-4 text-sm text-white/75 shadow-2xl shadow-black/40 backdrop-blur">
          <div className="flex justify-between gap-4"><span>Wallet</span><b className="text-white">{shortWallet(walletAddress)}</b></div>
          <div className="flex justify-between gap-4"><span>Car</span><b className="text-lime-200">{car.name}</b></div>
          <div className="flex justify-between gap-4"><span>Power Rating</span><b className="text-fuchsia-200">{formatNumber(selectedCar.power_rating)}</b></div>
          <div className="flex justify-between gap-4"><span>Laps</span><b className="text-white">0 / {track.lapCount}</b></div>
          <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-100">Physics coming next</div>
        </div>
      </div>
    </div>
  );
}
