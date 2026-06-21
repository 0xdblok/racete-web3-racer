"use client";

import { formatRaceTime } from "@/lib/race/format";
import type { RecordsResponse } from "@/app/api/race/records/route";

type MyRecordsPanelProps = {
  data: RecordsResponse | null;
  loading: boolean;
};

export function MyRecordsPanel({ data, loading }: MyRecordsPanelProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-lime-300/60">
          My Records
        </p>
        <div className="mt-3 flex items-center gap-2 text-sm text-white/40">
          <div className="size-4 animate-spin rounded-full border-2 border-lime-300/40 border-t-transparent" />
          Loading records...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-lime-300/60">
          My Records
        </p>
        <p className="mt-2 text-sm text-white/40">Connect wallet to view records.</p>
      </div>
    );
  }

  const { records, hasRecord, targets, carClass, trackId } = data;

  if (!hasRecord || !records) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-lime-300/60">
          My Records
        </p>
        <p className="mt-2 text-sm text-white/50">No records yet.</p>
        <p className="text-xs text-white/35">
          Finish a race to set your first record.
        </p>
        <TargetCard targets={targets} carClass={carClass} trackId={trackId} />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-lime-300/15 bg-lime-300/[0.04] p-5">
      <p className="text-xs font-black uppercase tracking-[0.3em] text-lime-300/60">
        My Records
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <RecordStat
          label="Best Total Time"
          value={records.bestTotalTimeMs != null ? formatRaceTime(records.bestTotalTimeMs) : "—"}
        />
        <RecordStat
          label="Best First Lap"
          value={records.bestFirstLapMs != null ? formatRaceTime(records.bestFirstLapMs) : "—"}
        />
        <RecordStat
          label="Best Lap"
          value={records.bestLapMs != null ? formatRaceTime(records.bestLapMs) : "—"}
        />
        <RecordStat
          label="Races Finished"
          value={String(records.totalRacesFinished)}
        />
      </div>
      <p className="mt-2 text-xs text-lime-300/40">
        Total earned: <b className="text-lime-300">{records.totalRaceCashEarned.toLocaleString()} RC</b>
      </p>
      <TargetCard targets={targets} carClass={carClass} trackId={trackId} />
    </div>
  );
}

function TargetCard({
  targets,
  carClass,
  trackId,
}: {
  targets: { totalMs: number; firstLapMs: number; bestLapMs: number; carClass: string; trackId: string };
  carClass: string;
  trackId: string;
}) {
  return (
    <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/20 p-3 text-xs text-white/45">
      <p className="font-bold text-white/55">
        Target Times — Class {carClass} · {trackId}
      </p>
      <div className="mt-2 flex justify-between gap-2">
        <span>Total: {formatRaceTime(targets.totalMs)}</span>
        <span>First Lap: {formatRaceTime(targets.firstLapMs)}</span>
        <span>Best Lap: {formatRaceTime(targets.bestLapMs)}</span>
      </div>
    </div>
  );
}

function RecordStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
        {label}
      </p>
      <p className="text-sm font-black text-white">{value}</p>
    </div>
  );
}
