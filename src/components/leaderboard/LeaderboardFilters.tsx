"use client";

type Props = {
  category: string;
  carClass: string;
  limit: number;
  categories: readonly string[];
  classes: readonly string[];
  limits: readonly number[];
  onCategoryChange: (c: string) => void;
  onCarClassChange: (c: string) => void;
  onLimitChange: (l: number) => void;
};

export function LeaderboardFilters({
  category,
  carClass,
  limit,
  categories,
  classes,
  limits,
  onCategoryChange,
  onCarClassChange,
  onLimitChange,
}: Props) {
  return (
    <div className="mb-4 space-y-3">
      {/* Category tabs */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              category === cat
                ? "bg-fuchsia-500/25 text-fuchsia-200 border border-fuchsia-400/30"
                : "border border-white/[0.08] bg-white/[0.03] text-white/45 hover:text-white/70 hover:border-white/15"
            }`}
          >
            {CAT_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* Class + limit row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/25">
          Class
        </span>
        <div className="flex flex-wrap gap-1">
          {classes.map((cls) => (
            <button
              key={cls}
              onClick={() => onCarClassChange(cls)}
              className={`rounded-md px-2 py-1 text-[11px] font-bold transition-colors ${
                carClass === cls
                  ? "bg-lime-500/20 text-lime-200 border border-lime-400/25"
                  : "border border-white/[0.06] bg-white/[0.02] text-white/35 hover:text-white/55"
              }`}
            >
              {cls === "all" ? "All" : cls}
            </button>
          ))}
        </div>

        <span className="ml-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/25">
          Show
        </span>
        <div className="flex gap-1">
          {limits.map((l) => (
            <button
              key={l}
              onClick={() => onLimitChange(l)}
              className={`rounded-md px-2 py-1 text-[11px] font-bold transition-colors ${
                limit === l
                  ? "bg-lime-500/15 text-lime-200 border border-lime-400/20"
                  : "border border-white/[0.06] bg-white/[0.02] text-white/35 hover:text-white/55"
              }`}
            >
              Top {l}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const CAT_LABELS: Record<string, string> = {
  best_total_time: "Best Total",
  best_first_lap: "Best First Lap",
  best_lap: "Best Lap",
  race_cash_earned: "Race Cash",
  races_finished: "Races",
};
